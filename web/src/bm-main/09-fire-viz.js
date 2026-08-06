// ── 09-fire-viz.js ── Fire Matrix: Mode + Strategy process visualizer
// Opens automatically on FIRE_BATCH_START.

var _fv_logEl    = null;
var _fv_cursor   = null;
var _fv_autoScr  = true;
var _fv_lineNo   = 0;
var _fv_counts   = { success: 0, busy: 0, soldout: 0, error: 0, neterr: 0, captchaService: 0, captchaInvalid: 0, captchaRisk: 0 };
var _fv_startMs  = 0;
var _fv_total    = 0;
var _fv_done     = 0;
var _fv_logLines = [];
var _fv_meta     = null;
var _fv_dotEls   = {};
var _fv_rowEls   = {};
var _fv_shotsData = [];
var _fv_waveCount = 0;
var _fv_nextShotIdx = 0;
var _fv_currentWaveStartIdx = 0;

var _FV_OUTCOME = {
  success:        { user: '成功',     dev: 'ORDER',                  color: '#059669', icon: '✓' },
  busy:           { user: '限流',     dev: '555 / server busy',      color: '#d97706', icon: '⚠' },
  soldout:        { user: '售罄',     dev: 'sold-out',               color: '#64748b', icon: '⊘' },
  error:          { user: '错误',     dev: 'code=N / serverMsg',     color: '#dc2626', icon: '✗' },
  neterr:         { user: '网络错误', dev: 'net-err',                color: '#dc2626', icon: '⚡' },
  captchaService: { user: '验证码繁忙', dev: 'Captcha QPS limit',    color: '#7c3aed', icon: '☁' },
  captchaInvalid: { user: '验证码失效', dev: 'Invalid ticket',       color: '#ea580c', icon: '◎' },
  captchaRisk:    { user: '验证码风控', dev: 'Risk control',         color: '#be123c', icon: '⚡' }
};

function _fv_escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function _fv_pad2(n) { return n < 10 ? '0' + n : '' + n; }
function _fv_pad3(n) { return n < 10 ? '00' + n : n < 100 ? '0' + n : '' + n; }

function _fv_formatTs(d) {
  return _fv_pad2(d.getHours()) + ':' + _fv_pad2(d.getMinutes()) + ':' +
         _fv_pad2(d.getSeconds()) + '.' + _fv_pad3(d.getMilliseconds());
}

function _fv_productName(productId) {
  try {
    var p = findProductById(productId);
    if (p && p.name) return p.name;
  } catch (e) {}
  return productId ? productId.slice(-6) : '?';
}

