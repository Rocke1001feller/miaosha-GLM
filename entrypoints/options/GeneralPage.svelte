<script lang="ts">
  import {
    SALE_TIME_DEFAULT,
    getNextSaleTime,
    saleTimeStore,
    type SaleAlarmStatusSnapshot,
    type SaleTimeConfig,
  } from '../../lib/settings/sale-time';
  import ReminderTimeline from './ReminderTimeline.svelte';
  import {
    CAPTCHA_CONFIG_DEFAULT,
    captchaStore,
    type CaptchaConfig,
  } from '../../lib/settings/captcha';
  import {
    FIRE_CONFIG_DEFAULT,
    fireStore,
    type FireConfig,
  } from '../../lib/settings/fire';

  let loaded = $state(false);

  let saleHour = $state(9);
  let saleMinute = $state(54);
  let saleSecond = $state(59);
  let saleMs = $state(999);
  let saleTimezone = $state('Asia/Shanghai');
  let saleSoundEnabled = $state(true);
  let committedSale = $state<SaleTimeConfig | null>(null);
  let alarmStatus = $state<SaleAlarmStatusSnapshot | null>(null);
  let saleSaving = $state(false);
  let saleSaveMessage = $state('');

  let batchSessionLimit = $state(CAPTCHA_CONFIG_DEFAULT.batchSessionLimit);
  let committedCaptcha = $state<CaptchaConfig | null>(null);
  let captchaSaving = $state(false);
  let captchaSaveMessage = $state('');

  let burstIntervalMs = $state(FIRE_CONFIG_DEFAULT.burstIntervalMs);
  let committedFireConfig = $state<FireConfig | null>(null);
  let fireSaving = $state(false);
  let fireSaveMessage = $state('');

  const TIMEZONES = [
    { value: 'Asia/Shanghai',    label: '🇨🇳 北京时间 (UTC+8)' },
    { value: 'Asia/Tokyo',       label: '🇯🇵 东京时间 (UTC+9)' },
    { value: 'Asia/Seoul',       label: '🇰🇷 首尔时间 (UTC+9)' },
    { value: 'America/New_York', label: '🇺🇸 纽约时间 (UTC-5)' },
    { value: 'America/Los_Angeles', label: '🇺🇸 洛杉矶时间 (UTC-8)' },
    { value: 'Europe/London',     label: '🇬🇧 伦敦时间 (UTC+0)' },
    { value: 'Europe/Paris',     label: '🇫🇷 巴黎时间 (UTC+1)' },
  ];

  $effect(() => {
    Promise.all([
      saleTimeStore.get(),
      saleTimeStore.getAlarmStatus(),
      captchaStore.get(),
      fireStore.get(),
    ]).then(([s, status, captcha, fire]) => {
      saleHour = s.hour;
      saleMinute = s.minute;
      saleSecond = s.second;
      saleMs = s.ms;
      saleTimezone = s.timezone;
      saleSoundEnabled = s.soundEnabled;
      committedSale = { ...s };
      alarmStatus = status;
      batchSessionLimit = captcha.batchSessionLimit;
      committedCaptcha = { ...captcha };
      burstIntervalMs = fire.burstIntervalMs;
      committedFireConfig = { ...fire };
      loaded = true;
    });
  });

  function currentSaleConfig(): SaleTimeConfig {
    return {
      hour: Number(saleHour),
      minute: Number(saleMinute),
      second: Number(saleSecond),
      ms: Math.max(0, Math.min(999, Number(saleMs) || 0)),
      timezone: saleTimezone,
      soundEnabled: saleSoundEnabled,
    };
  }

  function sameSaleConfig(a: SaleTimeConfig | null, b: SaleTimeConfig): boolean {
    return !!a
      && a.hour === b.hour
      && a.minute === b.minute
      && a.second === b.second
      && a.ms === b.ms
      && a.timezone === b.timezone
      && a.soundEnabled === b.soundEnabled;
  }

  function isSaleDirty(): boolean {
    return !sameSaleConfig(committedSale, currentSaleConfig());
  }

  function formatTimezoneOffset(tz: string, ts: number): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date(ts));
    const offsetPart = parts.find((p) => p.type === 'timeZoneName');
    return (offsetPart?.value || 'UTC').replace(/^GMT/, 'UTC');
  }

  function formatTs(ts: number, timezone = saleTimezone): string {
    const offset = formatTimezoneOffset(timezone, ts);
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      fractionalSecondDigits: 3,
    }).format(new Date(ts)) + ` (${offset})`;
  }

  function formatDefaultTargetTs(): string {
    const ts = getNextSaleTime(SALE_TIME_DEFAULT);
    return formatTs(ts, SALE_TIME_DEFAULT.timezone);
  }

  function computeNextSaleTs(): string {
    try {
      const config = currentSaleConfig();
      const saleUtc = getNextSaleTime(config);
      return new Intl.DateTimeFormat('zh-CN', {
        timeZone: config.timezone,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        fractionalSecondDigits: 3,
      }).format(new Date(saleUtc));
    } catch {
      return '计算失败';
    }
  }

  function formatRelative(ms: number): string {
    if (ms <= 0) return '已过期';
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1000);
    if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${minutes}m ${seconds}s`;
  }

  async function handleSaleTimeConfirm() {
    const config = currentSaleConfig();
    saleSaving = true;
    saleSaveMessage = '';
    try {
      await saleTimeStore.set(config);
      const response = await chrome.runtime.sendMessage({ type: 'SALE_TIME_UPDATED', config });
      committedSale = { ...config };
      alarmStatus = response?.alarmStatus ?? await saleTimeStore.getAlarmStatus();
      saleSaveMessage = `已校正 ${alarmStatus?.pendingCount ?? 0} 个未生效提醒，${alarmStatus?.expiredCount ?? 0} 个已过期提醒`;
    } finally {
      saleSaving = false;
    }
  }

  async function handleReset() {
    saleHour = SALE_TIME_DEFAULT.hour;
    saleMinute = SALE_TIME_DEFAULT.minute;
    saleSecond = SALE_TIME_DEFAULT.second;
    saleMs = SALE_TIME_DEFAULT.ms;
    saleTimezone = SALE_TIME_DEFAULT.timezone;
    saleSoundEnabled = SALE_TIME_DEFAULT.soundEnabled;
    await handleSaleTimeConfirm();
  }

  function isCaptchaDirty(): boolean {
    return batchSessionLimit !== (committedCaptcha?.batchSessionLimit ?? CAPTCHA_CONFIG_DEFAULT.batchSessionLimit);
  }

  async function handleCaptchaConfirm() {
    const clamped = Math.max(1, Math.min(1000, Number(batchSessionLimit) || CAPTCHA_CONFIG_DEFAULT.batchSessionLimit));
    batchSessionLimit = clamped;
    const config: CaptchaConfig = { batchSessionLimit: clamped };
    captchaSaving = true;
    captchaSaveMessage = '';
    try {
      await captchaStore.set(config);
      committedCaptcha = { ...config };
      captchaSaveMessage = `已生效：每轮录入 ${clamped} 个验证码`;
    } finally {
      captchaSaving = false;
    }
  }

  async function handleCaptchaReset() {
    batchSessionLimit = CAPTCHA_CONFIG_DEFAULT.batchSessionLimit;
    await handleCaptchaConfirm();
  }

  function currentFireConfig(): FireConfig {
    return {
      ...(committedFireConfig ?? FIRE_CONFIG_DEFAULT),
      burstIntervalMs: Math.max(2100, Math.round(Number(burstIntervalMs)) || FIRE_CONFIG_DEFAULT.burstIntervalMs),
    };
  }

  function sameFireConfig(a: FireConfig | null, b: FireConfig): boolean {
    return !!a && a.burstIntervalMs === b.burstIntervalMs;
  }

  function isFireDirty(): boolean {
    return !sameFireConfig(committedFireConfig, currentFireConfig());
  }

  async function handleFireConfirm() {
    const config = currentFireConfig();
    fireSaving = true;
    fireSaveMessage = '';
    try {
      await fireStore.set(config);
      committedFireConfig = { ...config };
      burstIntervalMs = config.burstIntervalMs;
      fireSaveMessage = `已生效：Strike ${config.burstIntervalMs}ms`;
    } finally {
      fireSaving = false;
    }
  }

  async function handleFireReset() {
    burstIntervalMs = FIRE_CONFIG_DEFAULT.burstIntervalMs;
    await handleFireConfirm();
  }
</script>

<div class="page-stack">
  <section class="section-card">
    <div class="section-heading">
      <span class="accent-bar" style="background: var(--violet); box-shadow: 0 0 14px rgba(99,102,241,0.35);"></span>
      <h3>&#128293; 秒杀时间</h3>
    </div>
    <p class="section-note">设置每日秒杀开始时间。Badge 与系统通知在 T-60/30/15/10/5 分钟触发；页面内的自动开火按服务器时钟在 T-0 前 10ms 触发。</p>

    {#if loaded}
      <div class="sale-time-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="sale-hour">小时</label>
            <select id="sale-hour" class="form-select" bind:value={saleHour}>
              {#each Array.from({ length: 24 }, (_, i) => i) as h}
                <option value={h}>{h.toString().padStart(2, '0')}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="sale-minute">分</label>
            <select id="sale-minute" class="form-select" bind:value={saleMinute}>
              {#each Array.from({ length: 60 }, (_, i) => i) as m}
                <option value={m}>{m.toString().padStart(2, '0')}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="sale-second">秒</label>
            <select id="sale-second" class="form-select" bind:value={saleSecond}>
              {#each Array.from({ length: 60 }, (_, i) => i) as s}
                <option value={s}>{s.toString().padStart(2, '0')}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="sale-ms">毫秒</label>
            <input id="sale-ms" type="number" class="form-select form-input-num" min="0" max="999" step="1" bind:value={saleMs} />
          </div>
          <div class="form-group" style="flex: 2;">
            <label class="form-label" for="sale-tz">时区</label>
            <select id="sale-tz" class="form-select" bind:value={saleTimezone}>
              {#each TIMEZONES as tz}
                <option value={tz.value}>{tz.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="next-sale-preview">
          <span class="preview-label">下次触发</span>
          <span class="preview-value">
            <span class="highlight-val">{computeNextSaleTs()}</span>
          </span>
          {#if isSaleDirty()}
            <span class="dirty-pill">待确认</span>
          {/if}
        </div>

        <div class="form-row sound-toggle-row">
          <label class="sound-switch" for="sale-sound">
            <input id="sale-sound" type="checkbox" bind:checked={saleSoundEnabled} />
            <span class="switch-track"></span>
            <span class="switch-label">{saleSoundEnabled ? '🔊 提醒声音已开启' : '🔇 提醒声音已关闭'}</span>
          </label>
        </div>

        {#if alarmStatus}
          <ReminderTimeline {alarmStatus} soundEnabled={saleSoundEnabled} />
        {/if}

        <div class="sale-time-actions">
          {#if saleSaveMessage}
            <span class="save-message">{saleSaveMessage}</span>
          {/if}
          <button class="btn-confirm" type="button" onclick={handleSaleTimeConfirm} disabled={saleSaving || !isSaleDirty()}>
            {saleSaving ? '校正中...' : '确定生效'}
          </button>
          <button class="btn-reset" type="button" onclick={handleReset}>
            ↺ 重置默认 <span class="reset-hint">{formatDefaultTargetTs()}</span>
          </button>
        </div>
      </div>
    {:else}
      <div class="loading-skeleton">
        <div class="skeleton-row"></div>
      </div>
    {/if}
  </section>

  <section class="section-card">
    <div class="section-heading">
      <span class="accent-bar" style="background: var(--amber); box-shadow: 0 0 14px rgba(217,119,6,0.35);"></span>
      <h3>&#127915; 验证码录入</h3>
    </div>
    <p class="section-note">设置验证码池上限（也是一轮 Batch 录入的上限），达到上限自动停止。每张票有效期 300 秒，过期自动清理；开售前 5 分钟内录入最有效。</p>

    {#if loaded}
      <div class="sale-time-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="batch-limit">验证码池上限 / 每轮录入上限</label>
            <input id="batch-limit" type="number" class="form-select form-input-num" min="1" max="1000" step="1" bind:value={batchSessionLimit} />
          </div>
          <div class="form-group" style="flex: 2;">
            <div class="next-sale-preview" style="margin-top: 0;">
              <span class="preview-label">当前值</span>
              <span class="preview-value">
                <span class="highlight-val">{batchSessionLimit} 个</span>
              </span>
              {#if isCaptchaDirty()}
                <span class="dirty-pill">待确认</span>
              {/if}
            </div>
          </div>
        </div>

        <div class="sale-time-actions">
          {#if captchaSaveMessage}
            <span class="save-message">{captchaSaveMessage}</span>
          {/if}
          <button class="btn-confirm" type="button" onclick={handleCaptchaConfirm} disabled={captchaSaving || !isCaptchaDirty()}>
            {captchaSaving ? '保存中...' : '确定生效'}
          </button>
          <button class="btn-reset" type="button" onclick={handleCaptchaReset}>
            ↺ 重置默认 <span class="reset-hint">{CAPTCHA_CONFIG_DEFAULT.batchSessionLimit} 个</span>
          </button>
        </div>
      </div>
    {:else}
      <div class="loading-skeleton">
        <div class="skeleton-row"></div>
      </div>
    {/if}
  </section>

  <section class="section-card">
    <div class="section-heading">
      <span class="accent-bar" style="background: var(--rose); box-shadow: 0 0 14px rgba(225,29,72,0.35);"></span>
      <h3>&#128293; Fire 发射参数</h3>
    </div>
    <p class="section-note">控制串行发射的最小间隔。智谱 preview 端点为约 2 秒滑动窗口限流（阈值=1），低于 2 秒必触发 555；下限锁定 2100ms，默认 2100ms，网络抖动大可调到 2300ms 以上。</p>

    {#if loaded}
      <div class="sale-time-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="fire-burst-interval">Strike 单发间隔（ms）</label>
            <input id="fire-burst-interval" type="number" class="form-select form-input-num" min="2100" max="10000" step="100" bind:value={burstIntervalMs} />
          </div>
          <div class="form-group" style="flex: 2;">
            <div class="next-sale-preview" style="margin-top: 0;">
              <span class="preview-label">当前配置</span>
              <span class="preview-value">
                <span class="highlight-val">{burstIntervalMs}ms</span>
              </span>
              {#if isFireDirty()}
                <span class="dirty-pill">待确认</span>
              {/if}
            </div>
          </div>
        </div>

        <div class="sale-time-actions">
          {#if fireSaveMessage}
            <span class="save-message">{fireSaveMessage}</span>
          {/if}
          <button class="btn-confirm" type="button" onclick={handleFireConfirm} disabled={fireSaving || !isFireDirty()}>
            {fireSaving ? '保存中...' : '确定生效'}
          </button>
          <button class="btn-reset" type="button" onclick={handleFireReset}>
            ↺ 重置默认 <span class="reset-hint">{FIRE_CONFIG_DEFAULT.burstIntervalMs}ms</span>
          </button>
        </div>
      </div>
    {:else}
      <div class="loading-skeleton">
        <div class="skeleton-row"></div>
      </div>
    {/if}
  </section>
</div>

<style>
  .page-stack { display: flex; flex-direction: column; gap: 24px; }

  .section-card {
    background: linear-gradient(135deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.24) 100%);
    border: 1px solid var(--panel-border);
    border-top-color: rgba(255,255,255,0.88);
    border-left-color: rgba(255,255,255,0.88);
    box-shadow: var(--card-shadow);
    border-radius: var(--radius-xl);
    padding: 28px 30px;
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  @media (prefers-color-scheme: dark) {
    .section-card {
      background: linear-gradient(135deg, rgba(30,41,59,0.78) 0%, rgba(15,23,42,0.52) 100%);
      border-top-color: rgba(255,255,255,0.12);
      border-left-color: rgba(255,255,255,0.12);
    }
  }
  .section-card::before {
    content: '';
    position: absolute;
    inset: -80px auto auto -80px;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(16,185,129,0.09), transparent 68%);
    pointer-events: none;
  }

  .section-heading { display: flex; align-items: center; gap: 12px; margin: 0 0 8px; position: relative; z-index: 1; }
  .accent-bar { width: 6px; height: 26px; border-radius: 999px; background: var(--primary); box-shadow: 0 0 14px rgba(16,185,129,0.35); flex: 0 0 auto; }
  .section-heading h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-strong); letter-spacing: -0.02em; }
  .section-note { margin: 0 0 24px 18px; color: var(--text-muted); font-size: 13px; line-height: 1.6; position: relative; z-index: 1; }

  .sale-time-form { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 16px; }
  .form-row { display: flex; gap: 12px; align-items: flex-end; }
  .form-group { display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .form-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
  .form-select {
    padding: 10px 12px; border-radius: 12px; border: 1px solid var(--panel-border-soft);
    background: rgba(255,255,255,0.5); color: var(--text-strong); font-family: inherit; font-size: 14px; font-weight: 600;
    cursor: pointer; transition: border-color 180ms ease, box-shadow 180ms ease; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236d7c91' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center; padding-right: 32px;
  }
  @media (prefers-color-scheme: dark) { .form-select { background-color: rgba(15,23,42,0.46); } }
  .form-select:focus { outline: none; border-color: var(--violet); box-shadow: 0 0 0 3px var(--violet-soft); }
  .form-input-num { background-image: none; padding-right: 12px; -moz-appearance: textfield; }
  .form-input-num::-webkit-inner-spin-button, .form-input-num::-webkit-outer-spin-button { opacity: 1; }

  .next-sale-preview { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: 12px; background: var(--violet-soft); border: 1px solid rgba(99,102,241,0.18); }
  .preview-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); }
  .preview-value { font-size: 14px; font-weight: 600; color: var(--text-strong); }
  .highlight-val { color: var(--violet); font-weight: 800; font-size: 16px; }
  .dirty-pill { margin-left: auto; padding: 3px 8px; border-radius: 999px; background: var(--amber-soft); color: var(--amber); border: 1px solid rgba(217,119,6,0.18); font-size: 11px; font-weight: 800; }

  .sale-time-actions { display: flex; align-items: center; gap: 10px; justify-content: flex-end; }
  .save-message { margin-right: auto; color: var(--primary-strong); font-size: 12px; font-weight: 700; }
  .sound-toggle-row { align-items: center; }
  .sound-switch {
    display: inline-flex; align-items: center; gap: 10px;
    font-size: 13px; font-weight: 700; color: var(--text-strong);
    cursor: pointer; user-select: none;
  }
  .sound-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
  .switch-track {
    width: 38px; height: 22px; border-radius: 999px;
    background: #cbd5e1; position: relative; transition: background 180ms ease;
  }
  .sound-switch input:checked + .switch-track { background: var(--primary-strong); }
  .switch-track::after {
    content: ''; position: absolute; top: 2px; left: 2px;
    width: 18px; height: 18px; border-radius: 50%; background: #fff;
    transition: transform 180ms ease;
  }
  .sound-switch input:checked + .switch-track::after { transform: translateX(16px); }
  .btn-confirm, .btn-reset {
    display: inline-flex; align-items: center; gap: 8px; padding: 9px 18px; border-radius: 12px;
    border: 1px solid rgba(99,102,241,0.28); background: rgba(99,102,241,0.08); color: var(--violet);
    font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
    transition: background 180ms ease, transform 180ms ease, box-shadow 180ms ease;
  }
  .btn-confirm { border-color: rgba(16,185,129,0.32); background: rgba(16,185,129,0.12); color: var(--primary-strong); }
  .btn-confirm:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
  .btn-confirm:not(:disabled):hover, .btn-reset:hover { background: rgba(99,102,241,0.16); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(99,102,241,0.18); }
  .btn-confirm:not(:disabled):hover { background: rgba(16,185,129,0.2); box-shadow: 0 4px 14px rgba(16,185,129,0.18); }
  .btn-confirm:active, .btn-reset:active { transform: translateY(0); }
  .reset-hint { font-size: 11px; font-weight: 600; opacity: 0.7; font-family: 'SF Mono', Monaco, Consolas, monospace; }

  .loading-skeleton { display: flex; flex-direction: column; gap: 16px; }
  .skeleton-row { height: 80px; border-radius: var(--radius-lg); background: linear-gradient(90deg, rgba(148,163,184,0.12), rgba(148,163,184,0.06), rgba(148,163,184,0.12)); background-size: 200% 100%; animation: shimmer 1.5s ease-in-out infinite; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  @media (max-width: 960px) { .form-row, .sale-time-actions { flex-wrap: wrap; } }
</style>
