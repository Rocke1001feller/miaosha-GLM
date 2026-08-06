/**
 * Unit tests: lib/platform/adapters/bigmodel/order-pipeline.ts
 * /pay/preview response classification (single source of truth for both the
 * pipeline itself and bm-capture.content.ts).
 */

import { describe, expect, it, vi } from 'vitest';
import {
  BigmodelOrderPipeline,
  classifyNetworkError,
  classifyPreviewError,
} from '../../../../lib/platform/adapters/bigmodel/order-pipeline';
import { xhrRequest } from '../../../../lib/platform/adapters/bigmodel/request';
import type { OrderContext, PlatformAuth } from '../../../../lib/platform/types';

vi.mock('../../../../lib/platform/adapters/bigmodel/request', () => ({
  xhrRequest: vi.fn(),
}));

const mockedXhr = vi.mocked(xhrRequest);

const AUTH: PlatformAuth = {
  platform: 'bigmodel',
  capturedAt: Date.now(),
  headers: {
    authorization: 'tok',
    'bigmodel-organization': 'org',
    'bigmodel-project': 'proj',
  },
};

const CTX: OrderContext = {
  platform: 'bigmodel',
  productId: 'p1',
  ticket: { ticket: 't', randstr: 'r', provider: 'tencent-captcha', createdAt: 1 },
};

describe('classifyPreviewError', () => {
  it('classifies code 555 as busy (sliding-window rate limit)', () => {
    const cls = classifyPreviewError({ code: 555, msg: 'Too Many Requests' });
    expect(cls.outcome).toBe('busy');
    expect(cls.code).toBe(555);
    expect(cls.serverMsg).toContain('2 秒滑动窗口限流');
    expect(cls.responsibility).toEqual({ subject: '智谱', target: '当前用户', cause: '2 秒滑动窗口限流' });
  });

  it('classifies "system busy" message as busy regardless of code', () => {
    const cls = classifyPreviewError({ code: 500, msg: 'System busy, please retry' });
    expect(cls.outcome).toBe('busy');
    expect(cls.code).toBe(500);
  });

  it('classifies 500 + 验证码校验服务异常 as captchaService (QPS limit)', () => {
    const cls = classifyPreviewError({ code: 500, msg: '验证码校验服务异常: xxx' });
    expect(cls.outcome).toBe('captchaService');
    expect(cls.serverMsg).toContain('超过了《每秒并发请求量（QPS）限制》');
    expect(cls.rawServerMsg).toBe('验证码校验服务异常: xxx');
    expect(cls.responsibility).toEqual({
      subject: '智谱',
      target: '腾讯验证码核销',
      cause: '超过了《每秒并发请求量（QPS）限制》',
    });
  });

  it('classifies 500 + 验证码Ticket不合法 as captchaInvalid', () => {
    const cls = classifyPreviewError({ code: 500, msg: '验证码Ticket不合法' });
    expect(cls.outcome).toBe('captchaInvalid');
    expect(cls.responsibility).toEqual({
      subject: '插件/用户',
      target: '腾讯验证码核销',
      cause: 'ticket 无效或已过期',
    });
  });

  it('classifies 500 + 验证存在安全风险 as captchaRisk', () => {
    const cls = classifyPreviewError({ code: 500, msg: '验证存在安全风险，请稍后再试' });
    expect(cls.outcome).toBe('captchaRisk');
    expect(cls.responsibility).toEqual({
      subject: '腾讯验证码风控',
      target: '当前请求',
      cause: '环境存在安全风险',
    });
  });

  it('falls back to error for unknown server errors', () => {
    const cls = classifyPreviewError({ code: 500, msg: 'something unexpected' });
    expect(cls.outcome).toBe('error');
    expect(cls.code).toBe(500);
    expect(cls.responsibility).toEqual({ subject: '智谱/网络', target: '插件', cause: '未知服务端错误' });
  });

  it('defaults missing code to 500', () => {
    const cls = classifyPreviewError({ msg: 'opaque failure' });
    expect(cls.outcome).toBe('error');
    expect(cls.code).toBe(500);
  });
});

describe('classifyNetworkError', () => {
  it('classifies a network failure as neterr', () => {
    const cls = classifyNetworkError('XHR timeout: https://bigmodel.cn/api/biz/pay/preview');
    expect(cls.outcome).toBe('neterr');
    expect(cls.code).toBe(0);
    expect(cls.rawServerMsg).toContain('XHR timeout');
    expect(cls.responsibility).toEqual({ subject: '插件/网络', target: '智谱', cause: '请求失败' });
  });
});

describe('BigmodelOrderPipeline.run classification contract', () => {
  it('classifies code 200 + data.soldOut as soldout', async () => {
    mockedXhr.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: { code: 200, msg: '', data: { soldOut: true } },
      headers: {},
    });

    const result = await new BigmodelOrderPipeline().run(CTX, AUTH);

    expect(result.success).toBe(false);
    expect((result.metadata?.classified as { outcome?: string })?.outcome).toBe('soldout');
    expect((result.metadata?.classified as { code?: number })?.code).toBe(200);
  });

  it('returns a fully classified failure (with responsibility) for server errors', async () => {
    mockedXhr.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: { code: 500, msg: '验证码Ticket不合法' },
      headers: {},
    });

    const result = await new BigmodelOrderPipeline().run(CTX, AUTH);

    expect(result.success).toBe(false);
    const classified = result.metadata?.classified as ReturnType<typeof classifyPreviewError>;
    expect(classified.outcome).toBe('captchaInvalid');
    expect(classified.responsibility.target).toBe('腾讯验证码核销');
    expect(result.metadata?.raw).toEqual({ code: 500, msg: '验证码Ticket不合法' });
  });

  it('returns a classified neterr when the request itself fails', async () => {
    mockedXhr.mockRejectedValue(new Error('XHR network error'));

    const result = await new BigmodelOrderPipeline().run(CTX, AUTH);

    expect(result.success).toBe(false);
    const classified = result.metadata?.classified as ReturnType<typeof classifyNetworkError>;
    expect(classified.outcome).toBe('neterr');
    expect(classified.responsibility.cause).toBe('请求失败');
  });
});