function _fv_buildCSS() {
  return [
    '<style id="__bm_fv_css">',
    '@keyframes fvFlicker{0%,100%{opacity:1}50%{opacity:.65}}',
    '@keyframes fvBlink{0%,100%{opacity:1}50%{opacity:0}}',
    '@keyframes fvPulse{0%{box-shadow:0 0 0 0 rgba(16,185,129,.45)}100%{box-shadow:0 0 0 8px rgba(16,185,129,0)}}',
    '#__bm_fv *{box-sizing:border-box}',
    '#__bm_fv ::-webkit-scrollbar{width:4px}',
    '#__bm_fv ::-webkit-scrollbar-thumb{background:rgba(99,102,241,.25);border-radius:99px}',
    '#__bm_fv .fv-row:hover{background:rgba(99,102,241,.05)}',
    '#__bm_fv .fv-dot.pending{background:#e2e8f0;border-color:#e2e8f0}',
    '#__bm_fv .fv-stat:hover{background:rgba(255,255,255,.6)}',
    '#__bm_fv_chain{border-top:1px solid #f1f5f9}',
    '#__bm_fv_chain_h{padding:6px 14px;font-size:9px;font-weight:700;color:#6366f1;cursor:pointer;display:flex;align-items:center;gap:6px;background:rgba(99,102,241,.03)}',
    '#__bm_fv_chain_ht{font-size:9px;font-weight:800;color:#1e293b;margin-left:4px}',
    '#__bm_fv_chain_b{padding:8px 14px 10px;display:none;max-height:110px;overflow-y:auto}',
    '#__bm_fv_chain.open #__bm_fv_chain_b{display:block}',
    '#__bm_fv_chain.open #__bm_fv_chain_h .fv-ch-chev{transform:rotate(90deg)}',
    '.fv-ch-flow{display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:8px}',
    '.fv-ch-step{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:54px;max-width:64px}',
    '.fv-ch-num{width:16px;height:16px;border-radius:50%;display:grid;place-items:center;font-size:8px;font-weight:800;color:#fff;background:#94a3b8}',
    '.fv-ch-num.ok{background:#10b981}',
    '.fv-ch-num.err{background:#dc2626}',
    '.fv-ch-num.busy{background:#d97706}',
    '.fv-ch-name{font-size:8px;font-weight:700;color:#475569;text-align:center;line-height:1.2}',
    '.fv-ch-arrow{color:#cbd5e1;font-size:10px}',
    '.fv-ch-tags{display:flex;gap:2px;flex-wrap:wrap;justify-content:center}',
    '.fv-ch-tag{font-size:6px;font-weight:800;padding:1px 4px;border-radius:3px}',
    '.fv-ch-tag.e500{background:#fee2e2;color:#dc2626;border:1px solid #fecaca}',
    '.fv-ch-tag.e555{background:#fef3c7;color:#d97706;border:1px solid #fde68a}',
    '.fv-ch-tag.e200{background:#f0fdf4;color:#059669;border:1px solid #a7f3d0}',
    '.fv-ch-tag.e401{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}',
    '.fv-ch-legend{margin-top:8px;padding-top:6px;border-top:1px dashed #e2e8f0;font-size:8px;color:#64748b;line-height:1.5}',
    '.fv-warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e}',
    '@media (prefers-color-scheme:dark){',
    '#__bm_fv{background:rgba(15,23,42,.92)!important;border-color:rgba(71,85,105,.72)!important}',
    '#__bm_fv_h{background:rgba(99,102,241,.08)!important;border-bottom-color:rgba(71,85,105,.72)!important}',
    '#__bm_fv_meta,#__bm_fv_st{color:#94a3b8!important}',
    '#__bm_fv_log,#__bm_fv_timeline,#__bm_fv .fv-stat-wrap{background:rgba(2,6,23,.55)!important;border-color:rgba(71,85,105,.55)!important}',
    '#__bm_fv .fv-row{background:rgba(255,255,255,.03)!important}',
    '#__bm_fv_chain_h{color:#a5b4fc!important;background:rgba(99,102,241,.08)!important}',
    '#__bm_fv_chain_ht{color:#f8fafc!important}',
    '#__bm_fv_chain_b{background:rgba(2,6,23,.45)!important}',
    '.fv-ch-name{color:#cbd5e1!important}',
    '.fv-ch-arrow{color:#475569!important}',
    '.fv-ch-legend{color:#94a3b8!important;border-color:rgba(71,85,105,.55)!important}',
    '.fv-warn{background:rgba(120,53,15,.35)!important;border-color:rgba(252,211,77,.25)!important;color:#fde68a!important}',
    '}',
    '</style>'
  ].join('');
}

