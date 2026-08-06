/**
 * Component tests: entrypoints/popup/components/Topbar.svelte
 *
 * Uses @testing-library/svelte for DOM-based assertions.
 * File extension is `.svelte.test.ts` so Vitest processes Svelte runes.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Topbar from '../../../entrypoints/popup/components/Topbar.svelte';

describe('Topbar', () => {
  it('renders the brand name', () => {
    render(Topbar, {
      props: { tab: 'usage', ontabchange: () => {} },
    });
    expect(screen.getByText('智能Coding Plan助手')).toBeInTheDocument();
  });

  it('renders AI 新闻 and Token 用量 tab buttons', () => {
    render(Topbar, {
      props: { tab: 'usage', ontabchange: () => {} },
    });
    expect(screen.getByRole('tab', { name: 'AI 新闻' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Token 用量' })).toBeInTheDocument();
  });

  it('marks AI 新闻 active when tab is news', () => {
    render(Topbar, {
      props: { tab: 'news', ontabchange: () => {} },
    });
    expect(screen.getByRole('tab', { name: 'AI 新闻' })).toHaveClass('active');
    expect(screen.getByRole('tab', { name: 'Token 用量' })).not.toHaveClass('active');
  });

  it('marks Token 用量 active when tab is usage', () => {
    render(Topbar, {
      props: { tab: 'usage', ontabchange: () => {} },
    });
    expect(screen.getByRole('tab', { name: 'Token 用量' })).toHaveClass('active');
    expect(screen.getByRole('tab', { name: 'AI 新闻' })).not.toHaveClass('active');
  });

  it('calls ontabchange("usage") when Token 用量 is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(Topbar, {
      props: { tab: 'news', ontabchange: onChange },
    });

    await user.click(screen.getByRole('tab', { name: 'Token 用量' }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('usage');
  });

  it('calls ontabchange("news") when AI 新闻 is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(Topbar, {
      props: { tab: 'usage', ontabchange: onChange },
    });

    await user.click(screen.getByRole('tab', { name: 'AI 新闻' }));
    expect(onChange).toHaveBeenCalledWith('news');
  });
});
