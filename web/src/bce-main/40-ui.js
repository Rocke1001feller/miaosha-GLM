// Overlay UI: draggable card with phase lamp, multi-select product cards,
// fire toggle button, overwrite status line. Volc/ali style benchmark.

// PURE: merged fire/stop button label by phase.
function bce_fireButtonLabel(phase) {
  if (phase === 'FIRING') return '停止刷新库存';
  if (phase === 'SUCCESS') return '✅ 已抢到';
  return '开始刷新库存';
}

// PURE: read login display name from bce-login cookies (fallback: accountid).
function bce_readLoginName() {
  var cookies = bce_getCookies();
  if (!cookies['bce-login-accountid']) return '';
  var name = cookies['bce-login-display-name'] || '';
  try {
    name = decodeURIComponent(name);
  } catch (e) {}
  return name || String(cookies['bce-login-accountid']);
}

function bce_bindDrag(box, handle) {
  var sx = 0;
  var sy = 0;
  var ox = 0;
  var oy = 0;
  var dragging = false;
  handle.addEventListener('mousedown', function (e) {
    dragging = true;
    sx = e.clientX;
    sy = e.clientY;
    var r = box.getBoundingClientRect();
    ox = r.left;
    oy = r.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    box.style.left = ox + e.clientX - sx + 'px';
    box.style.top = oy + e.clientY - sy + 'px';
    box.style.right = 'auto';
  });
  document.addEventListener('mouseup', function () {
    dragging = false;
  });
}

function bce_productCardHtml(p, selected, soldOut) {
  return (
    '<div class="__bce_prod" data-pt="' + p.planType + '" style="display:flex;align-items:center;gap:8px;' +
    'padding:8px 10px;border:1.5px solid ' + (selected ? '#f53f3f' : 'rgba(12,18,36,.25)') + ';' +
    'border-radius:8px;cursor:pointer;background:' + (selected ? '#fff5f5' : '#fff') + ';">' +
    '<span class="__bce_prod_dot" style="width:10px;height:10px;border-radius:50%;flex-shrink:0;' +
    'border:1.5px solid ' + (selected ? '#f53f3f' : 'rgba(12,18,36,.35)') + ';' +
    'background:' + (selected ? '#f53f3f' : '#fff') + ';"></span>' +
    '<span style="font-weight:700;">' + p.name + '</span>' +
    '<span style="font-size:10px;color:#6a7496;">' + p.price + '</span>' +
    '<span class="__bce_soldout" style="margin-left:auto;font-size:10px;color:#9aa3b8;' +
    (soldOut ? '' : 'display:none;') + '">售罄</span></div>'
  );
}

function bce_buildOverlay() {
  if (document.getElementById('__bce_overlay')) return;
  var box = document.createElement('div');
  box.id = '__bce_overlay';
  box.style.cssText =
    'position:fixed;top:72px;right:16px;width:300px;z-index:999999;' +
    'background:#fff;border:1.5px solid #0c1224;border-radius:12px;' +
    'box-shadow:3px 3px 0 0 #0c1224;font:12px/1.5 -apple-system,"PingFang SC",sans-serif;' +
    'color:#0c1224;user-select:none;';
  var cardsHtml = '';
  for (var i = 0; i < BCE_CONFIG.products.length; i++) {
    var p = BCE_CONFIG.products[i];
    cardsHtml += bce_productCardHtml(p, bceState.selected.indexOf(p.planType) >= 0, false);
  }
  box.innerHTML =
    '<div id="__bce_hd" style="display:flex;align-items:center;justify-content:space-between;' +
    'padding:8px 10px;border-bottom:1.5px solid #0c1224;cursor:move;font-weight:800;">' +
    '<span>🚀 千帆 Token Plan 秒杀</span>' +
    '<span style="font:9px monospace;color:#6a7496;">v' + BCE_VERSION + '</span></div>' +
    '<div style="padding:10px;display:flex;flex-direction:column;gap:8px;">' +
    '<div style="display:flex;align-items:center;gap:6px;">' +
    '<span id="__bce_dot" style="width:8px;height:8px;border-radius:50%;background:#9aa3b8;"></span>' +
    '<span id="__bce_phase" style="font-weight:700;">初始化…</span>' +
    '<span id="__bce_login" style="margin-left:auto;font-size:10px;color:#6a7496;"></span></div>' +
    cardsHtml +
    '<div style="display:flex;gap:10px;font-size:11px;">' +
    '<label><input type="checkbox" id="__bce_autofire" checked> 到点自动开火</label>' +
    '<label><input type="checkbox" id="__bce_autorenew"> 连续包月</label></div>' +
    '<button id="__bce_fire" style="width:100%;padding:10px 0;background:#f53f3f;color:#fff;' +
    'border:1.5px solid #f53f3f;border-radius:8px;font-weight:800;font-size:13px;cursor:pointer;">开始刷新库存</button>' +
    '<div id="__bce_result" style="display:none;padding:8px;border-radius:8px;font-weight:700;"></div>' +
    '<div id="__bce_status" style="font:10px/1.5 monospace;color:#3a4358;min-height:15px;' +
    'background:#fafaf7;border:1px dashed rgba(12,18,36,.25);border-radius:6px;padding:4px 6px;' +
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>' +
    '</div>';
  document.body.appendChild(box);
  bce_bindDrag(box, document.getElementById('__bce_hd'));

  var cards = box.querySelectorAll('.__bce_prod');
  for (var j = 0; j < cards.length; j++) {
    cards[j].addEventListener('click', function () {
      bce_toggleProduct(this.getAttribute('data-pt'));
    });
  }
  document.getElementById('__bce_autofire').addEventListener('change', function (e) {
    bceState.autoFire = !!e.target.checked;
    bce_log('自动开火 ' + (bceState.autoFire ? '开' : '关'));
  });
  document.getElementById('__bce_autorenew').addEventListener('change', function (e) {
    bceState.autoRenew = !!e.target.checked;
    bce_log(bceState.autoRenew ? '连续包月' : '单月购买');
  });
  document.getElementById('__bce_fire').addEventListener('click', function () {
    if (bceState.phase === 'FIRING') bce_stopFire();
    else bce_startFire('manual');
  });
}