function _fv_buildHTML() {
  return _fv_buildCSS() + [
    '<div id="__bm_fv" style="',
      'position:fixed;right:20px;bottom:20px;',
      'z-index:2147483646;width:420px;max-height:calc(100vh - 40px);',
      'background:rgba(255,255,255,.97);',
      '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);',
      'border:1px solid #e2e8f0;',
      'border-radius:16px;',
      'box-shadow:0 8px 32px rgba(0,0,0,.15);',
      "font-family:'SF Mono','Fira Code','Consolas',monospace;",
      'overflow:hidden;user-select:none;color:#1e293b;display:flex;flex-direction:column;"',
    '>',

    // Header
    '<div id="__bm_fv_h" style="',
      'background:rgba(99,102,241,.06);',
      'padding:10px 14px;cursor:move;',
      'display:flex;align-items:center;gap:8px;',
      'border-bottom:1px solid #e2e8f0"',
    '>',
    '<span style="font-size:15px;display:inline-block;animation:fvFlicker .5s ease-in-out infinite alternate">🔥</span>',
    '<span style="font-size:11px;font-weight:800;color:#6366f1;letter-spacing:.1em;text-transform:uppercase;flex:1">Fire Matrix</span>',
    '<span style="font-size:8px;font-weight:800;color:#6366f1;background:rgba(99,102,241,.1);padding:1px 6px;border-radius:999px;border:1px solid rgba(99,102,241,.2);margin-right:4px">v2.0.0</span>',
    '<span id="__bm_fv_wave" style="font-size:9px;font-weight:800;color:#fff;background:#6366f1;padding:2px 7px;border-radius:999px">Wave 1</span>',
    '<span id="__bm_fv_cnt" style="font-size:9px;color:#475569;margin-right:6px">0/0 shots</span>',
    '<button id="__bm_fv_cls" style="',
      'width:18px;height:18px;border-radius:50%;',
      'border:1px solid #e2e8f0;',
      'background:#f8fafc;color:#64748b;',
      'cursor:pointer;font-size:9px;display:grid;place-items:center;transition:all .15s"',
    '>✕</button>',
    '</div>',

    // Progress bar
    '<div style="height:3px;background:#e2e8f0">',
    '<div id="__bm_fv_pb" style="height:100%;width:0%;background:linear-gradient(90deg,#6366f1,#10b981);transition:width .3s"></div>',
    '</div>',

    // Meta strip
    '<div id="__bm_fv_meta" style="padding:8px 14px;font-size:9px;color:#475569;display:flex;gap:10px;flex-wrap:wrap;border-bottom:1px solid #f1f5f9">',
    '等待任务开始…',
    '</div>',

    // Dot strip
    '<div style="padding:10px 14px 6px">',
    '<div id="__bm_fv_dots" style="display:flex;flex-wrap:wrap;gap:3px;max-height:54px;overflow-y:auto"></div>',
    '</div>',

    // Timeline
    '<div id="__bm_fv_timeline" style="padding:0 14px 8px;height:140px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">',
    '</div>',

    // Stats strip
    '<div class="fv-stat-wrap" style="margin:0 14px 10px;padding:6px 10px;',
      'background:#f8fafc;',
      'border-radius:10px;border:1px solid #e2e8f0;',
      'display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:space-between"',
    '>',
    '<div class="fv-stat" id="__bm_fv_ss" style="display:flex;align-items:center;gap:4px;font-size:10px;padding:3px 8px;border-radius:999px;background:#fff;border:1px solid #e2e8f0;color:#059669;transition:background .15s">',
      '<span>✓</span><span>成功</span><b style="min-width:14px;text-align:center">0</b>',
    '</div>',
    '<div class="fv-stat" id="__bm_fv_sb" style="display:flex;align-items:center;gap:4px;font-size:10px;padding:3px 8px;border-radius:999px;background:#fff;border:1px solid #e2e8f0;color:#d97706;transition:background .15s">',
      '<span>⚠</span><span>限流</span><b style="min-width:14px;text-align:center">0</b>',
    '</div>',
    '<div class="fv-stat" id="__bm_fv_se" style="display:flex;align-items:center;gap:4px;font-size:10px;padding:3px 8px;border-radius:999px;background:#fff;border:1px solid #e2e8f0;color:#dc2626;transition:background .15s">',
      '<span>✗</span><span>错误</span><b style="min-width:14px;text-align:center">0</b>',
    '</div>',
    '<div class="fv-stat" id="__bm_fv_sd" style="display:flex;align-items:center;gap:4px;font-size:10px;padding:3px 8px;border-radius:999px;background:#fff;border:1px solid #e2e8f0;color:#64748b;transition:background .15s">',
      '<span>⊘</span><span>售罄</span><b style="min-width:14px;text-align:center">0</b>',
    '</div>',
    '<div class="fv-stat" id="__bm_fv_sc" style="display:flex;align-items:center;gap:4px;font-size:10px;padding:3px 8px;border-radius:999px;background:#fff;border:1px solid #e2e8f0;color:#7c3aed;transition:background .15s">',
      '<span>☁</span><span>验证码</span><b style="min-width:14px;text-align:center">0</b>',
    '</div>',
    '<div class="fv-warn" style="display:flex;align-items:center;gap:4px;font-size:9px;padding:3px 8px;border-radius:999px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;white-space:nowrap">',
      '<span>⚠</span><span>10:00 智谱→→腾讯验证码QPS超限→→ 500</span>',
    '</div>',
    '<span id="__bm_fv_st" style="font-size:9px;color:#94a3b8;margin-left:auto">0ms</span>',
    '</div>',

    // Console
    '<div style="border-top:1px solid #f1f5f9">',
    '<div style="display:flex;align-items:center;padding:8px 14px 4px;gap:6px">',
    '<span style="font-size:9px;color:#6366f1;font-weight:700;letter-spacing:.06em">▸ FIRE CONSOLE</span>',
    '<span style="flex:1"></span>',
    '<button id="__bm_fv_cpy" style="font-size:8px;color:#6366f1;border:1px solid rgba(99,102,241,.25);background:rgba(99,102,241,.06);border-radius:4px;padding:2px 7px;cursor:pointer;font-weight:700">COPY</button>',
    '<button id="__bm_fv_dwn" style="font-size:8px;color:#6366f1;border:1px solid rgba(99,102,241,.25);background:rgba(99,102,241,.06);border-radius:4px;padding:2px 7px;cursor:pointer;font-weight:700">DOWN</button>',
    '<button id="__bm_fv_json" style="font-size:8px;color:#6366f1;border:1px solid rgba(99,102,241,.25);background:rgba(99,102,241,.06);border-radius:4px;padding:2px 7px;cursor:pointer;font-weight:700">JSON</button>',
    '<button id="__bm_fv_asc" style="font-size:8px;color:#6366f1;border:1px solid rgba(99,102,241,.25);background:rgba(99,102,241,.06);border-radius:4px;padding:2px 7px;cursor:pointer;font-weight:700">AUTO ↓</button>',
    '<button id="__bm_fv_clr" style="font-size:8px;color:#64748b;border:1px solid #e2e8f0;background:#f8fafc;border-radius:4px;padding:2px 7px;cursor:pointer;font-weight:700">CLR</button>',
    '</div>',
    '<div id="__bm_fv_log" style="',
      'height:120px;overflow-y:auto;',
      'font-size:10px;line-height:1.6;',
      'background:#f8fafc;padding:6px 8px;',
      'margin:0 14px 12px;border-radius:8px;',
      'border:1px solid #e2e8f0;color:#334155"',
    '>',
    '<span id="__bm_fv_cur" style="color:#6366f1;animation:fvBlink 1s step-end infinite">█</span>',
    '</div>',
    '</div>',

    // Call Chain
    '<div id="__bm_fv_chain">',
    '<div id="__bm_fv_chain_h">',
      '<span class="fv-ch-chev" style="font-size:9px;transition:transform .15s">▸</span>',
      '<span>CALL CHAIN /pay/preview</span>',
      '<span id="__bm_fv_chain_ht">智谱内部订单生成API内部调用链路</span>',
      '<span style="flex:1"></span>',
      '<span style="font-size:8px;color:#94a3b8;font-weight:500">点击展开</span>',
    '</div>',
    '<div id="__bm_fv_chain_b">',
      '<div class="fv-ch-flow">',
        '<div class="fv-ch-step"><span class="fv-ch-num">1</span><span class="fv-ch-name">智谱用户认证Auth</span><span class="fv-ch-tags"><span class="fv-ch-tag e401">401</span></span></div>',
        '<span class="fv-ch-arrow">→</span>',
        '<div class="fv-ch-step"><span class="fv-ch-num err">2</span><span class="fv-ch-name">智谱接口内部调用<br>腾讯云验证码校验接口</span><span class="fv-ch-tags"><span class="fv-ch-tag e500">500</span></span></div>',
        '<span class="fv-ch-arrow">→</span>',
        '<div class="fv-ch-step"><span class="fv-ch-num busy">3</span><span class="fv-ch-name">智谱限流</span><span class="fv-ch-tags"><span class="fv-ch-tag e555">555</span></span></div>',
        '<span class="fv-ch-arrow">→</span>',
        '<div class="fv-ch-step"><span class="fv-ch-num">4</span><span class="fv-ch-name">库存检查</span><span class="fv-ch-tags"><span class="fv-ch-tag e200">sold-out</span></span></div>',
        '<span class="fv-ch-arrow">→</span>',
        '<div class="fv-ch-step"><span class="fv-ch-num ok">5</span><span class="fv-ch-name">锁单成功</span><span class="fv-ch-tags"><span class="fv-ch-tag e200">bizId</span></span></div>',
      '</div>',
      '<div class="fv-ch-legend">',
        '① 认证失败时返回 401；② 智谱内部调用腾讯云 Captcha 票据校验接口，失败返回 500（含 QPS 超限）；③ 智谱 2s 滑动窗口限流返回 555；④ 商品售罄返回 sold-out；⑤ 成功返回 bizId。',
      '</div>',
    '</div>',
    '</div>',

    '</div>'
  ].join('');
}

