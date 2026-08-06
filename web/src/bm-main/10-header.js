// ── L1 Header Injection ──
// Injects a slim L1 information strip into bigmodel.cn page header
// (.pc-header-nav-left) showing: physical time / auth identity.
// Sources of truth:
//   - SALE_TIME_CONFIG message → target time + delta + state
//   - local cookie/localStorage (poll 3s) → cookie/user/product status pills
//
// This module is decoupled from 08-overlay.js; it owns its own message
// listener, CSS, and DOM elements. The overlay's Preparations/Runtime
// cards no longer carry L1 fields (refactor scope per CLAUDE.md).

var H1 = '__bm_h1';
var H1_CSS_ID = '__bm_h1_css';

// Local cached state (we don't share _rt from 02-state.js: bm-main modules
// are concatenated into one IIFE and _rt is a file-local name there)
var _h1_rt = {
  nextSaleTime: 0,
  cfg: null,           // { hour, minute, second, ms, timezone }
  hasProducts: false,
};

// ── CSS ──
function _h1_buildCSS() {
  return [
    '<style id="' + H1_CSS_ID + '">',
    // Pulse animation for status dots
    '@keyframes bmhPulse{0%,100%{opacity:1}50%{opacity:.45}}',
    '@keyframes bmhLatPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.85);opacity:.65}}',
    // Root container: sits flush inside the site header, no own background
    '#' + H1 + '{',
    'display:flex;align-items:center;gap:14px;flex:1;min-width:0;',
    'margin:0 16px 0 0;',
    'padding:0;',
    'font-family:Inter,system-ui,sans-serif;',
    'color:#334155',
    '}',
    // Time stack: one column, three rows
    '#' + H1 + ' .bmh-t{',
    'display:flex;flex-direction:column;gap:3px;',
    'min-width:0;flex-shrink:0',
    '}',
    '#' + H1 + ' .bmh-tr{',
    'display:flex;align-items:baseline;gap:8px;',
    'min-width:0;line-height:1.25',
    '}',
    '#' + H1 + ' .bmh-tl{',
    'width:44px;flex-shrink:0;',
    'font-size:9px;font-weight:700;',
    'color:#94a3b8;letter-spacing:.04em;',
    'text-transform:uppercase',
    '}',
    '#' + H1 + ' .bmh-tv{',
    'font-size:12px;font-weight:700;',
    'font-family:"SF Mono","Fira Code",Consolas,monospace;',
    'white-space:nowrap;min-width:88px',
    '}',
    '#' + H1 + ' .bmh-tz,#' + H1 + ' .bmh-ts{',
    'font-size:9px;font-weight:600;',
    'font-family:"SF Mono",Consolas,monospace;',
    'color:#94a3b8',
    '}',
    // Color distinction for the three time rows
    '#' + H1 + ' .bmh-tr.now .bmh-tv{color:#0f172a}',
    '#' + H1 + ' .bmh-tr.tgt .bmh-tv{color:#6366f1}',
    '#' + H1 + ' .bmh-tr.delta .bmh-tv.delta-ok{color:#10b981}',
    '#' + H1 + ' .bmh-tr.delta .bmh-tv.delta-soon{color:#f59e0b}',
    '#' + H1 + ' .bmh-tr.delta .bmh-tv.delta-now{color:#dc2626}',
    '#' + H1 + ' .bmh-tr.delta .bmh-tv.delta-passed{color:#94a3b8}',
    // State badge attached to delta row
    '#' + H1 + ' .bmh-state{',
    'font-size:8px;font-weight:800;letter-spacing:.04em;',
    'text-transform:uppercase;',
    'padding:1px 5px;border-radius:4px;',
    'margin-left:2px;white-space:nowrap',
    '}',
    '#' + H1 + ' .bmh-state.ok{background:#dcfce7;color:#15803d}',
    '#' + H1 + ' .bmh-state.soon{background:#fef3c7;color:#b45309}',
    '#' + H1 + ' .bmh-state.now{background:#fee2e2;color:#b91c1c}',
    '#' + H1 + ' .bmh-state.passed{background:#f1f5f9;color:#64748b}',
    // Status dot (shared by auth pills)
    '#' + H1 + ' .bmh-dot{',
    'width:8px;height:8px;border-radius:50%;',
    'background:#cbd5e1;flex-shrink:0',
    '}',
    '#' + H1 + ' .bmh-dot.calibrated{animation:bmhLatPulse 1.4s ease-in-out infinite}',
    '#' + H1 + ' .bmh-dot.ok{background:#10b981}',
    '#' + H1 + ' .bmh-dot.warn{background:#f59e0b}',
    '#' + H1 + ' .bmh-dot.fail{background:#dc2626}',
    // Auth block: all items share equal width
    '#' + H1 + ' .bmh-auth{',
    'display:flex;align-items:center;gap:8px;',
    'flex:1;min-width:0;justify-content:flex-end',
    '}',
    '#' + H1 + ' .bmh-auth>*{',
    'flex:1 1 0;min-width:0;max-width:120px;',
    'box-sizing:border-box',
    '}',
    '#' + H1 + ' .bmh-pill{',
    'display:flex;align-items:center;gap:5px;',
    'padding:3px 8px 3px 6px;',
    'background:transparent;',
    'border:1px solid transparent;',
    'border-radius:20px;',
    'transition:all .15s',
    '}',
    '#' + H1 + ' .bmh-pill:hover{background:rgba(148,163,184,.08)}',
    '#' + H1 + ' .bmh-pill.ok{border-color:rgba(16,185,129,.35);background:rgba(220,252,231,.25)}',
    '#' + H1 + ' .bmh-pill.warn{border-color:rgba(245,158,11,.35);background:rgba(254,243,199,.25)}',
    '#' + H1 + ' .bmh-pill.fail{border-color:rgba(220,38,38,.35);background:rgba(254,226,226,.25)}',
    '#' + H1 + ' .bmh-pill-body{',
    'display:flex;flex-direction:column;gap:0;min-width:0;flex:1',
    '}',
    '#' + H1 + ' .bmh-pill-label{',
    'font-size:9px;font-weight:700;color:#475569;line-height:1.2;',
    'text-transform:uppercase;letter-spacing:.03em',
    '}',
    '#' + H1 + ' .bmh-pill-status{',
    'font-size:8px;font-weight:700;line-height:1.2;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
    '}',
    '#' + H1 + ' .bmh-pill.ok .bmh-pill-status{color:#15803d}',
    '#' + H1 + ' .bmh-pill.warn .bmh-pill-status{color:#b45309}',
    '#' + H1 + ' .bmh-pill.fail .bmh-pill-status{color:#b91c1c}',
    // Login link (shown when auth is incomplete) – same height/shape as pills
    '#' + H1 + ' .bmh-login{',
    'display:inline-flex;align-items:center;justify-content:center;',
    'font-size:10px;font-weight:700;color:#dc2626;',
    'text-decoration:none;padding:3px 8px;',
    'border:1px solid #fecaca;border-radius:20px;',
    'background:#fef2f2;',
    'white-space:nowrap;cursor:pointer',
    '}',
    '#' + H1 + ' .bmh-login:hover{background:#fee2e2}',
    // Options button (opens extension options page)
    '#' + H1 + ' .bmh-opts{',
    'display:inline-flex;align-items:center;justify-content:center;',
    'width:26px;height:26px;border-radius:6px;border:1px solid rgba(148,163,184,.3);',
    'background:rgba(255,255,255,.5);color:#64748b;font-size:14px;cursor:pointer;',
    'margin-left:8px;transition:all .15s;flex-shrink:0',
    '}',
    '#' + H1 + ' .bmh-opts:hover{background:rgba(99,102,241,.1);border-color:rgba(99,102,241,.4);color:#6366f1}',
    '#' + H1 + ' .bmh-opts:active{transform:translateY(1px)}',
    // Test Pay button (opens native payment dialog for a pre-flight check)
    '#' + H1 + ' .bmh-test{color:#059669;border-color:rgba(5,150,105,.35);background:rgba(240,253,244,.5)}',
    '#' + H1 + ' .bmh-test:hover{background:rgba(5,150,105,.1);border-color:rgba(5,150,105,.5);color:#047857}',
    // Unified rich tooltips
    '#' + H1 + ' [data-tip]{position:relative}',
    '#' + H1 + ' [data-tip]::after{',
    'content:attr(data-tip);',
    'position:absolute;top:calc(100% + 5px);left:0;',
    'z-index:100001;',
    'min-width:180px;max-width:280px;',
    'padding:8px 10px;',
    'background:rgba(15,23,42,.95);',
    'color:#f8fafc;border-radius:8px;',
    'font-size:10px;font-weight:500;line-height:1.45;',
    'font-family:Inter,system-ui,sans-serif;',
    'white-space:pre-line;word-break:break-word;',
    'box-shadow:0 4px 12px rgba(0,0,0,.2);',
    'pointer-events:none;opacity:0;visibility:hidden;',
    'transition:opacity .12s ease,visibility .12s ease',
    '}',
    '#' + H1 + ' [data-tip]:hover::after{opacity:1;visibility:visible}',
    '#' + H1 + ' [data-tip]::before{',
    'content:"";position:absolute;top:calc(100% + 1px);left:10px;',
    'border:4px solid transparent;border-bottom-color:rgba(15,23,42,.95);',
    'pointer-events:none;opacity:0;visibility:hidden;',
    'transition:opacity .12s ease,visibility .12s ease',
    '}',
    '#' + H1 + ' [data-tip]:hover::before{opacity:1;visibility:visible}',
    '</style>'
  ].join('');
}

