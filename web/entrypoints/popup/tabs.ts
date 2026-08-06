/**
 * Popup tab model — a single mutually-exclusive active panel.
 *
 * Header (Topbar) holds the two high-frequency tabs:
 *   news  → AI 新闻（聚合阅读）
 *   usage → Token 用量（默认面板）
 * Footer holds the remaining tabs plus the settings action:
 *   buyer-show → 买家秀（占位：UGC 点评各模型实际使用情况）
 *   seckill    → 秒杀（平台入口）
 *   group-buy  → 拼团转让（占位：拼团 / 转让交易套餐）
 * 设置 is an action button (opens the options page), not a tab, so it is not
 * part of PopupTab and never becomes "active".
 */

export type PopupTab = 'news' | 'usage' | 'seckill' | 'buyer-show' | 'group-buy';

/** 每次打开 popup 默认显示 Token 用量。 */
export const DEFAULT_TAB: PopupTab = 'usage';

export interface TabMeta {
  id: PopupTab;
  label: string;
}

/** Topbar 两个高频入口。 */
export const TOPBAR_TABS: ReadonlyArray<TabMeta> = [
  { id: 'news', label: 'AI 新闻' },
  { id: 'usage', label: 'Token 用量' },
];

/** Footer 三个面板入口（设置按钮是动作，不在此列）。 */
export const FOOTER_TABS: ReadonlyArray<TabMeta> = [
  { id: 'buyer-show', label: '买家秀' },
  { id: 'seckill', label: '秒杀' },
  { id: 'group-buy', label: '拼团转让' },
];
