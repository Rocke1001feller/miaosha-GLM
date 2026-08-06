// ── 10-native-pay-trigger.js ────────────────────────────────────────────────
// Listens for BURST_FIRE_SUCCESS from the ISOLATED world content script and,
// on success, opens bigmodel.cn's OWN in-page payment modal — the PayComponent
// Vue instance living under #app.
//
// We do NOT render any custom payment UI. The whole point of this module is to
// hand control back to the website's native payment flow so users pay
// bigmodel.cn directly, with no extension-mediated UI in between. This avoids
// the trust problem where users might think they are paying the extension
// rather than the merchant.
//
// Implementation notes (reverse-engineered from bigmodel.cn; may need re-check
// if the site reshuffles its Vue tree):
//
//   The PayComponent is a Vue 2 component (Element UI based) mounted under
//   #app. It exposes:
//     data:    { priceData, payDialogVisible, payType, captchaVerified, isSoldOut, ... }
//     methods: payPreviewFn, getPayStatusFn, selectPayTypeFn, closeAndRefreshFn
//
//   To open the modal with an already-reserved bizId we set:
//     pay.priceData        = { bizId, productId, thirdPartyAmount, payAmount, qrCode, ... }
//     pay.captchaVerified  = true          // skip their captcha gate
//     pay.isSoldOut        = false
//     pay.payDialogVisible = true