function _fv_show(data) {
  var existing = document.getElementById('__bm_fv');
  var isAppend = !!existing;

  if (!existing) {
    var tmp = document.createElement('div');
    tmp.innerHTML = _fv_buildHTML();
    while (tmp.firstChild) document.body.appendChild(tmp.firstChild);

    _fv_logEl   = document.getElementById('__bm_fv_log');
    _fv_cursor  = document.getElementById('__bm_fv_cur');
    _fv_lineNo  = 0;
    _fv_logLines = [];
    _fv_shotsData = [];
    _fv_counts  = { success: 0, busy: 0, soldout: 0, error: 0, neterr: 0, captchaService: 0, captchaInvalid: 0, captchaRisk: 0 };
    _fv_startMs = Date.now();
    _fv_total   = 0;
    _fv_done    = 0;
    _fv_autoScr = true;
    _fv_meta    = data || {};
    _fv_dotEls  = {};
    _fv_rowEls  = {};
    _fv_waveCount = 0;
    _fv_nextShotIdx = 0;
    _fv_currentWaveStartIdx = 0;

    _fv_bindEvents();
  }

  var chainWrap = document.getElementById('__bm_fv_chain');
  if (chainWrap) chainWrap.classList.remove('open');

  var waveShots = (data && data.totalShots) || 0;
  _fv_currentWaveStartIdx = _fv_nextShotIdx;
  _fv_nextShotIdx += waveShots;
  _fv_total += waveShots;
  _fv_waveCount++;
  _fv_meta = data || _fv_meta || {};

  _fv_renderDots(_fv_currentWaveStartIdx, waveShots);
  _fv_updateWaveBadge();
  _fv_updateMeta();
  _fv_updateProgress();
  _fv_updateStats();

  _fv_addLine('▶ Wave ' + _fv_waveCount + ' · ' + waveShots + ' shots', '#6366f1');
  _fv_addLine('  CONFIG ' + JSON.stringify({
    mode: data.mode,
    burstIntervalMs: data.burstIntervalMs,
    totalShots: data.totalShots,
    startMs: data.startMs
  }), '#94a3b8');
}

