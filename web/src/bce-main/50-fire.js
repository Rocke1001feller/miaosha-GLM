// Fire engine: iterate selected plans by priority, createOrder with
// classified error handling. Success -> cashier redirect (manual payment).

function bce_sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

function bce_productName(planType) {
  var p = BCE_CONFIG.products.find(function (x) {
    return x.planType === planType;
  });
  return p ? p.name : planType;
}

function bce_payUrl(orderId) {
  return (
    location.origin +
    '/finance/pay?serviceType=WENXINFACTORY&fromService=CODE_PLAN&orderType=NEW&orderId=' +
    encodeURIComponent(orderId)
  );
}

async function bce_startFire(reason) {
  if (bceState.phase === 'FIRING' || bceState.phase === 'SUCCESS') return;
  if (!bceState.selected.length) {
    bce_log('请先勾选商品');
    return;
  }
  bceState.attempts = 0;
  bce_setPhase('FIRING');
  clearTimeout(bceState.pollTimer);
  bce_log('开火（' + reason + '）…');
  var targets = bceState.selected.slice();
  var backoff = 0;
  while (
    bceState.phase === 'FIRING' &&
    bceState.attempts < BCE_CONFIG.maxFireAttempts
  ) {
    for (
      var i = 0;
      i < targets.length &&
      bceState.phase === 'FIRING' &&
      bceState.attempts < BCE_CONFIG.maxFireAttempts;
      i++
    ) {
      var planType = targets[i];
      bceState.attempts++;
      var result;
      try {
        result = await bce_createOrder(planType, bceState.autoRenew);
      } catch (e) {
        result = { kind: 'internal', message: String((e && e.message) || e) };
      }
      if (bceState.phase !== 'FIRING') return; // 手动停止后丢弃在途结果
      if (result.kind === 'success') {
        bce_onFireSuccess(result.orderId, planType);
        return;
      }
      if (result.kind === 'unpaid_exists') {
        bce_onFireSuccess('', planType, '已存在待支付订单，请直接完成支付');
        return;
      }
      if (result.kind === 'out_of_stock') {
        bce_log('第 ' + bceState.attempts + ' 发（' + bce_productName(planType) + '）：售罄，换下一档');
        continue;
      }
      if (result.kind === 'rate_limited' || result.kind === 'network') {
        backoff = Math.min(backoff + 1, 4);
        bce_log('[FIRE_FAIL] ' + result.kind + '，退避 ×' + backoff);
        await bce_sleep(BCE_CONFIG.fireIntervalMs + backoff * BCE_CONFIG.fireBackoffMs);
        continue;
      }
      // auth / http_error / unknown / internal：立即停手交人工
      bce_onFireFail(result);
      return;
    }
    if (bceState.phase === 'FIRING') await bce_sleep(BCE_CONFIG.fireIntervalMs);
  }
  if (bceState.phase === 'FIRING') {
    bce_onFireFail({ kind: 'exhausted' });
  }
}

function bce_onFireSuccess(orderId, planType, note) {
  bce_setPhase('SUCCESS');
  bce_playBeeps(3);
  var payUrl = orderId ? bce_payUrl(orderId) : '';
  bce_postCmd('BCE_PURCHASE_SUCCESS', {
    orderId: orderId || '',
    productName: bce_productName(planType),
    plan: BCE_CONFIG.title,
    payUrl: payUrl,
  });
  bce_log(
    '✅ 抢购成功（' + bce_productName(planType) + '）' +
      (orderId ? '，订单 ' + orderId : '') +
      (note ? '（' + note + '）' : ''),
  );
  if (typeof bce_uiShowResult === 'function') bce_uiShowResult(true, orderId, note || '', payUrl);
  // 有 orderId 时直接跳收银台（volc 式），由用户手动完成支付
  if (orderId) location.assign(payUrl);
}

function bce_onFireFail(result) {
  bce_setPhase('FAIL');
  bce_playBeeps(1);
  var hint = bce_failHint(result);
  bce_log('[FIRE_FAIL] ' + hint);
  if (typeof bce_uiShowResult === 'function') bce_uiShowResult(false, null, hint, '');
}

function bce_failHint(result) {
  switch (result && result.kind) {
    case 'auth':
      return '登录已失效，请刷新页面重新登录后重试';
    case 'rate_limited':
      return '持续限流，已停手；请稍后再试';
    case 'http_error':
      return '接口异常（HTTP ' + result.status + '），可能被风控拦截；请改用手动点击页面原生按钮';
    case 'exhausted':
      return '已达最大尝试次数仍未抢到；请改用手动点击页面原生按钮';
    case 'unknown':
      return '未知响应，已停手；请改用手动点击页面原生按钮';
    default:
      return '抢购失败：' + ((result && result.message) || (result && result.kind) || 'unknown');
  }
}