function bce_toggleProduct(planType) {
  var idx = bceState.selected.indexOf(planType);
  if (idx >= 0) {
    bceState.selected.splice(idx, 1);
  } else {
    if (bceState.selected.length >= BCE_CONFIG.maxSelections) {
      bce_log('最多选 ' + BCE_CONFIG.maxSelections + ' 个');
      return;
    }
    bceState.selected.push(planType);
  }
  // 重绘卡片选中态
  var cards = document.querySelectorAll('#__bce_overlay .__bce_prod');
  for (var i = 0; i < cards.length; i++) {
    var on = bceState.selected.indexOf(cards[i].getAttribute('data-pt')) >= 0;
    cards[i].style.border = '1.5px solid ' + (on ? '#f53f3f' : 'rgba(12,18,36,.25)');
    cards[i].style.background = on ? '#fff5f5' : '#fff';
    var dot = cards[i].querySelector('.__bce_prod_dot');
    if (dot) {
      dot.style.border = '1.5px solid ' + (on ? '#f53f3f' : 'rgba(12,18,36,.35)');
      dot.style.background = on ? '#f53f3f' : '#fff';
    }
  }
}

var BCE_PHASE_LABELS = {
  INIT: '初始化…',
  SOLD_OUT: '售罄 · 等待补货',
  ARMED: '开售窗口 · 高频刷新中',
  IN_STOCK: '检测到库存！',
  FIRING: '开火中…',
  SUCCESS: '抢购成功',
  FAIL: '已停手',
};

var BCE_PHASE_COLORS = {
  INIT: '#9aa3b8',
  SOLD_OUT: '#9aa3b8',
  ARMED: '#f59e0b',
  IN_STOCK: '#10b981',
  FIRING: '#ef4444',
  SUCCESS: '#10b981',
  FAIL: '#ef4444',
};

function bce_uiSetPhase(phase) {
  var el = document.getElementById('__bce_phase');
  if (el) el.textContent = BCE_PHASE_LABELS[phase] || phase;
  var dot = document.getElementById('__bce_dot');
  if (dot) dot.style.background = BCE_PHASE_COLORS[phase] || '#9aa3b8';
  var btn = document.getElementById('__bce_fire');
  if (btn) {
    btn.textContent = bce_fireButtonLabel(phase);
    var bg = phase === 'FIRING' ? '#0c1224' : phase === 'SUCCESS' ? '#10b981' : '#f53f3f';
    btn.style.background = bg;
    btn.style.borderColor = bg;
  }
}

// 覆盖式单条状态：只保留最新消息。
function bce_uiLog(line) {
  var el = document.getElementById('__bce_status');
  if (el) el.textContent = line;
}

// 售罄角标：库存接口返回后刷新各卡的「售罄」标记
function bce_uiStock(available) {
  if (!available) return;
  var cards = document.querySelectorAll('#__bce_overlay .__bce_prod');
  for (var i = 0; i < cards.length; i++) {
    var pt = cards[i].getAttribute('data-pt');
    var tag = cards[i].querySelector('.__bce_soldout');
    if (tag) tag.style.display = available[pt] === false ? '' : 'none';
  }
}

function bce_uiShowResult(ok, orderId, message, payUrl) {
  var el = document.getElementById('__bce_result');
  if (!el) return;
  el.style.display = 'block';
  if (ok) {
    el.style.background = '#d1fae5';
    el.style.color = '#065f46';
    el.innerHTML =
      '✅ ' + (orderId ? '订单 ' + orderId : message || '已抢到') +
      (payUrl
        ? ' · <a href="' + payUrl + '" target="_blank" style="color:#065f46;">去收银台支付 →</a>'
        : '');
  } else {
    el.style.background = '#fee2e2';
    el.style.color = '#991b1b';
    el.textContent = '⛔ ' + (message || '抢购失败');
  }
}

function bce_uiLogin(name) {
  var el = document.getElementById('__bce_login');
  if (!el) return;
  if (name) {
    el.textContent = '已登录 ' + name;
    el.style.color = '#10b981';
  } else {
    el.textContent = '未登录！';
    el.style.color = '#ef4444';
  }
}
