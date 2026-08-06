// MAIN-world script injected by bm-early.content.ts at document_start.
// Wraps window.fetch (and guards it with a getter/setter so Sentry or any
// later library cannot replace it with an un-wrapped implementation) to
// capture the page's own successful /api/biz/pay/batch-preview response.
// The page's JS already has to fetch this endpoint; reusing its response
// (window.__bm_batchPreviewData / sessionStorage 'bm_batch_preview') lets us
// avoid a duplicate request that often gets rejected with WAF/rate-limit
// code 555 while the page's request succeeds.
(function() {
  if (window.__bm_early_injected) return;
  window.__bm_early_injected = true;
  try {
    var nativeFetch = window.fetch;
    window.__bm_batchPreviewData = null;

    function cacheBatchPreview(data) {
      if (!data || data.code !== 200 || !data.data || !Array.isArray(data.data.productList) || data.data.productList.length === 0) {
        return;
      }
      window.__bm_batchPreviewData = data.data.productList;
      try {
        sessionStorage.setItem('bm_batch_preview', JSON.stringify(data));
      } catch(e) {}
    }

    function wrapFetch(fn) {
      return function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url);
        var p = fn.apply(this, arguments);
        return p.then(function(response) {
          if (url && String(url).indexOf('/api/biz/pay/batch-preview') !== -1 && response && response.clone) {
            try {
              response.clone().json().then(cacheBatchPreview).catch(function() {});
            } catch(e) {}
          }
          return response;
        });
      };
    }

    var wrappedFetch = wrapFetch(nativeFetch);

    // Guard window.fetch so Sentry (or any later library) cannot replace it
    // with an un-wrapped implementation. Reads always return our wrapper;
    // writes get re-wrapped automatically.
    try {
      Object.defineProperty(window, 'fetch', {
        configurable: true,
        enumerable: true,
        get: function() { return wrappedFetch; },
        set: function(newFetch) {
          wrappedFetch = wrapFetch(newFetch);
        }
      });
    } catch(e) {
      window.fetch = wrappedFetch;
    }
  } catch (e) {}
})();