function _fv_updateWaveBadge() {
  var badge = document.getElementById('__bm_fv_wave');
  if (badge) badge.textContent = 'Wave ' + _fv_waveCount;
}

function _fv_renderDots(startIdx, count) {
  var wrap = document.getElementById('__bm_fv_dots');
  if (!wrap) return;
  for (var i = 0; i < count; i++) {
    var globalIdx = startIdx + i;
    var d = document.createElement('div');
    d.id = '__bm_fv_d_' + globalIdx;
    d.className = 'fv-dot pending';
    d.style.cssText = 'width:10px;height:10px;border-radius:2px;border:1px solid #e2e8f0;background:#e2e8f0;transition:all .25s';
    d.title = '#' + (globalIdx + 1) + ' 待发射';
    wrap.appendChild(d);
    _fv_dotEls[globalIdx] = d;
  }
}

function _fv_updateDot(shotIdx, outcome) {
  var d = _fv_dotEls[shotIdx];
  if (!d) return;
  var m = _FV_OUTCOME[outcome] || _FV_OUTCOME.error;
  d.style.background = m.color;
  d.style.borderColor = m.color;
  d.style.boxShadow = '0 0 4px ' + m.color + '50';
  d.className = 'fv-dot';
  d.title = '#' + (shotIdx + 1) + ' ' + m.user;
  if (outcome === 'success') {
    d.style.animation = 'fvPulse .6s ease-out forwards';
    setTimeout(function(el) { return function() { el.style.animation = ''; }; }(d), 700);
  }
}

function _fv_updateMeta() {
  var el = document.getElementById('__bm_fv_meta');
  if (!el || !_fv_meta) return;
  var mode = _fv_meta.mode === 'manual' ? 'MANUAL' : (_fv_meta.mode === 'burst' ? 'BURST' : 'AUTO');
  var interval = (_fv_meta.burstIntervalMs || 2100) + 'ms';
  var parts = [
    'Wave <b style="color:#1e293b">' + _fv_waveCount + '</b>',
    'Mode: <b style="color:#1e293b">' + mode + '</b>',
    _fv_total + ' shots',
    'interval: <b style="color:#1e293b">' + interval + '</b>'
  ];
  el.innerHTML = parts.join(' <span style="color:#cbd5e1">·</span> ');
}