// ── HTML structure ──
function _h1_buildHTML() {
  return [
    // 1.2 Time stack (single column, three rows)
    '<div class="bmh-t">',
      '<div class="bmh-tr now" id="bmh-now-row" data-tip="">',
        '<div class="bmh-tl">Now</div>',
        '<div class="bmh-tv" id="bmh-now">--:--:--.---</div>',
        '<div class="bmh-tz" id="bmh-tz">+00:00</div>',
      '</div>',
      '<div class="bmh-tr tgt" id="bmh-tgt-row" data-tip="">',
        '<div class="bmh-tl">Target</div>',
        '<div class="bmh-tv" id="bmh-tgt">--:--:--.---</div>',
        '<div class="bmh-tz" id="bmh-tgtz">+08:00</div>',
      '</div>',
      '<div class="bmh-tr delta" id="bmh-delta-row" data-tip="">',
        '<div class="bmh-tl">Delta</div>',
        '<div class="bmh-tv" id="bmh-delta">--:--:--.---</div>',
        '<span class="bmh-state ok" id="bmh-state">pending</span>',
      '</div>',
    '</div>',
    // 1.1 Auth pills
    '<div class="bmh-auth">',
      '<div class="bmh-pill" id="bmh-ck" data-tip="">',
        '<div class="bmh-dot" id="bmh-ck-dot"></div>',
        '<div class="bmh-pill-body">',
          '<div class="bmh-pill-label">Cookie</div>',
          '<div class="bmh-pill-status" id="bmh-ck-status">checking</div>',
        '</div>',
      '</div>',
      '<div class="bmh-pill" id="bmh-ui" data-tip="">',
        '<div class="bmh-dot" id="bmh-ui-dot"></div>',
        '<div class="bmh-pill-body">',
          '<div class="bmh-pill-label">User</div>',
          '<div class="bmh-pill-status" id="bmh-ui-status">checking</div>',
        '</div>',
      '</div>',
      '<div class="bmh-pill" id="bmh-pi" data-tip="">',
        '<div class="bmh-dot" id="bmh-pi-dot"></div>',
        '<div class="bmh-pill-body">',
          '<div class="bmh-pill-label">Product</div>',
          '<div class="bmh-pill-status" id="bmh-pi-status">checking</div>',
        '</div>',
      '</div>',
      '<a class="bmh-login" id="bmh-login" data-tip="Click to open site login modal" style="display:none">Login</a>',
    '</div>',
    '<button class="bmh-opts bmh-test" id="bmh-test" title="Test native payment dialog" data-tip="模拟抢购成功，提前验证原生支付弹窗能否正常拉起">&#128260;</button>',
    '<button class="bmh-opts" id="bmh-opts" title="Extension options">&#9881;</button>',
  ].join('');
}

