// /api/qianfan protocol layer (probed 2026-07-18, see spec §2).
// GETs need no signing; POSTs need a fresh csrftoken header per request.

async function bce_checkStock() {
  var res = await fetch('/api/qianfan/charge/tokenPlanPersonal/firstPurchaseConfig', {
    credentials: 'include',
  });
  var json = await res.json().catch(function () {
    return null;
  });
  return bce_parseStock(json);
}

// PURE: normalize firstPurchaseConfig -> { ok, available, times }
function bce_parseStock(json) {
  var result = (json && json.result) || {};
  var available = result.available;
  if (!json || json.success !== true || !available || typeof available !== 'object') {
    return { ok: false, available: {}, times: [] };
  }
  return {
    ok: true,
    available: available,
    times: Array.isArray(result.times) ? result.times : [],
  };
}

// PURE: order body, matching the page bundle's charge/order/new payload.
function bce_buildOrderBody(planType, autoRenew) {
  return {
    serviceType: 'WENXINFACTORY',
    productType: 'tokenPlanPersonal',
    autoRenew: !!autoRenew,
    items: [{ config: { planType: planType } }],
  };
}

// PURE: classify createOrder outcome. message may be a string or
// {global:<numeric biz code>}; human text may live in message_raw.
function bce_classifyOrderResult(httpStatus, json) {
  var rawMsg = json && json.message;
  var msg = typeof rawMsg === 'string' ? rawMsg : (rawMsg && rawMsg.global) || '';
  if (typeof msg !== 'string') msg = String(msg);
  var msgRaw = (json && json.message_raw) || '';
  if (typeof msgRaw !== 'string') msgRaw = String(msgRaw);
  var code = rawMsg && typeof rawMsg === 'object' ? rawMsg.global : null;
  var full = msg + ' ' + msgRaw;
  var result = json && json.result;
  var orderId = result && (result.orderId || result.order_id || (result.data && result.data.orderId));
  if (json && json.success === true && orderId) {
    return { kind: 'success', orderId: String(orderId), raw: json };
  }
  // 4004 = 有未支付的同类订单（实证 2026-07-18）
  if (code === 4004 || full.indexOf('未支付') >= 0 || full.indexOf('待支付') >= 0 || full.indexOf('同类订单') >= 0) {
    return { kind: 'unpaid_exists', message: msgRaw || msg, raw: json };
  }
  if (
    full.indexOf('售罄') >= 0 ||
    full.indexOf('库存') >= 0 ||
    full.indexOf('抢光') >= 0 ||
    full.indexOf('售完') >= 0 ||
    full.indexOf('无货') >= 0
  ) {
    return { kind: 'out_of_stock', message: msgRaw || msg, raw: json };
  }
  if (full.indexOf('登录凭证已过期') >= 0 || full.indexOf('重新登录') >= 0 || full.indexOf('未登录') >= 0) {
    return { kind: 'auth', status: httpStatus, message: msgRaw || msg, raw: json };
  }
  if (httpStatus === 429) return { kind: 'rate_limited', status: httpStatus, raw: json };
  if (httpStatus === 401 || httpStatus === 403) {
    return { kind: 'auth', status: httpStatus, message: msgRaw || msg, raw: json };
  }
  if (!json || httpStatus >= 400) return { kind: 'http_error', status: httpStatus, raw: json };
  return { kind: 'unknown', message: msgRaw || msg, code: code != null ? String(code) : undefined, raw: json };
}

async function bce_createOrder(planType, autoRenew) {
  var csrf = bce_readCsrf();
  var res;
  var json = null;
  try {
    res = await fetch('/api/qianfan/charge/order/new', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', csrftoken: csrf },
      body: JSON.stringify(bce_buildOrderBody(planType, autoRenew)),
    });
    json = await res.json().catch(function () {
      return null;
    });
  } catch (e) {
    return { kind: 'network', message: String((e && e.message) || e) };
  }
  return bce_classifyOrderResult(res.status, json);
}