function _fv_updateProgress() {
  var cnt = document.getElementById('__bm_fv_cnt');
  if (cnt) cnt.textContent = _fv_done + '/' + _fv_total + ' shots';
  var pb = document.getElementById('__bm_fv_pb');
  if (pb && _fv_total > 0) pb.style.width = Math.round(_fv_done / _fv_total * 100) + '%';
}

function _fv_userResultText(outcome, code, serverMsg) {
  var m = _FV_OUTCOME[outcome] || _FV_OUTCOME.error;
  var txt = m.user;
  if (serverMsg) {
    if (String(serverMsg).charAt(0) === '【') txt += ': ' + serverMsg;
    else if (outcome === 'error' || outcome === 'neterr') txt += ': ' + serverMsg;
  }
  return txt;
}

function _fv_addTimelineRow(d) {
  var wrap = document.getElementById('__bm_fv_timeline');
  if (!wrap) return;

  var idx = d.shotIdx;
  var m = _FV_OUTCOME[d.outcome] || _FV_OUTCOME.error;
  var name = _fv_productName(d.productId);
  var ticketMask = d.ticketMask || '—';
  var rttText = typeof d.rtt === 'number' ? d.rtt + 'ms' : '';
  var resultText = _fv_userResultText(d.outcome, d.code, d.serverMsg);

  var row = document.createElement('div');
  row.id = '__bm_fv_r_' + idx;
  row.className = 'fv-row';
  row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,.5);font-size:10px;transition:background .15s';
  row.innerHTML =
    '<span style="color:#94a3b8;min-width:22px">#' + (idx + 1) + '</span>' +
    '<span style="color:#64748b;min-width:18px">P' + (d.priority || '?') + '</span>' +
    '<span style="color:#1e293b;min-width:34px;font-weight:700">' + _fv_escHtml(name) + '</span>' +
    '<span style="color:#94a3b8;font-size:9px">' + _fv_escHtml(ticketMask) + '</span>' +
    '<span style="color:' + m.color + ';min-width:14px;text-align:center">' + m.icon + '</span>' +
    '<span style="color:' + m.color + ';flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _fv_escHtml(resultText) + '</span>' +
    (rttText ? '<span style="color:#94a3b8;font-size:9px">' + rttText + '</span>' : '');

  var tip = d.productId + ' · priority ' + (d.priority || '?');
  if (typeof d.code === 'number') tip += ' · code ' + d.code;
  if (d.responsibility) {
    tip += '\n责任: ' + d.responsibility.subject + ' --> ' + d.responsibility.target;
    tip += '\n原因: ' + d.responsibility.cause;
  }
  if (d.rawServerMsg) tip += '\nraw: ' + d.rawServerMsg;
  else if (d.serverMsg) tip += '\n' + d.serverMsg;
  row.title = tip;

  _fv_rowEls[idx] = row;

  // Rebuild in shot order
  wrap.innerHTML = '';
  var keys = Object.keys(_fv_rowEls).map(Number).sort(function(a, b) { return a - b; });
  for (var i = 0; i < keys.length; i++) {
    wrap.appendChild(_fv_rowEls[keys[i]]);
  }
  wrap.scrollTop = wrap.scrollHeight;
}

function _fv_updateStats() {
  var ss = document.getElementById('__bm_fv_ss');
  if (ss) ss.querySelector('b').textContent = String(_fv_counts.success);
  var sb = document.getElementById('__bm_fv_sb');
  if (sb) sb.querySelector('b').textContent = String(_fv_counts.busy);
  var se = document.getElementById('__bm_fv_se');
  if (se) se.querySelector('b').textContent = String(_fv_counts.error + _fv_counts.neterr);
  var sd = document.getElementById('__bm_fv_sd');
  if (sd) sd.querySelector('b').textContent = String(_fv_counts.soldout);
  var sc = document.getElementById('__bm_fv_sc');
  if (sc) sc.querySelector('b').textContent = String(_fv_counts.captchaService + _fv_counts.captchaInvalid + _fv_counts.captchaRisk);
  var st = document.getElementById('__bm_fv_st');
  if (st) st.textContent = (Date.now() - _fv_startMs) + 'ms';
}