// ── Time formatting helpers ──
function _h1_pad(n, w) {
  n = String(Math.abs(Math.round(n)));
  while (n.length < w) n = '0' + n;
  return n;
}

function _h1_formatLocalWithMs(d) {
  return _h1_pad(d.getHours(), 2) + ':' +
         _h1_pad(d.getMinutes(), 2) + ':' +
         _h1_pad(d.getSeconds(), 2) + '.' +
         _h1_pad(d.getMilliseconds(), 3);
}

function _h1_formatTzOffset(d) {
  var offMin = -d.getTimezoneOffset(); // east positive
  var sign = offMin >= 0 ? '+' : '-';
  var abs = Math.abs(offMin);
  return sign + _h1_pad(Math.floor(abs / 60), 2) + ':' + _h1_pad(abs % 60, 2);
}

function _h1_formatInTzWithMs(epochMs, tz) {
  var parts = {};
  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(epochMs)).forEach(function (p) {
      if (p.type !== 'literal') parts[p.type] = p.value;
    });
  } catch (e) {
    return '--:--:--.---';
  }
  var ms = new Date(epochMs).getUTCMilliseconds();
  return _h1_pad(parts.hour, 2) + ':' +
         _h1_pad(parts.minute, 2) + ':' +
         _h1_pad(parts.second, 2) + '.' +
         _h1_pad(ms, 3);
}

