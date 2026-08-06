<script lang="ts">
  import type { SaleAlarmStatusSnapshot } from '../../lib/settings/sale-time';

  interface Props {
    alarmStatus: SaleAlarmStatusSnapshot;
    soundEnabled?: boolean;
  }

  let { alarmStatus, soundEnabled = true }: Props = $props();

  const PHASE_META: Record<
    number,
    {
      label: string;
      badgeText: string;
      badgeColor: string;
      badgeTooltip: string;
      title: string;
      message: string;
      banner: string;
      bannerButton: string;
      sound: string;
      effects: string[];
    }
  > = {
    60: {
      label: 'T-60m',
      badgeText: '60',
      badgeColor: '#0ea5e9',
      badgeTooltip: '距秒杀 60 分钟',
      title: '🔥 智谱秒杀提醒',
      message: '距秒杀开始还有 1 小时，数据已刷新',
      banner: '🔥 距智谱秒杀还有 60 分钟',
      bannerButton: '立即准备',
      sound: '880Hz 蜂鸣 ×1',
      effects: ['系统通知', 'Badge 角标', '点击通知打开 popup'],
    },
    30: {
      label: 'T-30m',
      badgeText: '30',
      badgeColor: '#6366f1',
      badgeTooltip: '距秒杀 30 分钟',
      title: '🔥 智谱秒杀提醒',
      message: '距秒杀开始还有 30 分钟！',
      banner: '🔥 距智谱秒杀还有 30 分钟',
      bannerButton: '立即准备',
      sound: '880Hz 蜂鸣 ×1',
      effects: ['系统通知', 'Badge 角标', '点击通知打开 popup'],
    },
    15: {
      label: 'T-15m',
      badgeText: '15',
      badgeColor: '#f59e0b',
      badgeTooltip: '距秒杀 15 分钟',
      title: '🔥 智谱秒杀提醒',
      message: '距秒杀开始还有 15 分钟！',
      banner: '🔥 距智谱秒杀还有 15 分钟',
      bannerButton: '立即准备',
      sound: '880Hz 蜂鸣 ×1',
      effects: ['系统通知', 'Badge 角标', '点击通知打开 popup'],
    },
    10: {
      label: 'T-10m',
      badgeText: '10',
      badgeColor: '#f97316',
      badgeTooltip: '距秒杀 10 分钟',
      title: '🔥 智谱秒杀提醒',
      message: '距秒杀开始还有 10 分钟！',
      banner: '🔥 距智谱秒杀还有 10 分钟',
      bannerButton: '立即准备',
      sound: '880Hz 蜂鸣 ×3',
      effects: ['系统通知', 'Badge 角标', '点击通知打开 popup'],
    },
    5: {
      label: 'T-5m',
      badgeText: '5!',
      badgeColor: '#dc2626',
      badgeTooltip: '距秒杀 5 分钟：立即录入验证码！',
      title: '🔥 智谱秒杀提醒 · 验证码冲刺',
      message: '距秒杀开始还有 5 分钟！请尽快录入验证码，越多越好。',
      banner: '🔥 距智谱秒杀还有 5 分钟！请立刻录入验证码，越多越好',
      bannerButton: '去录入验证码',
      sound: '880Hz 蜂鸣 ×4',
      effects: ['系统通知', 'Badge 角标', '点击通知打开 popup'],
    },
  };

  const itemMap = $derived(new Map(alarmStatus.items.map((i) => [i.minutesBefore, i])));

  function formatTs(ts: number): string {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: alarmStatus.config.timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    }).format(new Date(ts));
  }

  function formatRelative(ms: number): string {
    if (ms <= 0) return '已过期';
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1000);
    if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${minutes}m ${seconds}s`;
  }

  function phaseItem(minutesBefore: number) {
    return itemMap.get(minutesBefore);
  }
</script>

<div class="timeline-wrap">
  <div class="timeline-header">
    <span class="timeline-title">提醒事件预览</span>
    <span class="timeline-sub">鼠标悬停图标查看具体动作；浏览器蜂鸣对应 🔊 图标。</span>
  </div>

  <ol class="timeline">
    {#each [60, 30, 15, 10, 5] as min (min)}
      {@const item = phaseItem(min)}
      {@const meta = PHASE_META[min]}
      {#if item}
        <li class="timeline-item" class:pending={item.status === 'pending'} class:expired={item.status === 'expired'}>
          <div class="timeline-left">
            <div class="timeline-dot" style="background: {meta.badgeColor}; box-shadow: 0 0 0 4px {meta.badgeColor}20;"></div>
            <div class="timeline-time">
              <span class="time-phase">{meta.label}</span>
              <span class="time-clock">{formatTs(item.notificationTime)}</span>
              <span class="time-relative">{formatRelative(item.msUntilNotification)}</span>
            </div>
          </div>

          <div class="timeline-card">
            <div class="card-row card-head">
              <span class="status-pill" class:pending={item.status === 'pending'}>{item.status === 'pending' ? '未生效' : '已过期'}</span>
            </div>

            <div class="preview-grid">
              <div class="preview-cell" title="{meta.badgeTooltip}">
                <span class="preview-label">Badge</span>
                <span class="badge-preview" style="background: {meta.badgeColor};">{meta.badgeText}</span>
              </div>

              <div class="preview-cell notification-cell" title="系统通知：{meta.title} — {meta.message}">
                <span class="preview-label">通知</span>
                <div class="notification-mini">
                  <strong>{meta.title}</strong>
                  <p>{meta.message}</p>
                  <div class="notif-buttons">
                    <span>立即准备</span>
                    <span>稍后提醒</span>
                  </div>
                </div>
              </div>

              <div class="preview-cell" title="页面顶部横幅：{meta.banner}">
                <span class="preview-label">横幅</span>
                <div class="banner-mini">
                  <span>{meta.banner}</span>
                  <button type="button">{meta.bannerButton}</button>
                </div>
              </div>

              <div class="preview-cell" title="声音：{soundEnabled ? meta.sound : '已关闭'}">
                <span class="preview-label">声音</span>
                <span class="sound-icon">{soundEnabled ? '🔊' : '🔇'}</span>
                <span class="sound-count">{soundEnabled ? meta.sound.replace(/^.*×/, '×') : '—'}</span>
              </div>
            </div>

            <div class="effects-row">
              {#each meta.effects as effect}
                <span class="effect-chip" title={effect}>{effect}</span>
              {/each}
            </div>
          </div>
        </li>
      {/if}
    {/each}

    <!-- T-0 秒杀开始 -->
    <li class="timeline-item t-zero">
      <div class="timeline-left">
        <div class="timeline-dot" style="background: #dc2626; box-shadow: 0 0 0 4px #dc262620;"></div>
        <div class="timeline-time">
          <span class="time-phase">T-0</span>
          <span class="time-clock">{formatTs(alarmStatus.nextSaleTime)}</span>
          <span class="time-relative">秒杀开始</span>
        </div>
      </div>
      <div class="timeline-card">
        <div class="card-row card-head">
          <span class="status-pill pending">进行中</span>
        </div>
        <div class="preview-grid">
          <div class="preview-cell" title="Badge：秒杀进行中！">
            <span class="preview-label">Badge</span>
            <span class="badge-preview" style="background: #dc2626; font-size: 12px;">🔥</span>
          </div>
          <div class="preview-cell muted" title="T-0 不触发系统通知">
            <span class="preview-label">通知</span>
            <span>—</span>
          </div>
          <div class="preview-cell muted" title="T-0 不显示页面横幅">
            <span class="preview-label">横幅</span>
            <span>—</span>
          </div>
          <div class="preview-cell muted" title="T-0 不播放蜂鸣">
            <span class="preview-label">声音</span>
            <span>—</span>
          </div>
        </div>
        <div class="effects-row">
          <span class="effect-chip" title="T-5 的 Badge 提醒在秒杀时刻结束">T-5 提醒结束</span>
        </div>
      </div>
    </li>
  </ol>
</div>

<style>
  .timeline-wrap {
    border-radius: 18px;
    border: 1px solid var(--panel-border-soft);
    background: rgba(255, 255, 255, 0.34);
    overflow: hidden;
  }
  @media (prefers-color-scheme: dark) {
    .timeline-wrap { background: rgba(15, 23, 42, 0.32); }
  }

  .timeline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 18px;
    border-bottom: 1px solid var(--line-soft);
  }
  .timeline-title { font-size: 13px; font-weight: 800; color: var(--text-strong); }
  .timeline-sub { font-size: 11px; color: var(--text-muted); }

  .timeline {
    list-style: none;
    margin: 0;
    padding: 18px 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .timeline-item {
    display: flex;
    gap: 14px;
    padding: 0 18px;
    position: relative;
  }
  .timeline-item::before {
    content: '';
    position: absolute;
    left: 27px;
    top: 28px;
    bottom: -22px;
    width: 2px;
    background: var(--line-soft);
  }
  .timeline-item:last-child::before { display: none; }

  .timeline-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 80px;
    flex-shrink: 0;
  }
  .timeline-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid #fff;
    z-index: 1;
  }
  .timeline-time {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 2px;
  }
  .time-phase { font-size: 12px; font-weight: 800; color: var(--text-strong); }
  .time-clock { font-size: 10px; color: var(--text-main); font-family: 'SF Mono', monospace; }
  .time-relative { font-size: 10px; color: var(--text-muted); }

  .timeline-card {
    flex: 1;
    min-width: 0;
    border-radius: 16px;
    border: 1px solid var(--panel-border-soft);
    background: rgba(255, 255, 255, 0.5);
    padding: 14px;
  }
  @media (prefers-color-scheme: dark) {
    .timeline-card { background: rgba(15, 23, 42, 0.42); }
  }

  .card-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .status-pill {
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    background: rgba(100, 116, 139, 0.12);
    color: var(--text-muted);
  }
  .status-pill.pending { background: rgba(16, 185, 129, 0.14); color: var(--primary-strong); }

  .preview-grid {
    display: grid;
    grid-template-columns: 64px 1.4fr 1fr 52px;
    gap: 10px;
  }
  @media (max-width: 720px) {
    .preview-grid { grid-template-columns: 1fr 1fr; }
  }

  .preview-cell {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.35);
    min-height: 64px;
  }
  @media (prefers-color-scheme: dark) {
    .preview-cell { background: rgba(15, 23, 42, 0.25); }
  }
  .preview-cell.muted { color: var(--text-muted); align-items: center; justify-content: center; }
  .preview-label {
    font-size: 9px;
    font-weight: 800;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .badge-preview {
    align-self: flex-start;
    min-width: 28px;
    padding: 3px 8px;
    border-radius: 999px;
    text-align: center;
    font-size: 11px;
    font-weight: 800;
    color: #fff;
  }

  .notification-mini {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .notification-mini strong { font-size: 11px; color: var(--text-strong); }
  .notification-mini p { margin: 0; font-size: 10px; color: var(--text-main); line-height: 1.4; }
  .notif-buttons {
    display: flex;
    gap: 6px;
    margin-top: 2px;
  }
  .notif-buttons span {
    font-size: 9px;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(99, 102, 241, 0.1);
    color: var(--violet);
    font-weight: 700;
  }

  .banner-mini {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .banner-mini span {
    font-size: 10px;
    color: var(--text-main);
    line-height: 1.4;
  }
  .banner-mini button {
    align-self: flex-start;
    padding: 3px 8px;
    border-radius: 999px;
    border: none;
    background: #dc2626;
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    cursor: default;
  }

  .sound-icon {
    font-size: 20px;
    align-self: center;
    margin-top: auto;
  }
  .sound-count {
    font-size: 9px;
    color: var(--text-muted);
    align-self: center;
    margin-bottom: auto;
  }

  .effects-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }
  .effect-chip {
    font-size: 10px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(16, 185, 129, 0.1);
    color: var(--primary-strong);
    font-weight: 700;
    cursor: help;
  }

  .t-zero .timeline-card { border-color: rgba(220, 38, 38, 0.22); }
</style>