function _fv_addLine(text, color) {
  var lg = document.getElementById('__bm_fv_log');
  if (!lg) return;
  _fv_lineNo++;
  var ts = _fv_formatTs(new Date());
  var lineText = '[' + ts + '] ' + text;
  _fv_logLines.push(lineText);

  var row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:5px;align-items:baseline';
  row.innerHTML =
    '<span style="color:#cbd5e1;font-size:9px;min-width:18px;text-align:right;flex-shrink:0">' + _fv_lineNo + '</span>' +
    '<span style="color:#94a3b8;font-size:9px;flex-shrink:0">[' + ts + ']</span>' +
    '<span style="color:' + (color || '#475569') + ';word-break:break-all">' + _fv_escHtml(text) + '</span>';
  var cur = document.getElementById('__bm_fv_cur');
  if (cur && cur.parentNode === lg) {
    lg.insertBefore(row, cur);
  } else {
    lg.appendChild(row);
  }
  if (_fv_autoScr) lg.scrollTop = lg.scrollHeight;
}

function _fv_copyLog() {
  var text = _fv_logLines.join('\n');
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(function() {});
  } else {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }
}

function _fv_downloadLog() {
  var text = _fv_logLines.join('\n');
  if (!text) return;
  var blob = new Blob([text + '\n'], { type: 'text/plain' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'fire-matrix-log-' + Date.now() + '.txt';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

function _fv_downloadJson() {
  var payload = {
    meta: {
      exportedAt: Date.now(),
      mode: _fv_meta.mode || 'unknown',
      burstIntervalMs: _fv_meta.burstIntervalMs || 0,
      totalShots: _fv_total,
      startMs: _fv_meta.startMs || _fv_startMs,
      elapsedMs: Date.now() - _fv_startMs
    },
    counts: _fv_counts,
    shots: _fv_shotsData,
    logs: _fv_logLines
  };
  var blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'fire-matrix-data-' + Date.now() + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

function _fv_clearLog() {
  var lg = document.getElementById('__bm_fv_log');
  if (lg) {
    lg.innerHTML = '<span id="__bm_fv_cur" style="color:#6366f1;animation:fvBlink 1s step-end infinite">█</span>';
    _fv_cursor = document.getElementById('__bm_fv_cur');
    _fv_lineNo = 0;
    _fv_logLines = [];
    _fv_shotsData = [];
  }
}

function _fv_bindEvents() {
  var cls = document.getElementById('__bm_fv_cls');
  if (cls) cls.addEventListener('click', function() {
    var ov = document.getElementById('__bm_fv');
    if (ov) ov.parentNode && ov.parentNode.removeChild(ov);
    var css = document.getElementById('__bm_fv_css');
    if (css) css.parentNode && css.parentNode.removeChild(css);
  });

  var cpy = document.getElementById('__bm_fv_cpy');
  if (cpy) cpy.addEventListener('click', _fv_copyLog);

  var dwn = document.getElementById('__bm_fv_dwn');
  if (dwn) dwn.addEventListener('click', _fv_downloadLog);

  var json = document.getElementById('__bm_fv_json');
  if (json) json.addEventListener('click', _fv_downloadJson);

  var asc = document.getElementById('__bm_fv_asc');
  if (asc) asc.addEventListener('click', function() {
    _fv_autoScr = !_fv_autoScr;
    asc.style.color       = _fv_autoScr ? '#6366f1' : '#64748b';
    asc.style.borderColor = _fv_autoScr ? 'rgba(99,102,241,.25)' : '#e2e8f0';
    asc.style.background  = _fv_autoScr ? 'rgba(99,102,241,.06)' : '#f8fafc';
  });

  var clr = document.getElementById('__bm_fv_clr');
  if (clr) clr.addEventListener('click', _fv_clearLog);

  var chainHead = document.getElementById('__bm_fv_chain_h');
  var chainWrap = document.getElementById('__bm_fv_chain');
  if (chainHead && chainWrap) {
    chainHead.addEventListener('click', function() {
      chainWrap.classList.toggle('open');
    });
  }

  var hd = document.getElementById('__bm_fv_h');
  var ov = document.getElementById('__bm_fv');
  if (hd && ov) {
    var ox = 0, oy = 0, left = 0, top = 0, dragging = false;
    hd.addEventListener('mousedown', function(e) {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true;
      ox = e.clientX; oy = e.clientY;
      var r = ov.getBoundingClientRect();
      left = r.left; top = r.top;
      ov.style.transition = 'none';
      ov.style.transform  = 'none';
      ov.style.left       = left + 'px';
      ov.style.top        = top  + 'px';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      var o = document.getElementById('__bm_fv');
      if (!o) { dragging = false; return; }
      o.style.left = (left + e.clientX - ox) + 'px';
      o.style.top  = (top  + e.clientY - oy) + 'px';
    });
    document.addEventListener('mouseup', function() { dragging = false; });
  }
}

window.addEventListener('message', function(e) {
  if (!e.data || !e.data.__miaosha_overlay) return;
  var d = e.data;

  if (d.type === 'FIRE_BATCH_START') {
    _fv_show(d.data);
    return;
  }

  if (!document.getElementById('__bm_fv')) return;

  if (d.type === 'FIRE_SHOT_RESULT' && d.data) {
    var outcome = d.data.outcome || 'error';
    if (_fv_counts[outcome] !== undefined) _fv_counts[outcome]++;
    else _fv_counts.error++;
    _fv_done++;
    var shotData = d.data;
    var localIdx = typeof shotData.shotIdx === 'number' ? shotData.shotIdx : (_fv_done - 1 - _fv_currentWaveStartIdx);
    var globalIdx = _fv_currentWaveStartIdx + localIdx;
    shotData.shotIdx = globalIdx;
    _fv_shotsData.push(shotData);
    _fv_updateDot(globalIdx, outcome);
    _fv_addTimelineRow(shotData);
    _fv_updateStats();
    _fv_updateProgress();
    return;
  }

  if (d.type === 'FIRE_RESULT') {
    var line = d.line || '';
    var lc = '#475569';
    if (line.indexOf('ORDER') !== -1 || line.indexOf('bizId') !== -1) lc = '#059669';
    else if (line.indexOf('sold-out') !== -1)                          lc = '#64748b';
    else if (line.indexOf('555') !== -1 || line.indexOf('busy') !== -1) lc = '#d97706';
    else if (line.indexOf('captchaService') !== -1 || line.indexOf('captchaInvalid') !== -1 || line.indexOf('captchaRisk') !== -1) lc = '#7c3aed';
    else if (line.indexOf('err') !== -1 || line.indexOf('block') !== -1 || line.indexOf('failed') !== -1) lc = '#dc2626';
    _fv_addLine('→ ' + line, lc);
    return;
  }

  if (d.type === 'BURST_FIRE_SUCCESS' && d.data) {
    var biz = d.data.bizId ? String(d.data.bizId).slice(-8) : '?';
    _fv_addLine('✔ ORDER SUCCESS · native pay dialog opened · bizId=' + biz, '#059669');
    var cur1 = document.getElementById('__bm_fv_cur');
    if (cur1) { cur1.style.color = '#059669'; cur1.style.animation = ''; }
    return;
  }

  if (d.type === 'STRIKE_PAYMENT_SUCCESS' && d.data) {
    var orderId2 = d.data.orderId ? String(d.data.orderId).slice(-8) : '?';
    _fv_addLine('✔ Payment confirmed · orderId=' + orderId2, '#059669');
    return;
  }

  if (d.type === 'STRIKE_PAYMENT_EXPIRED' && d.data) {
    var orderId3 = d.data.orderId ? String(d.data.orderId).slice(-8) : '?';
    _fv_addLine('⊘ Payment expired · orderId=' + orderId3, '#d97706');
    return;
  }

  if (d.type === 'STRIKE_PAYMENT_TIMEOUT' && d.data) {
    var orderId4 = d.data.orderId ? String(d.data.orderId).slice(-8) : '?';
    _fv_addLine('⊘ Payment status timeout · orderId=' + orderId4, '#64748b');
    return;
  }

  if (d.type === 'BURST_FIRE_DEPLETED') {
    var tot = (d.data && d.data.total) || 0;
    _fv_addLine('⊘ Depleted — ' + tot + ' shots, no order', '#dc2626');
    var cur2 = document.getElementById('__bm_fv_cur');
    if (cur2) { cur2.style.color = '#64748b'; cur2.style.animation = ''; }
    return;
  }

  if (d.type === 'PREFIRE_STATUS' && d.data && !d.data.ok) {
    _fv_addLine('⊘ Prefire blocked: ' + (d.data.reason || 'unknown'), '#dc2626');
    var cur3 = document.getElementById('__bm_fv_cur');
    if (cur3) { cur3.style.color = '#dc2626'; cur3.style.animation = ''; }
  }
});