function _h1_formatDelta(ms) {
  var sign = ms < 0 ? '-' : '+';
  var abs = Math.abs(ms);
  var h = Math.floor(abs / 3600000);
  var m = Math.floor((abs % 3600000) / 60000);
  var s = Math.floor((abs % 60000) / 1000);
  var mil = abs % 1000;
  return sign + _h1_pad(h, 2) + ':' +
         _h1_pad(m, 2) + ':' +
         _h1_pad(s, 2) + '.' +
         _h1_pad(mil, 3);
}

function _h1_formatTzLabel(tz) {
  try {
    var ref = Date.now();
    var d = new Date(ref);
    var parts = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(d).forEach(function (p) {
      if (p.type !== 'literal') parts[p.type] = p.value;
    });
    var wallAsUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
      d.getUTCMilliseconds()
    );
    var diffMin = Math.round((wallAsUtc - ref) / 60000);
    var sign = diffMin >= 0 ? '+' : '-';
    var abs = Math.abs(diffMin);
    return sign + _h1_pad(Math.floor(abs / 60), 2) + ':' + _h1_pad(abs % 60, 2);
  } catch (e) {
    return tz || '--';
  }
}

function _h1_formatFullDate(d) {
  return d.getFullYear() + '-' + _h1_pad(d.getMonth() + 1, 2) + '-' + _h1_pad(d.getDate(), 2);
}

// ── State derivation ──
function _h1_deriveState(msUntil) {
  if (msUntil > 5 * 60 * 1000) return { text: 'pending', cls: 'ok' };
  if (msUntil > 60 * 1000) return { text: 'armed', cls: 'ok' };
  if (msUntil > 5 * 1000) return { text: 'soon', cls: 'soon' };
  if (msUntil > 0) return { text: 'fire!', cls: 'now' };
  if (msUntil > -5 * 1000) return { text: 'firing', cls: 'now' };
  return { text: 'passed', cls: 'passed' };
}

