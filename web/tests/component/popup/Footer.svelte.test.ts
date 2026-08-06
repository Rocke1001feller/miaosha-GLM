/**
 * Component tests: entrypoints/popup/components/Footer.svelte
 *
 * Footer 从左到右：设置（动作按钮，打开选项页）+ 买家秀 / 秒杀 /
 * 拼团转让（三个互斥 tab）。
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Footer from '../../../entrypoints/popup/components/Footer.svelte';

describe('Footer', () => {
  it('renders 设置 + 买家秀 / 秒杀 / 拼团转让 buttons in order', () => {
    const { container } = render(Footer, {
      props: { tab: 'usage', ontabchange: () => {} },
    });
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.seg button'),
    ).map((b) => b.textContent);
    expect(buttons).toEqual(['设置', '买家秀', '秒杀', '拼团转让']);
  });

  it('设置 opens the options page and is not a tab', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const openOptions = vi
      .spyOn(chrome.runtime, 'openOptionsPage')
      .mockImplementation(() => {});

    render(Footer, {
      props: { tab: 'usage', ontabchange: onChange },
    });

    const settingsBtn = screen.getByRole('button', { name: '设置' });
    await user.click(settingsBtn);
    expect(openOptions).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    // 设置是动作按钮，永不高亮为 active tab
    expect(settingsBtn).not.toHaveClass('active');
  });

  it.each([
    { label: '买家秀', id: 'buyer-show' },
    { label: '秒杀', id: 'seckill' },
    { label: '拼团转让', id: 'group-buy' },
  ] as const)('clicking $label calls ontabchange("$id")', async ({ label, id }) => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(Footer, {
      props: { tab: 'usage', ontabchange: onChange },
    });

    await user.click(screen.getByRole('tab', { name: label }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(id);
  });

  it('highlights exactly the active footer tab', () => {
    render(Footer, {
      props: { tab: 'seckill', ontabchange: () => {} },
    });
    expect(screen.getByRole('tab', { name: '秒杀' })).toHaveClass('active');
    expect(screen.getByRole('tab', { name: '买家秀' })).not.toHaveClass('active');
    expect(screen.getByRole('tab', { name: '拼团转让' })).not.toHaveClass('active');
  });

  it('no footer tab is active when the current tab lives in the topbar', () => {
    render(Footer, {
      props: { tab: 'usage', ontabchange: () => {} },
    });
    for (const label of ['买家秀', '秒杀', '拼团转让']) {
      expect(screen.getByRole('tab', { name: label })).not.toHaveClass('active');
    }
  });
});
