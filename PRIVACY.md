# Privacy Policy

> **智能 Coding Plan 助手** — Chrome MV3 Browser Extension
> Last updated: 2026-06-18

This extension is provided as open-source software under the **ISC license**.
We do **not** operate any backend service and do **not** collect, transmit,
sell, or share any user data with third parties.

---

## Data stored locally (on the user's device)

All data lives exclusively in `chrome.storage.local` and never leaves the
user's machine unless the user explicitly exports it.

| Item | Purpose | Retention |
|------|---------|-----------|
| CAPTCHA `ticket` / `randstr` pool (max 20) | Skip CAPTCHA at sale time | Auto-purged after 5 minutes (TTL) |
| Auth headers captured from `bigmodel.cn` XHR | Authenticate order requests on behalf of the user | Until user clears storage or uninstalls |
| Sale time configuration | Trigger countdown alarms | Persistent, user-editable |
| Fire strategy (mode, interval, allocation, backoff) | Drive auto-fire scheduler | Persistent, user-editable |
| Selected products (P1/P2/P3 priority) | Pick order targets | Persistent, user-editable |
| Dev / Prod mode flag | Switch Popup view | Persistent, user-editable |

---

## Network requests

The extension only issues `fetch` requests from the page's **MAIN world** to
endpoints under **`https://bigmodel.cn/*`**, in order to:

1. Bypass the server-side rejection of `chrome-extension://` origin requests
   (which return an empty body) so that order submission is treated as a
   same-origin request.
2. Carry the user's already-authenticated session cookies, which is the
   **only** way to call the order/payment APIs on the user's behalf.

The extension does **not** contact:

- any analytics or telemetry service,
- any third-party CDN for tracking,
- any remote configuration server,
- any AI / LLM API.

There is **no** remote server controlled by this project.

---

## Permissions used

| Permission | Reason |
|------------|--------|
| `storage` | Persist local data listed above |
| `alarms` | Schedule countdown reminders (T-60/30/15/10/5) |
| `notifications` | Deliver the five reminders and "fire window open" alert |
| `tabs` | Detect when the active tab is on `bigmodel.cn` |
| `scripting` | Inject MAIN-world script so `fetch` is same-origin |
| `host_permissions: https://bigmodel.cn/*` | Single target host for the captcha/auth/order flow |

No permission is requested for, or used to access, any other domain.

---

## Data sharing

- We share **nothing** with anyone. There is no analytics, no error
  reporting, no usage ping.
- The only network egress is the user's own `fetch` calls to
  `https://bigmodel.cn/*`, which carry the user's own session cookies and
  are visible in DevTools like any normal request from the page itself.

---

## Children's privacy

This extension is not directed at children under 13 and we do not knowingly
collect any data from any user, minor or otherwise.

---

## Changes to this policy

Material changes will be reflected in the `Last updated` date above and in
the Git commit history. Continued use of the extension after a change
constitutes acceptance of the updated policy.

---

## Contact

- **Issues:** https://github.com/Rocke1001feller/miaosha-GLM/issues
- **Discussions:** https://github.com/Rocke1001feller/miaosha-GLM/discussions

We are **not affiliated with** bigmodel.cn or Zhipu AI. All trademarks and
service marks are the property of their respective owners.
