var CAPTCHA_APPID = '196026326';
var S = {}; // state
var _batchMode = false; // batch continuous captcha solving
var _batchCount = 0; // captchas solved in current batch session
var _activeCaptcha = null; // reference to the currently open TencentCaptcha instance (for force-destroy on ESC)
var BATCH_SESSION_LIMIT = 100; // auto-stop after this many per session (default 100, updatable via CAPTCHA_CONFIG)
var _authFailed = false; // true when batch-preview API returns code=1001 (not logged in)

// ── Page-level ticket store (sessionStorage) ──
// Tickets live in the page's sessionStorage: they survive a refresh of the same tab,
// but are destroyed automatically when the tab/window is closed.
var TICKET_STORE_KEY = '__bm_tickets';
function readPageTicketStore() {
  try { return JSON.parse(window.sessionStorage.getItem(TICKET_STORE_KEY) || '[]'); } catch (e) { return []; }
}
function writePageTicketStore(list) {
  try { window.sessionStorage.setItem(TICKET_STORE_KEY, JSON.stringify(list || [])); } catch (e) {}
}
function clearPageTicketStore() {
  try { window.sessionStorage.removeItem(TICKET_STORE_KEY); } catch (e) {}
}

// Bridge: isolated content script asks MAIN world to read/write the page store.
window.addEventListener('message', function(ev) {
  if (ev.source !== window || !ev.data || !ev.data.__miaosha_cmd) return;
  var d = ev.data;
  if (d.type === 'READ_TICKET_STORE') {
    window.postMessage({ __miaosha: true, type: 'TICKET_STORE_DATA', reqId: d.reqId, list: readPageTicketStore() }, '*');
  } else if (d.type === 'WRITE_TICKET_STORE') {
    writePageTicketStore(d.list);
  } else if (d.type === 'CLEAR_TICKET_STORE') {
    clearPageTicketStore();
  } else if (d.type === 'PAGE_FETCH_REQUEST' && d.reqId && d.url) {
    handlePageFetchRequest(d);
  }
});

function handlePageFetchRequest(d) {
  var auth = getLocalAuthHeaders();
  if (!auth) {
    window.postMessage({
      __miaosha_cmd: true,
      type: 'PAGE_FETCH_RESPONSE',
      reqId: d.reqId,
      ok: false,
      error: 'auth-missing'
    }, '*');
    return;
  }
  var headers = Object.assign({}, d.headers || {});
  if (!headers.authorization) headers.authorization = auth.authorization;
  if (!headers['bigmodel-organization']) headers['bigmodel-organization'] = auth.bigmodelOrganization;
  if (!headers['bigmodel-project']) headers['bigmodel-project'] = auth.bigmodelProject;

  window.fetch(d.url, {
    method: d.method || 'GET',
    credentials: 'include',
    headers: headers,
    body: d.body || undefined,
  })
  .then(function(res) {
    var responseHeaders = {};
    res.headers.forEach(function(value, key) {
      responseHeaders[key.toLowerCase()] = value;
    });
    return res.text().then(function(bodyText) {
      return { ok: true, status: res.status, statusText: res.statusText, headers: responseHeaders, bodyText: bodyText };
    });
  })
  .then(function(payload) {
    window.postMessage(Object.assign({
      __miaosha_cmd: true,
      type: 'PAGE_FETCH_RESPONSE',
      reqId: d.reqId,
    }, payload), '*');
  })
  .catch(function(err) {
    window.postMessage({
      __miaosha_cmd: true,
      type: 'PAGE_FETCH_RESPONSE',
      reqId: d.reqId,
      ok: false,
      error: err && err.message ? err.message : 'network-error'
    }, '*');
  });
}

// ── Runtime state (auto-fire scheduler) ──
var _rt = {
  nextSaleTime: 0,    // next sale epoch ms (UTC)
  autoTimer: null,    // setTimeout handle for auto-fire
  countdownTimer: null, // setInterval handle for countdown display
  autoFired: false,   // guard: fire only once per scheduled event
};

function renderPrefireAuthStatus(data) {
  var authEl = document.getElementById('_auths');
  if (!authEl) return;

  if (!data || !data.ok) {
    authEl.style.color = '#dc2626';
    authEl.textContent = 'Auth: blocked';
    return;
  }

  var source = data.source === 'live-page' ? 'live' : 'cache';
  var ageSec = typeof data.ageMs === 'number' && data.ageMs >= 0
    ? Math.round(data.ageMs / 1000) + 's'
    : '--';
  var suffix = data.tokenSuffix ? (' ...' + data.tokenSuffix) : '';

  authEl.style.color = data.source === 'live-page' ? '#059669' : '#d97706';
  authEl.textContent = 'Auth: ' + source + ' age ' + ageSec + suffix;
}

function postMsg(type, payload) {
  window.postMessage({ __miaosha: true, type: type, payload: payload }, '*');
}
function cmdToOverlay(type) {
  window.postMessage({ __miaosha_cmd: true, type: type }, '*');
}

// ── Product Selection State ──
var _productMatrix = { monthly: [], quarterly: [], yearly: [] };
var _billing = 'yearly';
var _priorityList = []; // ordered priority list of { productId }
var _ticketCount = 0;
var _tickets = []; // per-ticket lifecycle list from content script
var _planOrder = ['Lite', 'Pro', 'Max'];
var _fireConfig = { payType: 'ALI', burstIntervalMs: 2100 };
