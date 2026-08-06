// Overlay UI: draggable card with phase lamp, product picker, fire toggle,
// and a single overwrite-style status line. Volc overlay is the style benchmark.

// 单月购买与连续包月本质是两种商品（autoRenew 字段不同），默认选中单月购买。
var ALI_PRODUCTS = [
  { id: 'single', name: '单月购买', desc: '¥200/月 · 到期不续费', autoRenew: false },
  { id: 'renew', name: '连续包月', desc: '¥200/月 · 自动续费，可取消', autoRenew: true },
];

// PURE: merged fire/stop button label by phase (volc-style wording).
function ali_fireButtonLabel(phase) {
  if (phase === 'FIRING') return '停止刷新库存';
  if (phase === 'SUCCESS') return '✅ 已抢到';
  return '开始刷新库存';
}

function ali_bindDrag(box, handle) {
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

function ali_productCardHtml(p, idx, selected) {
  return (
    '<div class="__ali_prod" data-idx="' + idx + '" style="display:flex;align-items:center;gap:8px;' +
    'padding:8px 10px;border:1.5px solid ' + (selected ? '#f53f3f' : 'rgba(12,18,36,.25)') + ';' +
    'border-radius:8px;cursor:pointer;background:' + (selected ? '#fff5f5' : '#fff') + ';">' +
    '<span class="__ali_prod_dot" style="width:10px;height:10px;border-radius:50%;flex-shrink:0;' +
    'border:1.5px solid ' + (selected ? '#f53f3f' : 'rgba(12,18,36,.35)') + ';' +
    'background:' + (selected ? '#f53f3f' : '#fff') + ';"></span>' +
    '<span style="font-weight:700;">' + p.name + '</span>' +
    '<span style="margin-left:auto;font-size:10px;color:#6a7496;">' + p.desc + '</span></div>'
  );
}

function ali_buildOverlay() {
  if (document.getElementById('__ali_overlay')) return;
  var box = document.createElement('div');
  box.id = '__ali_overlay';
  box.style.cssText =
    'position:fixed;top:72px;right:16px;width:300px;z-index:999999;' +
    'background:#fff;border:1.5px solid #0c1224;border-radius:12px;' +
    'box-shadow:3px 3px 0 0 #0c1224;font:12px/1.5 -apple-system,"PingFang SC",sans-serif;' +
    'color:#0c1224;user-select:none;';
  var cardsHtml = '';
  for (var i = 0; i < ALI_PRODUCTS.length; i++) {
    cardsHtml += ali_productCardHtml(ALI_PRODUCTS[i], i, i === 0);
  }
  box.innerHTML =
    '<div id="__ali_hd" style="display:flex;align-items:center;justify-content:space-between;' +
    'padding:8px 10px;border-bottom:1.5px solid #0c1224;cursor:move;font-weight:800;">' +
    '<span>🚀 百炼 Coding Plan 秒杀</span>' +
    '<span style="font:9px monospace;color:#6a7496;">v' + ALI_VERSION + '</span></div>' +
    '<div style="padding:10px;display:flex;flex-direction:column;gap:8px;">' +
    '<div style="display:flex;align-items:center;gap:6px;">' +
    '<span id="__ali_dot" style="width:8px;height:8px;border-radius:50%;background:#9aa3b8;"></span>' +
    '<span id="__ali_phase" style="font-weight:700;">初始化…</span>' +
    '<span id="__ali_login" style="margin-left:auto;font-size:10px;color:#6a7496;"></span></div>' +
    cardsHtml +
    '<label style="font-size:11px;"><input type="checkbox" id="__ali_autofire" checked> 到点自动开火（补货瞬间）</label>' +
    '<button id="__ali_fire" style="width:100%;padding:10px 0;background:#f53f3f;color:#fff;' +
    'border:1.5px solid #f53f3f;border-radius:8px;font-weight:800;font-size:13px;cursor:pointer;">开始刷新库存</button>' +
    '<div id="__ali_result" style="display:none;padding:8px;border-radius:8px;font-weight:700;"></div>' +
    '<div id="__ali_status" style="font:10px/1.5 monospace;color:#3a4358;min-height:15px;' +
    'background:#fafaf7;border:1px dashed rgba(12,18,36,.25);border-radius:6px;padding:4px 6px;' +
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>' +
    '</div>';
  document.body.appendChild(box);
  ali_bindDrag(box, document.getElementById('__ali_hd'));

  var cards = box.querySelectorAll('.__ali_prod');
  for (var j = 0; j < cards.length; j++) {
    cards[j].addEventListener('click', function () {
      ali_selectProduct(Number(this.getAttribute('data-idx')));
    });
  }
  // 默认选中第一个商品（单月购买）
  aliState.autoRenew = ALI_PRODUCTS[0].autoRenew;

  document.getElementById('__ali_autofire').addEventListener('change', function (e) {
    aliState.autoFire = !!e.target.checked;
    ali_log('自动开火 ' + (aliState.autoFire ? '开' : '关'));
  });
  document.getElementById('__ali_fire').addEventListener('click', function () {
    if (aliState.phase === 'FIRING') ali_stopFire();
    else ali_startFire('manual');
  });
}

function ali_selectProduct(idx) {
  var p = ALI_PRODUCTS[idx];
  if (!p) return;
  aliState.autoRenew = p.autoRenew;
  var cards = document.querySelectorAll('#__ali_overlay .__ali_prod');
  for (var i = 0; i < cards.length; i++) {
    var on = i === idx;
    cards[i].style.border = '1.5px solid ' + (on ? '#f53f3f' : 'rgba(12,18,36,.25)');
    cards[i].style.background = on ? '#fff5f5' : '#fff';
    var dot = cards[i].querySelector('.__ali_prod_dot');
    if (dot) {
      dot.style.border = '1.5px solid ' + (on ? '#f53f3f' : 'rgba(12,18,36,.35)');
      dot.style.background = on ? '#f53f3f' : '#fff';
    }
  }
  ali_log('已选：' + p.name);
}

var ALI_PHASE_LABELS = {
  INIT: '初始化…',
  SOLD_OUT: '售罄 · 等待补货',
  ARMED: '已锁定补货时刻',
  IN_STOCK: '检测到库存！',
  FIRING: '开火中…',
  SUCCESS: '抢购成功',
  FAIL: '已停手',
};

var ALI_PHASE_COLORS = {
  INIT: '#9aa3b8',
  SOLD_OUT: '#9aa3b8',
  ARMED: '#f59e0b',
  IN_STOCK: '#10b981',
  FIRING: '#ef4444',
  SUCCESS: '#10b981',
  FAIL: '#ef4444',
};

function ali_uiSetPhase(phase) {
  var el = document.getElementById('__ali_phase');
  if (el) el.textContent = ALI_PHASE_LABELS[phase] || phase;
  var dot = document.getElementById('__ali_dot');
  if (dot) dot.style.background = ALI_PHASE_COLORS[phase] || '#9aa3b8';
  var btn = document.getElementById('__ali_fire');
  if (btn) {
    btn.textContent = ali_fireButtonLabel(phase);
    var bg = phase === 'FIRING' ? '#0c1224' : phase === 'SUCCESS' ? '#10b981' : '#f53f3f';
    btn.style.background = bg;
    btn.style.borderColor = bg;
  }
}

// 覆盖式单条状态：只保留最新消息（日志没有意义，逐条追加只会刷屏）。
function ali_uiLog(line) {
  var el = document.getElementById('__ali_status');
  if (el) el.textContent = line;
}

function ali_uiShowResult(ok, orderId, message) {
  var el = document.getElementById('__ali_result');
  if (!el) return;
  el.style.display = 'block';
  if (ok) {
    el.style.background = '#d1fae5';
    el.style.color = '#065f46';
    el.innerHTML =
      '✅ ' + (orderId ? '订单 ' + orderId : message || '已抢到') +
      ' · <a href="' + ALI_CONFIG.consoleUrl + '" target="_blank" style="color:#065f46;">去控制台支付 →</a>';
  } else {
    el.style.background = '#fee2e2';
    el.style.color = '#991b1b';
    el.textContent = '⛔ ' + (message || '抢购失败');
  }
}

function ali_uiLogin(name) {
  var el = document.getElementById('__ali_login');
  if (!el) return;
  if (name) {
    el.textContent = '已登录 ' + name;
    el.style.color = '#10b981';
  } else {
    el.textContent = '未登录！';
    el.style.color = '#ef4444';
  }
}

async function ali_checkLogin() {
  try {
    var res = await fetch('https://bridge.aliyun.com/abs/home/queryUserBaseInfo', {
      credentials: 'include',
    });
    var json = await res.json().catch(function () {
      return null;
    });
    var name = json && json.success && json.data && json.data.userNick;
    ali_uiLogin(name || null);
  } catch (e) {
    ali_uiLogin(null);
  }
}
