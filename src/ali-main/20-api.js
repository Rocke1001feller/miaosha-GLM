// buy-api.aliyun.com protocol layer (probed 2026-07-17, see spec §2).
// Everything runs in the page's MAIN world with credentials:'include'.

function ali_readTokens() {
  var w = window;
  return {
    umidToken: (typeof w.getUmidToken === 'function' && w.getUmidToken()) || '',
    collina: (typeof w.getUA === 'function' && w.getUA()) || '',
  };
}

async function ali_waitTokens(retries, delayMs) {
  for (var i = 0; i < retries; i++) {
    var t = ali_readTokens();
    if (t.umidToken && t.collina) return t;
    await new Promise(function (r) {
      setTimeout(r, delayMs);
    });
  }
  return ali_readTokens();
}

async function ali_apiPost(path, body) {
  var res = await fetch(ALI_CONFIG.apiBase + path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  var json = await res.json().catch(function () {
    return null;
  });
  return { status: res.status, json: json };
}

async function ali_getCsrfToken() {
  try {
    var res = await fetch(ALI_CONFIG.apiBase + '/getCsrfToken.json', { credentials: 'include' });
    if (!res.ok) return '';
    var json = await res.json();
    return (json && String(json.code) === '200' && json.data) || '';
  } catch (e) {
    return '';
  }
}

async function ali_buildSecurityParam() {
  try {
    var r = await ali_apiPost('/order/buildSecurityParam.json', {
      commodityCode: ALI_CONFIG.commodityCode,
      skuId: ALI_CONFIG.skuId,
    });
    return (r.json && r.json.data && r.json.data.submitref) || '';
  } catch (e) {
    return '';
  }
}

// Matches the page's configuration payload captured on 2026-07-17.
function ali_buildConfiguration(autoRenew, tokens) {
  return {
    commodityCode: ALI_CONFIG.commodityCode,
    specCode: ALI_CONFIG.commodityCode,
    commodityName: '百炼 Coding Plan 国际站',
    chargeType: 'PREPAY',
    chargeTypeTitle: '预付费',
    autoRenew: !!autoRenew,
    orderType: 'BUY',
    quantity: 1,
    orderParams: {
      fromPage: location.href,
      paidCallBack: ALI_CONFIG.consoleUrl,
      order_created_by: 'lx_commonBuy',
      pricing_trigger_type: 'default',
      init_price_query: 'init',
      has_triggered_error: false,
      umidToken: tokens.umidToken,
      userAgent: navigator.userAgent,
      cna: ali_getCna(),
      needUnavailableCoupon: '1',
      queryGetCouponActivity: false,
    },
    pricingCycle: 'Month',
    duration: '1',
    pricingCycleTitle: '个月',
    config: {
      order_time: { min: 1, max: 12, step: 1, unit: 'Month' },
      supportAutoRenew: true,
      canChannelAutoRenew: true,
      orderType: 'BUY',
      showTilePrice: false,
      order_num: null,
      regionCode: null,
    },
    components: [
      {
        componentCode: 'subscription_type',
        componentName: '订阅套餐',
        instanceProperty: [{ code: 'subscription_type', name: 'Pro', value: ALI_CONFIG.skuId }],
      },
    ],
    isMainDataMode: '',
    couponForSpecItem: true,
    couponNum: 'default',
  };
}

// PURE: inventory response -> { inStock, restockTs, buyAmount }
function ali_parseInventory(json) {
  var list = json && json.data;
  if (!Array.isArray(list) || list.length === 0) {
    return { inStock: false, restockTs: null, buyAmount: null };
  }
  var item = list[0] || {};
  var inStock =
    item.success === true && typeof item.inventoryNum === 'number' && item.inventoryNum > 0;
  var restockTs =
    !inStock && typeof item.restockingTimeStamp === 'number' && item.restockingTimeStamp > 0
      ? item.restockingTimeStamp
      : null;
  return {
    inStock: inStock,
    restockTs: restockTs,
    buyAmount: typeof item.buyAmount === 'number' ? item.buyAmount : null,
  };
}

async function ali_checkInventory(autoRenew, tokens) {
  var r = await ali_apiPost('/commodity/checkInventoryDetail.json', {
    configuration: ali_buildConfiguration(autoRenew, tokens),
    withCreateOrderValidation: true,
    channel: 'commonbuy',
    withAgreement: true,
  });
  return ali_parseInventory(r.json);
}

// PURE: createOrder body, matching the page bundle's pe() shape.
function ali_buildOrderBody(autoRenew, submitref, tokens) {
  var configuration = ali_buildConfiguration(autoRenew, tokens);
  configuration.orderIndex = 0;
  return {
    configuration: configuration,
    couponNum: 'default',
    umidToken: tokens.umidToken,
    collina: tokens.collina,
    channel: 'commonbuy',
    'bx-umidtoken': tokens.umidToken,
    submitref: submitref || '',
    linkage: ali_linkage(ALI_CONFIG.commodityCode),
  };
}

// PURE: classify createOrder outcome.
function ali_classifyOrderResult(httpStatus, json) {
  var code = json && json.code != null ? String(json.code) : '';
  var data = (json && json.data) || {};
  var msg = (json && (json.message || data.message)) || '';
  if (typeof msg !== 'string') msg = String(msg);
  if (code === '200' && data.orderId) {
    return { kind: 'success', orderId: String(data.orderId), raw: json };
  }
  if (
    code === 'OutOfStock' ||
    code === 'B6000000571' ||
    (json && json.standardErrorCode === 'B6000000571') ||
    msg.indexOf('售罄') >= 0 ||
    msg.indexOf('库存不足') >= 0
  ) {
    return { kind: 'out_of_stock', message: msg, raw: json };
  }
  if (code === 'ORDER.INST_HAS_UNPAID_ORDER' || msg.indexOf('未支付') >= 0) {
    return { kind: 'unpaid_exists', message: msg, raw: json };
  }
  if (httpStatus === 429) return { kind: 'rate_limited', status: httpStatus, raw: json };
  if (httpStatus === 401 || httpStatus === 403 || code === 'LOGIN_REQUIRED' || msg.indexOf('登录') >= 0) {
    return { kind: 'auth', status: httpStatus, message: msg, raw: json };
  }
  if (!json || httpStatus >= 400) return { kind: 'http_error', status: httpStatus, raw: json };
  return { kind: 'unknown', code: code, message: msg, raw: json };
}

async function ali_createOrder(autoRenew, submitref, tokens) {
  var csrf = await ali_getCsrfToken();
  var headers = { 'Content-Type': 'application/json' };
  if (csrf) headers['X-XSRF-TOKEN'] = csrf;
  var res;
  var json = null;
  try {
    res = await fetch(ALI_CONFIG.apiBase + '/order/createOrder.json', {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify(ali_buildOrderBody(autoRenew, submitref, tokens)),
    });
    json = await res.json().catch(function () {
      return null;
    });
  } catch (e) {
    return { kind: 'network', message: String((e && e.message) || e) };
  }
  return ali_classifyOrderResult(res.status, json);
}
