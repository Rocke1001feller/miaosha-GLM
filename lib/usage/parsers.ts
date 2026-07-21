/** Pure parsers mapping probed platform responses to UsageCardData fields. */

import type { UsageBar, UsageCardData } from './types';

/** Accepts a 0-1 number or a "4%" style string; returns a 0-1 ratio. */
function toRatio(v: unknown): number {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const m = v.match(/([\d.]+)\s*%/);
    if (m) return parseFloat(m[1]) / 100;
  }
  return 0;
}

function fmtInt(n: unknown): string {
  return typeof n === 'number' && isFinite(n) ? n.toLocaleString('en-US') : '';
}

function fmtAfp(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

export function parseMinimax(json: any): Pick<UsageCardData, 'bars'> {
  const list = json?.model_remains;
  const general = Array.isArray(list) ? list.find((m: any) => m?.model_name === 'general') : null;
  if (!general) return { bars: [] };
  const bars: UsageBar[] = [];
  if (general.current_interval_used_percent != null) {
    bars.push({
      label: '5h 限额',
      percent: toRatio(general.current_interval_used_percent),
      resetAt:
        typeof general.end_time === 'number' && general.end_time > 0 ? general.end_time : undefined,
    });
  }
  if (general.current_weekly_used_percent != null) {
    bars.push({
      label: '周限额',
      percent: toRatio(general.current_weekly_used_percent),
      resetAt:
        typeof general.weekly_end_time === 'number' && general.weekly_end_time > 0
          ? general.weekly_end_time
          : undefined,
    });
  }
  return { bars };
}

export function parseKimi(json: any): Pick<UsageCardData, 'bars'> {
  const bars: UsageBar[] = [];
  const h = json?.ratelimitCode5h;
  const w = json?.ratelimitCode7d;
  if (h && typeof h.ratio === 'number') {
    bars.push({
      label: '频限明细（5h）',
      percent: h.ratio,
      resetAt: h.resetTime ? Date.parse(h.resetTime) : undefined,
    });
  }
  if (w && typeof w.ratio === 'number') {
    bars.push({
      label: '本周用量',
      percent: w.ratio,
      resetAt: w.resetTime ? Date.parse(w.resetTime) : undefined,
    });
  }
  return { bars };
}

export function parseMimo(
  usage: any,
  detail: any,
): Pick<UsageCardData, 'bars' | 'planName' | 'note'> {
  const data = usage?.data ?? {};
  const planTotal =
    data?.usage?.items?.find((i: any) => i?.name === 'plan_total_token') ?? data?.usage?.items?.[0];
  const monthTotal = data?.monthUsage?.items?.[0];
  const bars: UsageBar[] = [];
  if (planTotal && typeof planTotal.percent === 'number') {
    bars.push({
      label: '套餐用量',
      percent: planTotal.percent,
      usedText: `${fmtInt(planTotal.used)} / ${fmtInt(planTotal.limit)}`,
    });
  }
  if (monthTotal && typeof monthTotal.percent === 'number') {
    bars.push({
      label: '月用量',
      percent: monthTotal.percent,
      usedText: `${fmtInt(monthTotal.used)} / ${fmtInt(monthTotal.limit)}`,
    });
  }
  const planName = detail?.data?.planName ? String(detail.data.planName) : undefined;
  const end = detail?.data?.currentPeriodEnd ? String(detail.data.currentPeriodEnd) : undefined;
  const note = planName && end ? `${planName} 套餐 · 有效期至 ${end}` : undefined;
  return { bars, planName, note };
}

export function parseVolc(
  afp: any,
  coding: any,
): Pick<UsageCardData, 'bars' | 'planName' | 'note' | 'status'> {
  const result = afp?.Result;
  const planType = typeof result?.PlanType === 'string' ? result.PlanType : '';
  const planName = planType
    ? `Agent Plan ${planType.charAt(0).toUpperCase()}${planType.slice(1)}`
    : 'Agent Plan';
  const bars: UsageBar[] = [];
  const sections: Array<[string, any]> = [
    ['近5小时', result?.AFPFiveHour],
    ['近一周', result?.AFPWeekly],
    ['近一月', result?.AFPMonthly],
  ];
  for (const [label, s] of sections) {
    if (!s || typeof s.Quota !== 'number' || s.Quota <= 0) continue;
    const used = typeof s.Used === 'number' ? s.Used : 0;
    bars.push({
      label,
      percent: used / s.Quota,
      usedText: `${fmtAfp(used)} / ${fmtAfp(s.Quota)}`,
      resetAt: typeof s.ResetTime === 'number' && s.ResetTime > 0 ? s.ResetTime : undefined,
    });
  }
  const codingStatus = coding?.Result?.Status;
  const reclaimed = codingStatus == null || codingStatus === 'Reclaimed' || codingStatus === 'Released';
  return {
    bars,
    planName,
    status: 'ok',
    note: reclaimed ? 'Coding Plan 未订阅（已回收）' : `Coding Plan ${String(codingStatus)}`,
  };
}

/** DNR rule injecting Cookie + x-csrf-token for volc ark APIs (fetch-dropped headers workaround). */
export function buildVolcDnrRule(cookieHeader: string, csrf: string, ruleId = 9101) {
  return {
    id: ruleId,
    priority: 1,
    action: {
      type: 'modifyHeaders' as const,
      requestHeaders: [
        { header: 'Cookie', operation: 'set' as const, value: cookieHeader },
        { header: 'x-csrf-token', operation: 'set' as const, value: csrf },
      ],
    },
    condition: {
      urlFilter: '||console.volcengine.com/api/top/ark/',
      resourceTypes: ['xmlhttprequest' as const],
    },
  };
}