// ── Cookie / localStorage helpers ──
function _h1_getCookieValue(name) {
  try {
    var match = document.cookie.match(new RegExp('(^|;)\\s*' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : '';
  } catch (e) { return ''; }
}

function _h1_getLsValue(key) {
  try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
}

function _h1_mask(s, n) {
  if (!s) return '(empty)';
  if (s.length <= n * 2) return s;
  return s.slice(0, n) + '…' + s.slice(-n);
}

// ── Updaters ──
function _h1_setAttr(id, attr, value) {
  var el = document.getElementById(id);
  if (el) el.setAttribute(attr, value || '');
}

function _h1_setPill(idPrefix, ok, warn, label, okText, failText, tip) {
  var pill = document.getElementById(idPrefix);
  var dot = document.getElementById(idPrefix + '-dot');
  var status = document.getElementById(idPrefix + '-status');
  if (!pill || !dot || !status) return;

  var stateClass = ok ? 'ok' : (warn ? 'warn' : 'fail');
  pill.className = 'bmh-pill ' + stateClass;
  dot.className = 'bmh-dot ' + stateClass + (ok ? ' calibrated' : '');
  status.textContent = ok ? okText : failText;
  status.title = label + ': ' + status.textContent;
  pill.setAttribute('data-tip', tip || (label + ': ' + status.textContent));
}

function _h1_updateAuth() {
  var hasCookie = false;
  var hasUser = false;
  var hasProductIds = _h1_rt.hasProducts;
  var cookieVal = '';
  var org = '';
  var project = '';
  var user = '';
  var email = '';
  try {
    hasCookie = document.cookie.indexOf('bigmodel_token_production') !== -1;
    cookieVal = _h1_getCookieValue('bigmodel_token_production');
    org = _h1_getLsValue('Bigmodel-Organization');
    project = _h1_getLsValue('Bigmodel-Project');
    user = _h1_getLsValue('Bigmodel-User');
    email = _h1_getLsValue('Bigmodel-Email');
    hasUser = hasCookie && !!org && !!project;
  } catch (e) { /* localStorage blocked */ }

  var ckTip = 'Cookie: bigmodel_token_production\n' +
    (hasCookie ? 'Status: present\nSuffix: ' + _h1_mask(cookieVal, 6) : 'Status: missing\nAction: click Login or refresh the page');

  var uiTip = 'User context from localStorage\n' +
    'Organization: ' + (org ? _h1_mask(org, 8) : '(missing)') + '\n' +
    'Project: ' + (project ? _h1_mask(project, 8) : '(missing)') + '\n' +
    (user ? 'User: ' + _h1_mask(user, 8) + '\n' : '') +
    (email ? 'Email: ' + _h1_mask(email, 10) + '\n' : '') +
    'Status: ' + (hasUser ? 'ready' : 'incomplete');

  var piTip = 'Product list loaded from server\n';
  var hasProductsLoaded = false;
  try {
    if (typeof _productMatrix !== 'undefined' && _productMatrix) {
      var monthly = (_productMatrix.monthly || []).length;
      var quarterly = (_productMatrix.quarterly || []).length;
      var yearly = (_productMatrix.yearly || []).length;
      hasProductsLoaded = monthly + quarterly + yearly > 0;
      piTip += 'Total tiers: ' + (monthly + quarterly + yearly) + ' (M/Q/Y: ' + monthly + '/' + quarterly + '/' + yearly + ')';
    } else {
      piTip += hasProductIds ? 'Products loaded' : 'No product matrix yet';
      hasProductsLoaded = !!hasProductIds;
    }
  } catch (e) {
    piTip += hasProductIds ? 'Products loaded' : 'Not loaded';
    hasProductsLoaded = !!hasProductIds;
  }
  if (typeof _priorityList !== 'undefined' && Array.isArray(_priorityList) && _priorityList.length > 0) {
    piTip += '\nSelected: ' + _priorityList.length;
    try {
      piTip += ' · priority ' + _priorityList.map(function(item) {
        var p = (typeof findProductById !== 'undefined') ? findProductById(item.productId) : null;
        return p ? p.name : item.productId.slice(-6);
      }).join('>');
    } catch (e) {}
  }

  _h1_setPill('bmh-ck', hasCookie, false, 'Cookie',
    'ready', 'missing', ckTip);
  _h1_setPill('bmh-ui', hasUser, !hasCookie && !hasUser, 'User',
    'ready', hasCookie ? 'missing org/project' : 'not logged in', uiTip);
  _h1_setPill('bmh-pi', hasProductsLoaded, false, 'Product List',
    'loaded', 'not loaded', piTip);

  // Login tip — show only when auth is incomplete; triggers site login modal
  var loginEl = document.getElementById('bmh-login');
  if (loginEl) loginEl.style.display = (!hasCookie || !hasUser) ? 'inline-flex' : 'none';
}

function _h1_updateTimeTick() {
  // Local wall clock
  var now = new Date();
  var nowEl = document.getElementById('bmh-now');
  if (nowEl) nowEl.textContent = _h1_formatLocalWithMs(now);
  var tzEl = document.getElementById('bmh-tz');
  if (tzEl) tzEl.textContent = _h1_formatTzOffset(now);

  var nowTip = 'Local wall clock\nDate: ' + _h1_formatFullDate(now) + '\nTime: ' + _h1_formatLocalWithMs(now) + '\nTimezone: ' + _h1_formatTzOffset(now);
  _h1_setAttr('bmh-now-row', 'data-tip', nowTip);

  // Target time + delta (only if SALE_TIME_CONFIG has been received)
  if (_h1_rt.nextSaleTime > 0) {
    var tz = (_h1_rt.cfg && _h1_rt.cfg.timezone) || 'Asia/Shanghai';
    var tgtEl = document.getElementById('bmh-tgt');
    if (tgtEl) tgtEl.textContent = _h1_formatInTzWithMs(_h1_rt.nextSaleTime, tz);
    var tgtzEl = document.getElementById('bmh-tgtz');
    if (tgtzEl) tgtzEl.textContent = _h1_formatTzLabel(tz);
    var msUntil = _h1_rt.nextSaleTime - now.getTime();
    var deltaEl = document.getElementById('bmh-delta');
    var stateEl = document.getElementById('bmh-state');
    if (deltaEl) {
      var formatted = _h1_formatDelta(msUntil);
      var st = _h1_deriveState(msUntil);
      deltaEl.textContent = formatted;
      deltaEl.className = 'bmh-tv delta-' + st.cls;
      if (stateEl) {
        stateEl.textContent = st.text;
        stateEl.className = 'bmh-state ' + st.cls;
      }
    }
    var cfgStr = (_h1_rt.cfg
      ? (_h1_rt.cfg.hour || 0) + ':' + _h1_pad(_h1_rt.cfg.minute || 0, 2) + ':' + _h1_pad(_h1_rt.cfg.second || 0, 2) + '.' + _h1_pad(_h1_rt.cfg.ms || 0, 3) + ' ' + tz
      : tz);
    _h1_setAttr('bmh-tgt-row', 'data-tip',
      'Next sale target\nConfig: ' + cfgStr + '\n' +
      'Target epoch: ' + _h1_rt.nextSaleTime + '\n' +
      'Local target: ' + _h1_formatInTzWithMs(_h1_rt.nextSaleTime, tz) + ' ' + _h1_formatTzLabel(tz)
    );
    _h1_setAttr('bmh-delta-row', 'data-tip',
      'Countdown to target\nRemaining: ' + _h1_formatDelta(msUntil) + '\n' +
      'Milliseconds: ' + msUntil + '\nState: ' + (stateEl ? stateEl.textContent : 'pending')
    );
  } else {
    var deltaEl2 = document.getElementById('bmh-delta');
    if (deltaEl2) {
      deltaEl2.textContent = '--:--:--.---';
      deltaEl2.className = 'bmh-tv';
    }
    var stateEl2 = document.getElementById('bmh-state');
    if (stateEl2) {
      stateEl2.textContent = 'no sale';
      stateEl2.className = 'bmh-state passed';
    }
    _h1_setAttr('bmh-tgt-row', 'data-tip', 'Sale time not configured\nDefault target: 10:00:00.000 Asia/Shanghai (UTC+8)');
    _h1_setAttr('bmh-delta-row', 'data-tip', 'Countdown unavailable until sale time is received');
  }
}

// ── Message handler ──
function _h1_handleMessage(ev) {
  if (ev.source !== window) return;
  if (!ev.data || !ev.data.__miaosha_overlay) return;
  var d = ev.data;
  if (d.type === 'SALE_TIME_CONFIG' && d.data) {
    _h1_rt.cfg = d.data.config || null;
    _h1_rt.nextSaleTime = typeof d.data.nextSaleTime === 'number' ? d.data.nextSaleTime : 0;
  }
}

// ── Login modal trigger ──
function _h1_setupLoginClick() {
  var loginEl = document.getElementById('bmh-login');
  if (!loginEl) return;
  loginEl.addEventListener('click', function (e) {
    e.preventDefault();
    // Trigger the site's same-page login modal (Element UI popover reference)
    var siteBtn = document.querySelector('.register-btn.register-btn__style1.el-popover__reference');
    if (siteBtn) {
      siteBtn.click();
    } else {
      // Fallback to the generic register button if the detailed selector fails
      var fallback = document.querySelector('.register-btn');
      if (fallback) fallback.click();
    }
  });
}

// ── Options page trigger ──
function _h1_setupOptionsClick() {
  var optsEl = document.getElementById('bmh-opts');
  if (!optsEl) return;
  optsEl.addEventListener('click', function () {
    window.postMessage({ __miaosha_cmd: true, type: 'OPEN_OPTIONS_PAGE' }, '*');
  });
}

// ── Test Pay button trigger ──
function _h1_setupTestPayClick() {
  var testEl = document.getElementById('bmh-test');
  if (!testEl) return;
  testEl.addEventListener('click', function () {
    window.postMessage({ __miaosha_cmd: true, type: 'TEST_NATIVE_PAYMENT', data: { payType: 'ALI' } }, '*');
  });
}

// ── Injection ──
function _h1_injectHeader() {
  if (document.getElementById(H1)) return;
  if (location.pathname !== '/glm-coding') return;
  var host = document.querySelector('.pc-header-nav-left');
  if (!host) return; // page structure changed; silent exit

  // CSS
  if (!document.getElementById(H1_CSS_ID)) {
    var cssWrap = document.createElement('div');
    cssWrap.innerHTML = _h1_buildCSS();
    var frag = document.createDocumentFragment();
    while (cssWrap.firstChild) frag.appendChild(cssWrap.firstChild);
    (document.head || document.documentElement).appendChild(frag);
  }

  // Container
  var el = document.createElement('div');
  el.id = H1;
  el.innerHTML = _h1_buildHTML();
  host.insertBefore(el, host.firstChild);

  // Per-element click handlers (must re-bind after a wipe + re-injection)
  _h1_setupLoginClick();
  _h1_setupOptionsClick();
  _h1_setupTestPayClick();

  // Initial paints
  _h1_updateAuth();
  _h1_updateTimeTick();

  // One-time global registrations. A re-injection after an SPA wipe must
  // NOT duplicate the message listener or the polling loops — the originals
  // look elements up by id per tick and keep working on the new elements.
  if (!_h1_started) {
    _h1_started = true;

    // Message listener
    window.addEventListener('message', _h1_handleMessage);

    // Polling loops
    setInterval(_h1_updateAuth, 3000);
    setInterval(_h1_updateTimeTick, 100);

    // Ask extension for sale time (overlay pattern)
    setTimeout(function () {
      window.postMessage({ __miaosha_cmd: true, type: 'GET_SALE_TIME' }, '*');
    }, 800);
  }
}

// ── Injection scheduling ──
// The mount host (.pc-header-nav-left) is rendered asynchronously by the
// site's SPA and can appear seconds after this script runs. A one-shot
// `setTimeout(_h1_injectHeader, 1500)` loses that race on slower loads and
// — because _h1_injectHeader silently returns when the host is missing —
// the bar then never appears at all. Instead: fast bounded retries until
// the bar exists, plus a slow permanent watch so the bar is resurrected if
// the SPA later re-renders the header and wipes it.
var _h1_started = false;
var H1_BOOT_DELAY_MS = 500;
var H1_RETRY_MS = 500;
var H1_RETRY_LIMIT = 59; // 500ms boot + 59×500ms ≈ 30s of fast retries
var H1_WATCH_MS = 5000;

function _h1_scheduleRetry(attempt) {
  setTimeout(function () {
    _h1_injectHeader();
    if (document.getElementById(H1)) return;
    if (attempt + 1 <= H1_RETRY_LIMIT) _h1_scheduleRetry(attempt + 1);
  }, attempt === 0 ? H1_BOOT_DELAY_MS : H1_RETRY_MS);
}

_h1_scheduleRetry(0);
setInterval(function () { _h1_injectHeader(); }, H1_WATCH_MS);
