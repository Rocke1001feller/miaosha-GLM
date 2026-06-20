var _captchaKeyboardHandler = null;

function _isVisibleAndEnabled(el) {
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
  var style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) <= 0) return false;
  var rect = el.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return false;
  return true;
}

// 返回值约定：成功找到并点击确认按钮 → true；否则 → false。
// 调用方据此决定是否 preventDefault（只在真正点到按钮时才阻止默认行为，
// 避免文案改版/滑块类无确认按钮时"帮倒忙"屏蔽用户的 Enter）。
function _tryCaptchaConfirm() {
  var container = document.getElementById('tcaptcha_transform_dy')
    || document.querySelector('.tcaptcha-transform')
    || document.querySelector('[id*="tcaptcha"]');

  if (!container) return false;

  var elements = container.querySelectorAll('button, [role="button"], [class*="btn"], [class*="confirm"], [class*="submit"]');
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    if (!_isVisibleAndEnabled(el)) continue;
    var text = (el.textContent || '').trim();
    if (text === '确认' || text === '确定' || text === 'Confirm') {
      try { el.click(); } catch(e) {}
      return true;
    }
  }
  return false;
}

// Document-level capture-phase keyboard handler.
// Must be on `document` because keyboard events only bubble along the
// ancestor chain of the focused element. When the batch-mode "Stop" button
// is focused (common case), the captcha container is in a separate DOM
// sub-tree and would never receive the event.
function _handleCaptchaKeydown(e) {
  if (e.key === 'Escape' && _batchMode) {
    e.preventDefault();
    e.stopPropagation();
    destroyActiveCaptcha();
    setBatchMode(false);
    return;
  }

  if (e.key === 'Enter' && _activeCaptcha) {
    var target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    // 关键修复：只有真正点到确认按钮才阻止默认行为。
    // 找不到按钮时（文案改版 / 滑块类无确认按钮）放行 Enter，避免"帮倒忙"屏蔽用户操作。
    if (_tryCaptchaConfirm()) {
      e.preventDefault();
    }
  }
}

function _setupCaptchaFocus() {
  _teardownCaptchaFocus();
  _captchaKeyboardHandler = _handleCaptchaKeydown;
  document.addEventListener('keydown', _captchaKeyboardHandler, true);
}

function _teardownCaptchaFocus() {
  if (_captchaKeyboardHandler) {
    document.removeEventListener('keydown', _captchaKeyboardHandler, true);
    _captchaKeyboardHandler = null;
  }
}

function produceCaptcha() {
  if (typeof window.TencentCaptcha === 'undefined') { postMsg('CAPTCHA_ERROR', { msg: 'SDK not loaded' }); return; }
  try {
    var c = new window.TencentCaptcha(CAPTCHA_APPID, function(res) {
      _activeCaptcha = null;
      _teardownCaptchaFocus();
      if (res.ret === 0 && res.ticket) {
        postMsg('CAPTCHA_PRODUCED', { ticket: res.ticket, randstr: res.randstr });
        if (_batchMode) {
          _batchCount++;
          if (_batchCount >= BATCH_SESSION_LIMIT) {
            setBatchMode(false);
            return;
          }
          setTimeout(produceCaptcha, 300);
        }
      }
      else {
        postMsg('CAPTCHA_ERROR', { msg: 'Failed (ret=' + res.ret + ')' });
        if (_batchMode) { setTimeout(produceCaptcha, 500); }
      }
    }, { mode: 'popup' });
    _activeCaptcha = c;
    c.show();
    _setupCaptchaFocus();
  } catch(e) { postMsg('CAPTCHA_ERROR', { msg: e.message }); }
}

function destroyActiveCaptcha() {
  if (!_activeCaptcha) return;
  try { _activeCaptcha.destroy(); } catch(e) {}
  _activeCaptcha = null;
  _teardownCaptchaFocus();
}

function setBatchMode(on) {
  _batchMode = on;
  if (on) _batchCount = 0;
  var btn = document.getElementById('_ab');
  if (btn) {
    if (on) {
      btn.innerHTML = '&#9632; Stop Batch <span style="font-size:7px;font-weight:600;opacity:.6;margin-left:4px">(Esc)</span>';
      btn.style.borderColor = '#dc2626';
      btn.style.color = '#dc2626';
      btn.style.background = 'rgba(220,38,38,0.03)';
    } else {
      btn.innerHTML = '+ Solve Captcha';
      btn.style.borderColor = '';
      btn.style.color = '';
      btn.style.background = '';
    }
  }
  postMsg('BATCH_MODE_STATUS', { active: on });
  if (on) {
    produceCaptcha();
  } else {
    destroyActiveCaptcha();
  }
}

function toggleBatchMode() { setBatchMode(!_batchMode); }

// Auto-cleanup on successful order: close captcha and exit batch mode
// so the bigmodel.cn native payment UI is not blocked by extension UI.
window.addEventListener('message', function(e) {
  if (!e.data || e.data.__miaosha_overlay !== true) return;
  if (e.data.type === 'BURST_FIRE_SUCCESS' && e.data.data && e.data.data.bizId) {
    destroyActiveCaptcha();
    if (_batchMode) setBatchMode(false);
  }
});