(function () {
  var _pt_payComponent = null;
  var _pt_discoveryAttempted = false;
  var _pt_testMode = false;
  var _pt_manualClose = false;
  var _pt_origClose = null;
  var _pt_unwatch = null;
  var _pt_docClickCleanup = null;
  var _pt_observer = null;
  var _pt_origCaptchaHandlers = {};

  function findPayComponent() {
    if (_pt_payComponent) return _pt_payComponent;
    if (_pt_discoveryAttempted) return null;
    _pt_discoveryAttempted = true;

    var root = document.querySelector('#app');
    if (!root || !root.__vue__) return null;
    var top = root.__vue__;
    while (top.$parent) top = top.$parent;

    var queue = [top];
    var visited = new Set();
    while (queue.length) {
      var vm = queue.shift();
      if (!vm || visited.has(vm)) continue;
      visited.add(vm);
      var opts = vm.$options;
      var data = vm.$data;
      if (opts && opts.name === 'PayComponent' && data && 'payDialogVisible' in data) {
        _pt_payComponent = vm;
        return vm;
      }
      var children = vm.$children || [];
      for (var i = 0; i < children.length; i++) queue.push(children[i]);
    }
    return null;
  }

  function buildPriceData(ps) {
    return {
      bizId: ps.bizId,
      productId: ps.productId,
      thirdPartyAmount: typeof ps.amount === 'number' ? ps.amount : null,
      payAmount: typeof ps.amount === 'number' ? ps.amount : null,
      qrCode: ps.qrCode || null,
    };
  }

  function disableTestMode(pay) {
    try {
      if (_pt_unwatch && typeof _pt_unwatch === 'function') { _pt_unwatch(); _pt_unwatch = null; }
      if (_pt_docClickCleanup && typeof _pt_docClickCleanup === 'function') { _pt_docClickCleanup(); _pt_docClickCleanup = null; }
      if (_pt_observer && typeof _pt_observer.disconnect === 'function') { _pt_observer.disconnect(); _pt_observer = null; }
      if (_pt_origClose && pay && typeof pay.closeAndRefreshFn === 'function' && pay.closeAndRefreshFn.__pt_patched) {
        pay.closeAndRefreshFn = _pt_origClose;
      }
      for (var method in _pt_origCaptchaHandlers) {
        if (pay && typeof pay[method] === 'function' && pay[method].__pt_patched) {
          pay[method] = _pt_origCaptchaHandlers[method];
        }
      }
      _pt_origCaptchaHandlers = {};
    } catch (e) { /* ignore */ }
    _pt_testMode = false;
    _pt_manualClose = false;
    _pt_origClose = null;
    if (pay) {
      pay._pt_testMode = false;
      pay._pt_manualClose = false;
    }
  }

  function enableTestMode(pay, testAmount) {
    if (!pay) return;
    disableTestMode(pay); // clean any previous state
    _pt_testMode = true;
    _pt_manualClose = false;
    pay._pt_testMode = true;
    pay._pt_manualClose = false;
    var amountMarker = String(typeof testAmount === 'number' ? testAmount : 159);

    // 1. Patch closeAndRefreshFn so automatic closes are ignored.
    if (typeof pay.closeAndRefreshFn === 'function') {
      _pt_origClose = pay.closeAndRefreshFn;
      pay.closeAndRefreshFn = function () {
        if (!pay._pt_manualClose) {
          console.log('[miaosha] Test mode: blocked auto-close of native pay dialog.');
          return;
        }
        disableTestMode(pay);
        if (typeof _pt_origClose === 'function') return _pt_origClose.apply(this, arguments);
      };
      pay.closeAndRefreshFn.__pt_patched = true;
    }

    // 1b. Patch captcha result handlers so completing/cancelling the secondary
    //     Tencent captcha does not tear down the test dialog.
    ['handleCaptchaSuccess', 'handleCaptchaFail', 'handleCaptchaCancel'].forEach(function (method) {
      if (typeof pay[method] === 'function' && !pay[method].__pt_patched) {
        _pt_origCaptchaHandlers[method] = pay[method];
        pay[method] = function () {
          if (!pay._pt_testMode) {
            return typeof _pt_origCaptchaHandlers[method] === 'function'
              ? _pt_origCaptchaHandlers[method].apply(this, arguments)
              : undefined;
          }
          console.log('[miaosha] Test mode: intercepted ' + method + ', keeping dialog open.');
          // In test mode we never want the captcha result to proceed to real
          // payment or to close the dialog. Just keep the dialog visible.
          setReactive(pay, 'payDialogVisible', true);
        };
        pay[method].__pt_patched = true;
      }
    });

    // 2. Safety watcher: if something sets payDialogVisible=false directly, reopen it.
    if (typeof pay.$watch === 'function') {
      _pt_unwatch = pay.$watch('payDialogVisible', function (newVal, oldVal) {
        if (!newVal && oldVal && pay._pt_testMode && !pay._pt_manualClose) {
          console.log('[miaosha] Test mode: watcher detected dialog close, reopening.');
          setReactive(pay, 'payDialogVisible', true);
        }
      });
    }

    // 3. Replace the X button with a clone that only we control. Element UI may
    //    teleport the dialog, so we retry until the button appears.
    function wireCloseButton() {
      try {
        var wrappers = document.querySelectorAll('.el-dialog__wrapper');
        for (var i = 0; i < wrappers.length; i++) {
          var wrapper = wrappers[i];
          var body = wrapper.querySelector('.el-dialog__body');
          if (!body || body.innerText.indexOf(amountMarker) === -1) continue;
          var closeBtn = wrapper.querySelector('.el-dialog__headerbtn');
          if (!closeBtn || closeBtn.__pt_testWired) continue;
          var newBtn = closeBtn.cloneNode(true);
          newBtn.__pt_testWired = true;
          closeBtn.parentNode.replaceChild(newBtn, closeBtn);
          newBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            pay._pt_manualClose = true;
            _pt_manualClose = true;
            setReactive(pay, 'payDialogVisible', false);
            disableTestMode(pay);
          });
        }
      } catch (e) { /* ignore */ }
    }

    // 4. Document-level capture listener as a safety net: if any X button click
    //    somehow reaches the capture phase, mark it as manual close and close.
    function onDocClickCapture(e) {
      if (!pay._pt_testMode || pay._pt_manualClose) return;
      var btn = e.target.closest ? e.target.closest('.el-dialog__headerbtn') : null;
      if (!btn) return;
      var wrapper = btn.closest ? btn.closest('.el-dialog__wrapper') : null;
      if (!wrapper) return;
      var body = wrapper.querySelector('.el-dialog__body');
      if (!body || body.innerText.indexOf(amountMarker) === -1) return;
      pay._pt_manualClose = true;
      _pt_manualClose = true;
      e.stopImmediatePropagation();
      e.preventDefault();
      setReactive(pay, 'payDialogVisible', false);
      disableTestMode(pay);
    }
    document.addEventListener('click', onDocClickCapture, true);
    _pt_docClickCleanup = function () {
      document.removeEventListener('click', onDocClickCapture, true);
    };

    // Retry several times because the dialog may animate in / be teleported.
    var wireAttempts = 0;
    function wireLoop() {
      if (!pay._pt_testMode) return;
      wireCloseButton();
      if (++wireAttempts < 20) setTimeout(wireLoop, 100);
    }

    // 5. MutationObserver keeps intercepting the X button even if Vue re-renders
    //    or teleports the dialog, replacing the originally wired node.
    function startObserver() {
      if (!window.MutationObserver) return;
      try {
        if (_pt_observer) { _pt_observer.disconnect(); _pt_observer = null; }
        _pt_observer = new MutationObserver(function (mutations) {
          if (!pay._pt_testMode) { try { _pt_observer.disconnect(); } catch (e) {} return; }
          var shouldWire = false;
          for (var m = 0; m < mutations.length; m++) {
            var nodes = mutations[m].addedNodes;
            for (var n = 0; n < nodes.length; n++) {
              if (nodes[n].nodeType === 1) {
                if ((nodes[n].classList && nodes[n].classList.contains('el-dialog__wrapper')) ||
                    (nodes[n].querySelector && nodes[n].querySelector('.el-dialog__headerbtn'))) {
                  shouldWire = true;
                }
              }
            }
          }
          if (shouldWire) wireCloseButton();
        });
        _pt_observer.observe(document.body, { childList: true, subtree: true });
      } catch (e) { /* ignore */ }
    }

    if (typeof pay.$nextTick === 'function') {
      pay.$nextTick(wireLoop);
    }
    setTimeout(wireLoop, 0);
    setTimeout(wireLoop, 300);
    setTimeout(wireLoop, 700);
    startObserver();
  }

  function setReactive(pay, key, value) {
    // Use Vue.$set when available so newly assigned objects/values are fully
    // reactive even if the component has not been rendered before.
    if (typeof pay.$set === 'function') {
      pay.$set(pay.$data, key, value);
    } else {
      pay.$data[key] = value;
    }
  }

  function openNativePaymentDialog(ps, options) {
    if (!ps || !ps.bizId) return false;
    var pay = findPayComponent();
    if (!pay) {
      console.warn('[miaosha] PayComponent not found in Vue tree — bigmodel.cn may have restructured.');
      return false;
    }
    try {
      setReactive(pay, 'priceData', buildPriceData(ps));
      setReactive(pay, 'isSoldOut', false);
      setReactive(pay, 'isServerBusy', false);
      setReactive(pay, 'payType', ps.payType || 'ALI');

      if (options && options.testMode) {
        enableTestMode(pay, ps.amount);
      }

      setReactive(pay, 'payDialogVisible', true);
      if (typeof pay.$forceUpdate === 'function') pay.$forceUpdate();

      var setVerified = function () {
        try {
          setReactive(pay, 'captchaVerified', true);
          setReactive(pay, 'captchaTicket', pay.$data.captchaTicket || 'miaosha-bypass');
          setReactive(pay, 'captchaRandstr', pay.$data.captchaRandstr || 'miaosha-bypass');
          if (typeof pay.$forceUpdate === 'function') pay.$forceUpdate();
        } catch (e) { /* ignore */ }
      };
      if (typeof pay.$nextTick === 'function') {
        pay.$nextTick(setVerified);
      } else {
        setTimeout(setVerified, 0);
      }
      return true;
    } catch (e) {
      console.warn('[miaosha] Failed to open native PayComponent dialog:', e);
      return false;
    }
  }

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.__miaosha_overlay !== true) return;
    var msg = e.data;
    if (msg.type !== 'BURST_FIRE_SUCCESS') return;
    var ps = msg.data;
    if (!ps || !ps.bizId) return;

    if (ps.payType === 'ALI' && window.__bm_customerInfo && window.__bm_customerInfo.customerNumber) {
      directCreateSign(ps);
    } else {
      openNativePaymentDialog(ps);
    }
  });

  function directCreateSign(ps) {
    var auth = (typeof getLocalAuthHeaders === 'function') ? getLocalAuthHeaders() : null;
    if (!auth) {
      openNativePaymentDialog(ps);
      return;
    }
    var ic = null;
    try {
      ic = new URLSearchParams(window.location.search).get('ic');
    } catch (e) {}
    var body = {
      payType: 'ALI',
      productId: ps.productId,
      customerId: window.__bm_customerInfo.customerNumber,
      bizId: ps.bizId,
    };
    if (ic) body.invitationCode = ic;

    fetch('https://bigmodel.cn/api/biz/pay/create-sign', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'authorization': auth.authorization,
        'bigmodel-organization': auth.bigmodelOrganization,
        'bigmodel-project': auth.bigmodelProject,
        'Content-Type': 'application/json;charset=utf-8',
        'accept': 'application/json, text/plain, */*',
      },
      body: JSON.stringify(body),
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d && d.code === 200 && d.data && d.data.sign) {
        try {
          window.postMessage({ __miaosha_overlay: true, type: 'PAYMENT_CREATED', data: { bizId: ps.bizId, orderId: d.data.orderId, payType: 'ALI' } }, '*');
        } catch (e) {}
        try {
          chrome.runtime.sendMessage({ type: 'OPEN_PAY_TAB', url: d.data.sign });
        } catch (e) {
          // Fallback if runtime message fails.
          window.location.href = d.data.sign;
        }
      } else {
        openNativePaymentDialog(ps);
      }
    })
    .catch(function() {
      openNativePaymentDialog(ps);
    });
  }

  // Listen for the explicit test command from the L1 header button.
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.__miaosha_cmd !== true) return;
    if (e.data.type !== 'TEST_NATIVE_PAYMENT') return;
    var data = e.data.data || {};
    openNativePaymentDialog({
      bizId: 'TEST-' + Date.now(),
      productId: 'test-product',
      amount: typeof data.amount === 'number' ? data.amount : 159,
      payType: data.payType || 'ALI'
    }, { testMode: true });
  });
})();
