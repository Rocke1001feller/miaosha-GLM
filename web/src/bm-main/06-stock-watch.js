// ── 06-stock-watch.js ───────────────────────────────────────────────────────
// MAIN world module: pre-fetch customer info, poll batch-preview for stock
// flips, and estimate server clock offset from response Date headers.
// All requests use window.fetch with the page's own credentials/headers so the
// fingerprint matches the official client as closely as possible.

(function() {
  var BATCH_PREVIEW_URL = 'https://bigmodel.cn/api/biz/pay/batch-preview';
  var CUSTOMER_INFO_URL = 'https://bigmodel.cn/api/biz/customer/getCustomerInfo';
  var POLL_INTERVAL_MS = 4300;
  var PRE_WARM_MS = 90 * 1000;
  var POST_SALE_MS = 2 * 60 * 1000;
  var MIN_SAMPLES_FOR_OFFSET = 3;

  var _sw = {
    nextSaleTime: 0,
    polling: false,
    pollTimer: null,
    stopTimer: null,
    lastSoldOutMap: {},
    offsetSamples: [],
    startedAt: 0,
  };

  function log(tag, detail) {
    try {
      var entries = JSON.parse(sessionStorage.getItem('bm_stock_watch_log') || '[]');
      if (!Array.isArray(entries)) entries = [];
      entries.push({ ts: Date.now(), tag: tag, detail: detail || '' });
      if (entries.length > 40) entries = entries.slice(-40);
      sessionStorage.setItem('bm_stock_watch_log', JSON.stringify(entries));
    } catch (e) {}
  }

  function getAuthHeaders() {
    var auth = (typeof getLocalAuthHeaders === 'function') ? getLocalAuthHeaders() : null;
    if (!auth) return null;
    return {
      'authorization': auth.authorization,
      'bigmodel-organization': auth.bigmodelOrganization,
      'bigmodel-project': auth.bigmodelProject,
    };
  }

  // ── Customer info (needed by P3 direct create-sign) ────────────────────────
  function fetchCustomerInfo() {
    var headers = getAuthHeaders();
    if (!headers) {
      log('customer-info', 'auth-missing');
      return;
    }
    window.fetch(CUSTOMER_INFO_URL, {
      method: 'GET',
      credentials: 'include',
      headers: Object.assign(headers, {
        'accept': 'application/json, text/plain, */*',
        'set-language': 'zh',
      }),
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d && d.code === 200 && d.data) {
        window.__bm_customerInfo = d.data;
        log('customer-info', 'ok');
      } else {
        log('customer-info', 'code=' + (d && d.code || 'unknown'));
      }
    })
    .catch(function(err) {
      log('customer-info', 'err=' + (err && err.message ? err.message : 'network'));
    });
  }

  // ── Clock offset estimation ───────────────────────────────────────────────
  function updateOffset(requestStart, responseDateHeader) {
    if (!responseDateHeader) return;
    var now = Date.now();
    var rtt = now - requestStart;
    var serverDate = new Date(responseDateHeader).getTime();
    if (!isFinite(serverDate) || serverDate <= 0) return;
    var offset = serverDate + Math.round(rtt / 2) - now; // local - server
    _sw.offsetSamples.push(offset);
    if (_sw.offsetSamples.length > 10) _sw.offsetSamples.shift();

    // Use the minimum observed offset as a conservative estimate (local most ahead).
    var minOffset = _sw.offsetSamples[0];
    for (var i = 1; i < _sw.offsetSamples.length; i++) {
      if (_sw.offsetSamples[i] < minOffset) minOffset = _sw.offsetSamples[i];
    }
    window.__bm_serverOffset = minOffset;
    log('offset', 'samples=' + _sw.offsetSamples.length + ' offset=' + minOffset);
  }

  // ── Stock flip detection ──────────────────────────────────────────────────
  function getSelectedProductIds() {
    if (typeof _priorityList !== 'undefined' && Array.isArray(_priorityList) && _priorityList.length > 0) {
      return _priorityList.map(function(item) { return item.productId; });
    }
    return [];
  }

  function detectFlips(productList) {
    var selectedIds = getSelectedProductIds();
    if (selectedIds.length === 0) return [];
    var flipped = [];
    var currentMap = {};
    for (var i = 0; i < productList.length; i++) {
      var item = productList[i];
      if (!item || !item.productId) continue;
      currentMap[item.productId] = !!(item.soldOut || item.forbidden || item.canPurchase === false);
    }
    for (var j = 0; j < selectedIds.length; j++) {
      var pid = selectedIds[j];
      var wasSoldOut = _sw.lastSoldOutMap[pid];
      var nowAvailable = currentMap[pid] === false;
      if (wasSoldOut === true && nowAvailable) {
        flipped.push(pid);
      }
    }
    _sw.lastSoldOutMap = currentMap;
    return flipped;
  }

  function postStockFlip(productIds) {
    var serverNowMs = Date.now() - (window.__bm_serverOffset || 0);
    window.postMessage({
      __miaosha: true,
      type: 'STOCK_FLIP',
      payload: {
        productIds: productIds,
        serverNowMs: serverNowMs,
        localNowMs: Date.now(),
      }
    }, '*');
    log('stock-flip', productIds.join(','));
  }

  // ── batch-preview polling ─────────────────────────────────────────────────
  function pollBatchPreview() {
    var headers = getAuthHeaders();
    if (!headers) {
      log('poll', 'auth-missing');
      return;
    }
    var requestStart = Date.now();
    window.fetch(BATCH_PREVIEW_URL, {
      method: 'POST',
      credentials: 'include',
      headers: Object.assign(headers, {
        'Content-Type': 'application/json;charset=UTF-8',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'zh',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'set-language': 'zh',
      }),
      body: '{"invitationCode":""}',
    })
    .then(function(r) {
      var responseHeaders = {};
      r.headers.forEach(function(value, key) {
        responseHeaders[key.toLowerCase()] = value;
      });
      updateOffset(requestStart, responseHeaders.date);
      return r.json().then(function(d) { return { d: d, status: r.status }; });
    })
    .then(function(res) {
      var d = res.d;
      if (d && d.code === 200 && d.data && Array.isArray(d.data.productList)) {
        window.__bm_stockState = {
          updatedAt: Date.now(),
          productList: d.data.productList,
        };
        var flipped = detectFlips(d.data.productList);
        if (flipped.length > 0) {
          postStockFlip(flipped);
        }
        log('poll', 'ok products=' + d.data.productList.length + ' flipped=' + flipped.length);
      } else {
        log('poll', 'code=' + (d && d.code || 'unknown'));
      }
    })
    .catch(function(err) {
      log('poll', 'err=' + (err && err.message ? err.message : 'network'));
    });
  }

  function startPolling() {
    if (_sw.polling) return;
    _sw.polling = true;
    _sw.startedAt = Date.now();
    log('start', 'polling started');
    pollBatchPreview();
    _sw.pollTimer = setInterval(pollBatchPreview, POLL_INTERVAL_MS);

    // Stop shortly after sale time to avoid useless traffic.
    var saleTime = _sw.nextSaleTime || _rt.nextSaleTime;
    if (saleTime > Date.now()) {
      var stopDelay = saleTime + POST_SALE_MS - Date.now();
      if (stopDelay > 0) {
        _sw.stopTimer = setTimeout(stopPolling, stopDelay);
      }
    }
  }

  function stopPolling() {
    _sw.polling = false;
    if (_sw.pollTimer) {
      clearInterval(_sw.pollTimer);
      _sw.pollTimer = null;
    }
    if (_sw.stopTimer) {
      clearTimeout(_sw.stopTimer);
      _sw.stopTimer = null;
    }
    log('stop', 'polling stopped');
  }

  function schedulePolling(nextSaleTime) {
    _sw.nextSaleTime = nextSaleTime;
    var msUntilStart = nextSaleTime - PRE_WARM_MS - Date.now();
    if (msUntilStart <= 0) {
      startPolling();
      return;
    }
    log('schedule', 'start in ' + msUntilStart + 'ms');
    setTimeout(startPolling, msUntilStart);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  window.__bm_customerInfo = window.__bm_customerInfo || null;
  window.__bm_serverOffset = window.__bm_serverOffset || 0;
  window.__bm_stockState = window.__bm_stockState || null;

  setTimeout(fetchCustomerInfo, 500);

  window.addEventListener('message', function(ev) {
    if (ev.source !== window || !ev.data) return;
    var d = ev.data;
    if (d.__miaosha_overlay && d.type === 'SALE_TIME_CONFIG' && d.data && typeof d.data.nextSaleTime === 'number') {
      schedulePolling(d.data.nextSaleTime);
    }
  });

  // Expose a tiny API for diagnostics.
  window.__bm_stockWatch = {
    start: startPolling,
    stop: stopPolling,
    pollNow: pollBatchPreview,
    getState: function() { return _sw; }
  };
})();
