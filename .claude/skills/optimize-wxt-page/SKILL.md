# WXT Page Optimization Skill

## Description
Optimizes WXT extension pages by migrating from runtime Tailwind CDN and online fonts to pre-compiled CSS and localized assets. This skill ensures **Zero-Latency Loading (Offline Support)** while enforcing **Visual Equivalence (100% style matching)** through rigorous pre-and-post computed style analysis.

## Usage
Activate this skill when optimizing any WXT entrypoint (popup, options, sidepanel) to remove performance bottlenecks without losing any visual features.

**Trigger Indicators:**
- `<script src="https://cdn.tailwindcss.com"></script>` or `/tailwind.css` (Play CDN)
- `<link href="https://fonts.googleapis.com/..." />`

## Prerequisites
- Project uses **WXT** and **Tailwind CSS**
- `npm` or `pnpm` available
- Access to **Chrome DevTools MCP** or **Playwright MCP** for mandatory validation

---

## Standard Operating Procedure

### Phase 1: Environment Setup

#### Step 1.1 - Install Vite Plugin
```bash
npm install -D @tailwindcss/vite
```

#### Step 1.2 - Configure WXT
Update `wxt.config.ts` to include the plugin:
```typescript
import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
```

### Phase 2: Asset Localization (Zero-Latency)

For each target HTML file:

#### Step 2.1 - Identify Fonts
Extract URL from `<link href="https://fonts.googleapis.com/css2?..." />`

#### Step 2.2 - Download Assets
- Fetch the CSS content from the URL
- Extract `.woff2` (preferred) or `.ttf` URLs
- Download files to `assets/fonts/`

#### Step 2.3 - Generate CSS
- Create `@font-face` rules in the page's `style.css`
- Point `src` to local paths: `url('@/assets/fonts/filename.woff2')`
- **Crucial**: Keep `font-family` names identical to the original Google Fonts names (e.g., 'Inter', 'Material Icons Round') to maintain compatibility

### Phase 3: Style Migration

#### Step 3.1 - Migrate Configuration
Extract the JSON object from `<script>tailwind.config = { ... }</script>` and convert to CSS variables in `style.css` under `@theme`.

**Mapping Guide:**
| Tailwind Config | CSS Variable |
|----------------|--------------|
| `colors: { primary: '#000' }` | `--color-primary: #000;` |
| `fontFamily: { sans: ['Inter'] }` | `--font-sans: 'Inter';` |
| `boxShadow: { glass: '...' }` | `--shadow-glass: ...;` |
| `borderRadius: { xl: '...' }` | `--radius-xl: ...;` |

#### Step 3.2 - Migrate Inline Styles
- Move all contents of HTML `<style>` blocks to `style.css`
- Ensure `@import "tailwindcss";` is at the top of `style.css`

### Phase 4: HTML Cleanup

In the target HTML file, remove the following:

1. `<script src="/tailwind.css"></script>` (or CDN links)
2. `<script>tailwind.config = ...</script>`
3. `<link rel="preconnect" ...>` for fonts
4. `<link href="...fonts.googleapis.com..." />`
5. `<style>...</style>` blocks (already moved)

Ensure `<link rel="stylesheet" href="./style.css" />` (or import in `main.ts`) exists.

### Phase 5: Verification

1. Run `npx wxt build`
2. Check `dist/chrome-mv3/assets/` to confirm CSS generation
3. (Optional) Serve locally `python3 -m http.server -d dist/chrome-mv3` and audit network requests to ensure 0 external calls

---

## Mandatory Acceptance Testing (Visual Equivalence)

This phase MUST be executed to guarantee a non-destructive refactor.

### Test 1 - Computed Style Audit (DNA Consistency)

Run this script via Chrome DevTools **BEFORE** and **AFTER** to compare key elements:

```javascript
() => {
  const targetSelectors = ['body', 'h1', 'button', '.material-icons-round'];
  return targetSelectors.map(sel => {
    const el = document.querySelector(sel);
    if (!el) return { selector: sel, status: 'missing' };
    const style = window.getComputedStyle(el);
    return {
      selector: sel,
      font: style.fontFamily,
      weight: style.fontWeight,
      color: style.color,
      spacing: style.letterSpacing
    };
  });
}
```

**Acceptance Criteria:** `font-family` stack and `fontWeight` must be identical.

### Test 2 - Network Isolation Audit (Zero-Leak)

Execute this to ensure no external requests are triggered on load:

```javascript
() => performance.getEntriesByType('resource')
    .map(r => r.name)
    .filter(url => url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com'))
```

**Acceptance Criteria:** Result must be an **EMPTY ARRAY [ ]**.

### Test 3 - Visual & CLS Audit

- **Zero FOUC/FOIT**: Page must render with correct fonts and icons instantly
- **Zero Layout Shift**: Check CLS in Performance tab; it must be 0

---

## Utility Snippets

### Font Download Helper

Use this to quick-fetch binaries from a Google Fonts URL:

```bash
# Example for Inter
curl -L "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" -o temp.css
grep -o 'https://[^\"]*.woff2' temp.css | xargs -n1 curl -O --output-dir assets/fonts/
rm temp.css
```
