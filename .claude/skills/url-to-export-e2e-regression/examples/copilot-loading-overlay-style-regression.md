# Example: Copilot Loading Overlay Style Regression During URL Export Flow

## Incident Snapshot

Source URL:

```text
https://copilot.microsoft.com/chats/JGKawoHekkBgb4wz7kPoa
```

Symptom in real flow (`popup -> Export Now -> source loading transition`):

- loading UI appears as raw text in top-left,
- braces and counter keep changing,
- expected overlay/dialog styles are missing.

## Chain-First Map Used In This Investigation

```text
source page runtime
-> popup Export Now
-> background delegate flow
-> content/main-world loading host injection
-> loading overlay render on source page
-> chat-selection handoff
```

The first visible break happened before chat-selection, so this was handled as a source-loading render incident, not a parser/export-format incident.

## First Distortion Layer

Distortion was isolated at shadow-root style injection mode:

1. `shadow.innerHTML` with embedded `<style>`
- result: unstyled defaults (`position: static`, transparent background, default text style).

2. `createElement('style')` + `shadow.append(style, nodes)`
- result: expected computed styles (`position: absolute`, non-transparent background, expected typography).

Therefore the root cause is not "overlay not inserted" but "style injection method lost semantics on Copilot runtime context".

## Fix Pattern Applied

Replace loading host construction from:

```text
shadow.innerHTML = "<style>...</style>..."
```

to:

```text
const style = document.createElement('style');
style.textContent = '...';
shadow.append(style, containerNode);
```

Apply this in both paths:

- content script loading modal path,
- background MAIN-world fallback loading modal path.

This prevents split behavior where one path is fixed but old-tab fallback still regresses.

## Reusable Probe Script

Script path:

```text
.claude/skills/url-to-export-e2e-regression/scripts/copilot-loading-style-probe.cjs
```

Command:

```bash
SOURCE_URL="https://copilot.microsoft.com/chats/JGKawoHekkBgb4wz7kPoa" \
node .claude/skills/url-to-export-e2e-regression/scripts/copilot-loading-style-probe.cjs
```

Expected diagnosis pattern:

- `probes.innerhtml` reports unstyled computed styles,
- `probes.styleNode` reports styled computed styles,
- `verdict.summary` says to avoid `shadow.innerHTML` style injection.

## Lessons To Reuse

1. In transition-UI incidents, do not jump directly to chat-selection renderer checks; first verify source loading host style semantics.
2. For transient overlays, computed-style probes are more stable than screenshot-only judgments.
3. When popup closes quickly, selected-page assumptions become fragile; always resolve target pages by URL before probing.
4. In extension debugging with multiple local builds, lock the correct extension id at the start and keep it in every script command.
5. If a CSP/runtime context can strip or ignore style behavior for one insertion path, patch both content-path and fallback-path renderers together.
