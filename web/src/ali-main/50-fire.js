// Fire engine: createOrder loop with classified error handling.

function ali_sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

async function ali_startFire(reason) {
  if (aliState.phase === 'FIRING' || aliState.phase === 'SUCCESS') return;
  var freshTokens = ali_readTokens();
  if (freshTokens.umidToken) aliState.tokens = freshTokens;
  aliState.attempts = 0;
  ali_setPhase('FIRING');
  clearTimeout(aliState.pollTimer);
  clearTimeout(aliState.fireTimer);
  aliState.fireTimer = 0;
  ali_log('开火（' + reason + '）…');
  var submitref = await ali_buildSecurityParam();
  var backoff = 0;
  while (aliState.phase === 'FIRING' && aliState.attempts < ALI_CONFIG.maxFireAttempts) {
    aliState.attempts++;
    var result;
    try {
      result = await ali_createOrder(aliState.autoRenew, submitref, aliState.tokens);
    } catch (e) {
      result = { kind: 'internal', message: String((e && e.message) || e) };
    }
    if (aliState.phase !== 'FIRING') return; // 手动停止后丢弃在途结果
    if (result.kind === 'success') {
      ali_onFireSuccess(result.orderId);
      return;
    }
    if (result.kind === 'unpaid_exists') {
      ali_onFireSuccess('', '已存在待支付订单，请直接完成支付');
      return;
    }
    if (result.kind === 'out_of_stock') {
      ali_log('第 ' + aliState.attempts + ' 发：售罄，继续');
      await ali_sleep(ALI_CONFIG.fireIntervalMs);
      continue;
    }
    if (result.kind === 'rate_limited' || result.kind === 'network') {
      backoff = Math.min(backoff + 1, 4);
      ali_log('[FIRE_FAIL] ' + result.kind + '，退避 ×' + backoff);
      await ali_sleep(ALI_CONFIG.fireIntervalMs + backoff * ALI_CONFIG.fireBackoffMs);
      continue;
    }
    // auth / http_error / unknown：可能触发风控，立即停手交人工
    ali_onFireFail(result);
    return;
  }
  if (aliState.phase === 'FIRING') {
    ali_onFireFail({ kind: 'exhausted' });
  }
}

function ali_onFireSuccess(orderId, note) {
  ali_setPhase('SUCCESS');
  ali_playBeeps(3);
  ali_postCmd('ALI_PURCHASE_SUCCESS', {
    orderId: orderId || '',
    productName: ALI_CONFIG.title,
    plan: ALI_CONFIG.title,
    payUrl: ALI_CONFIG.consoleUrl,
  });
  ali_log('✅ 抢购成功' + (orderId ? '，订单 ' + orderId : '') + (note ? '（' + note + '）' : ''));
  if (typeof ali_uiShowResult === 'function') ali_uiShowResult(true, orderId, note || '');
}

function ali_onFireFail(result) {
  ali_setPhase('FAIL');
  ali_playBeeps(1);
  var hint = ali_failHint(result);
  ali_log('[FIRE_FAIL] ' + hint);
  if (typeof ali_uiShowResult === 'function') ali_uiShowResult(false, null, hint);
}

function ali_failHint(result) {
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
      return '未知响应（' + (result.code || 'no-code') + '），已停手；如需继续请手动操作';
    default:
      return '抢购失败：' + ((result && result.message) || (result && result.kind) || 'unknown');
  }
}
