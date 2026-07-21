import type {
  IOrderPipeline,
  OperationResult,
  OrderContext,
  PaymentSession,
  PlatformAuth,
} from '../../types';
import { isBigmodelAuthValid } from './auth-probe';
import { xhrRequest } from './request';

export interface BigmodelPreviewResponse {
  code: number;
  msg?: string;
  data?: {
    bizId?: string;
    productId?: string;
    thirdPartyAmount?: number;
    payAmount?: number;
    qrCode?: string;
    soldOut?: boolean;
  };
}

// ── /pay/preview response classification: subject -> target -> cause ──
export interface ErrorResponsibility {
  subject: string;
  target: string;
  cause: string;
}

export interface ClassifiedShotResult {
  outcome:
    | 'success'
    | 'soldout'
    | 'busy'
    | 'error'
    | 'neterr'
    | 'captchaService'
    | 'captchaInvalid'
    | 'captchaRisk';
  code: number;
  serverMsg: string;
  rawServerMsg: string;
  responsibility: ErrorResponsibility;
}

export function classifyPreviewError(body: { code?: number; msg?: string }): ClassifiedShotResult {
  const code = body.code ?? 500;
  const raw = body.msg || '';

  if (code === 500 && raw.includes('验证码校验服务异常')) {
    return {
      outcome: 'captchaService',
      code,
      serverMsg: '【智谱 --> 腾讯验证码核销：超过了《每秒并发请求量（QPS）限制》】' + raw,
      rawServerMsg: raw,
      responsibility: { subject: '智谱', target: '腾讯验证码核销', cause: '超过了《每秒并发请求量（QPS）限制》' },
    };
  }
  if (code === 500 && raw.includes('验证码Ticket不合法')) {
    return {
      outcome: 'captchaInvalid',
      code,
      serverMsg: '【插件/用户 --> 腾讯验证码核销：ticket 无效或已过期】' + raw,
      rawServerMsg: raw,
      responsibility: { subject: '插件/用户', target: '腾讯验证码核销', cause: 'ticket 无效或已过期' },
    };
  }
  if (code === 500 && raw.includes('验证存在安全风险')) {
    return {
      outcome: 'captchaRisk',
      code,
      serverMsg: '【腾讯验证码风控 --> 当前请求：环境存在安全风险】' + raw,
      rawServerMsg: raw,
      responsibility: { subject: '腾讯验证码风控', target: '当前请求', cause: '环境存在安全风险' },
    };
  }
  if (code === 555 || raw.toLowerCase().includes('system busy')) {
    return {
      outcome: 'busy',
      code,
      serverMsg: '【智谱 --> 当前用户：2 秒滑动窗口限流】' + raw,
      rawServerMsg: raw,
      responsibility: { subject: '智谱', target: '当前用户', cause: '2 秒滑动窗口限流' },
    };
  }
  return {
    outcome: 'error',
    code,
    serverMsg: '【智谱/网络 --> 插件：未知服务端错误】' + raw,
    rawServerMsg: raw,
    responsibility: { subject: '智谱/网络', target: '插件', cause: '未知服务端错误' },
  };
}

export function classifyNetworkError(message: string): ClassifiedShotResult {
  return {
    outcome: 'neterr',
    code: 0,
    serverMsg: '【插件/网络 --> 智谱：请求失败】' + message,
    rawServerMsg: message,
    responsibility: { subject: '插件/网络', target: '智谱', cause: '请求失败' },
  };
}

export class BigmodelOrderPipeline implements IOrderPipeline {
  readonly platform = 'bigmodel';

  async run(
    ctx: OrderContext,
    auth: PlatformAuth,
  ): Promise<OperationResult<PaymentSession>> {
    if (!isBigmodelAuthValid(auth)) {
      return { success: false, error: 'bigmodel auth invalid' };
    }
    if (!ctx.ticket?.ticket) {
      return { success: false, error: 'missing captcha ticket' };
    }

    try {
      const authorization = auth.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
      const res = await xhrRequest<BigmodelPreviewResponse>({
        method: 'POST',
        url: 'https://bigmodel.cn/api/biz/pay/preview',
        withCredentials: true,
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
          Authorization: authorization,
          'Bigmodel-Organization': auth.headers['bigmodel-organization'],
          'Bigmodel-Project': auth.headers['bigmodel-project'],
        },
        body: JSON.stringify({
          productId: ctx.productId,
          invitationCode: '',
          ticket: ctx.ticket.ticket,
          randstr: ctx.ticket.randstr || '',
        }),
      });
      const body = res.data;

      if (body.code === 200 && body.data && !body.data.soldOut && body.data.bizId) {
        const session: PaymentSession = {
          platform: this.platform,
          productId: body.data.productId || ctx.productId,
          amount: body.data.thirdPartyAmount ?? body.data.payAmount ?? 0,
          currency: 'CNY',
          bizId: body.data.bizId,
          qrCode: body.data.qrCode,
          raw: body.data,
        };
        return { success: true, data: session };
      }

      if (body.code === 200 && body.data?.soldOut) {
        return {
          success: false,
          error: 'sold out',
          metadata: { classified: { outcome: 'soldout', code: 200, serverMsg: 'sold out', rawServerMsg: body.msg || '' } },
        };
      }

      const classified = classifyPreviewError(body);
      return { success: false, error: classified.serverMsg, metadata: { classified, raw: body } };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'network error',
        metadata: { classified: classifyNetworkError(e?.message || 'network error') },
      };
    }
  }
}
