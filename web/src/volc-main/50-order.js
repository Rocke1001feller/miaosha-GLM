// Order creation and purchase-success notification for the Volcengine
// MAIN-world overlay.

async function tryOrder(product, indexKey) {
  const cookies = getCookies();
  const csrf = cookies['csrfToken'];
  const webId = cookies['monitor_huoshan_web_id'];
  if (!csrf || !webId) {
    setStatus('未登录，无法刷新库存');
    stopRefresh('未登录，已停止刷新');
    return { ok: false, retryable: false };
  }

  const tag = formatProductTag(product);

  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'x-csrf-token': csrf,
    'monitor-huoshan-web-id': webId,
    'x-language': 'zh',
    'x-use-bff-version': '1',
  };
  if (cookies['monitor_utm']) {
    headers['monitor-utm'] = cookies['monitor_utm'];
  }

  const body = JSON.stringify({
    IndexKey: indexKey,
    ConfigList: [product.raw.configBody],
    SignPay: true,
  });

  setStatus(tag + '正在尝试下单…');
  let res;
  try {
    res = await fetch(
      'https://www.volcengine.com/api/v2/top/activity/bill_volc_provider/CommonBuy/2020-01-01/cn-beijing',
      { method: 'POST', credentials: 'include', headers: headers, body: body },
    );
  } catch (e) {
    setStatus(tag + '网络异常，请稍后重试');
    return { ok: false, retryable: false };
  }
  const data = await res.json();
  const error = data.ResponseMetadata?.Error;
  if (error) {
    const isConfigError = error.Code === 'InvalidParameter.Configuration';
    const isStockError = error.Code === 'TransferError';
    if (isStockError) {
      setStatus(tag + '当前商品库存不足，暂不可下单');
    } else if (isConfigError) {
      setStatus(tag + '当前配置暂不可用');
    } else {
      setStatus(tag + '当前暂不可下单，请稍后重试');
    }
    return { ok: false, retryable: isConfigError, error: error };
  }
  const orderId = data.Result?.CustomerOrderID;
  if (!orderId) {
    setStatus(tag + '未返回订单信息，请稍后重试');
    return { ok: false, retryable: false };
  }
  setStatus('订单 ' + orderId + ' 已创建，正在跳转支付…');
  const payUrl = 'https://www.volcengine.com/activity/' + config.payPath + '?i_f=1&o_n=' +
    encodeURIComponent(orderId) + '&tik=' + encodeURIComponent(indexKey);
  playBeeps(3);
  postCmd('VOLC_PURCHASE_SUCCESS', {
    orderId: orderId,
    productId: product.id,
    productName: product.name,
    plan: config.title,
    payUrl: payUrl,
  });
  window.location.assign(payUrl);
  return { ok: true };
}

async function createOrder(productId) {
  if (!productId || !catalogData) return false;
  const all = [].concat(
    catalogData.groups.monthly,
    catalogData.groups.quarterly,
    catalogData.groups.yearly,
  );
  const product = all.find(function (p) { return p.id === productId; });
  if (!product || !product.raw) {
    setStatus('未找到套餐配置：' + productId);
    return false;
  }

  const raw = product.raw;
  const candidates = raw.indexKeyCandidates && raw.indexKeyCandidates.length
    ? raw.indexKeyCandidates.slice()
    : [raw.indexKey];

  for (let i = 0; i < candidates.length; i++) {
    const result = await tryOrder(product, candidates[i]);
    if (result.ok) return true;
    if (!result.retryable) return false;
    if (i < candidates.length - 1) {
      setStatus(formatProductTag(product) + '当前配置暂不可用，尝试其他索引…');
    }
  }
  return false;
}

// Initial extraction attempts.
(async function () {
  if (!(await extractAndSend())) {
    let attempts = 0;
    const timer = setInterval(async function () {
      attempts++;
      const ok = await extractAndSend();
      if (ok || attempts > 10) clearInterval(timer);
    }, 500);
  }
})();

setTimeout(vh_injectHeader, 800);
setTimeout(vh_injectHeader, 2500);
