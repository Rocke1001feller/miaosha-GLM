---
name: wxt-platform-parity
description: "Use when adding a new AI platform to this WXT extension, or debugging popup detection failures such as 'No active AI chat tab found', content script not activating, current tab not recognised, host permission drift, CSP origin drift, or platform registration parity issues across registry, manifest, URL patterns, and wxt.config."
---

# WXT Platform Parity

## Description

Use this skill when a platform looks implemented in one layer but fails in real usage because another required layer was not updated.

This repo has a recurring drift risk whenever a new AI platform is added or promoted to `extractionSupported: true`.
The visible symptom is often one of these:

- `No active AI chat tab found`
- popup does not highlight the current platform
- content script never runs on a supported site
- parser tests pass but live extraction fails
- M1/M6 logic exists but the platform is invisible to popup or background code

The usual root cause is not the parser. It is parity drift across multiple registration surfaces.

## What This Skill Audits

For every extraction-capable platform, verify all of these surfaces stay aligned:

1. `services/platform-slices/*/index.ts`
2. `services/platform-slices/registry.ts`
3. `services/platform-manifest.service.ts`
4. `services/url-patterns.service.ts`
5. `viewmodels/popup.viewmodel.ts`
6. `wxt.config.ts` `host_permissions`
7. `wxt.config.ts` CSP `connect-src`
8. `entrypoints/content.ts` / `entrypoints/content-main.ts` through `getContentScriptMatches()`
9. tests covering registry, manifest labels, URL detection, and config parity

## Core Principle

In this extension, a platform is only truly live when it is visible across all runtime boundaries:

```text
platform slice
  → registry
  → manifest
  → URL detection
  → popup current-tab detection
  → content-script match coverage
  → host_permissions
  → CSP connect-src
  → tests
```

If any one of these layers is missing, the platform is only partially onboarded.

## Standard Operating Procedure

### Step 1. Lock The Source Truth

Capture the exact live URL that should be recognised.

Record:

- full tab URL
- query/hash-stripped URL
- expected platform id
- expected page type (`chat`, `list`, etc.)

### Step 2. Verify Registry Parity

Check:

- slice exists under `services/platform-slices/<platform>/index.ts`
- `registry.ts` exports it through `PLATFORM_SLICES`
- `contentScriptMatches` is present for implemented platforms
- `capture` and `extractViaM6` exist when extraction is supported

### Step 3. Verify Manifest Parity

Check `services/platform-manifest.service.ts`:

- platform exists in `PLATFORM_MANIFEST`
- label is correct for popup guidance copy
- `navigationUrl` points to the real host
- `extractionSupported` matches actual implementation state

### Step 4. Verify Detection Parity

Check:

- `detectPlatformFromUrl()` recognises the live URL
- `getPageTypeForPlatform()` returns the expected page type
- popup viewmodel does not filter the platform out before detection

### Step 5. Verify Extension Boundary Parity

This is the most common failure layer.

For every extraction-supported platform, verify in `wxt.config.ts`:

- page origin is present in `host_permissions`
- any required asset origin is present in `host_permissions`
- required network origins are present in CSP `connect-src`

Rule:

**If popup/background needs to read `tab.url`, treat explicit `host_permissions` as mandatory. Do not rely on content-script matches alone.**

### Step 6. Verify Tests

Before closing the incident, ensure tests cover:

- registry platform list
- content-script match list
- extraction-supported label list
- WXT config parity for extraction-supported platform origins

## Mandatory Output Shape

When using this skill, report:

1. Symptom
2. Source Truth
3. Chain Map
4. First Missing Layer
5. Root Cause
6. Minimal Fix
7. Regression Protection

## Required Fix Pattern

When the problem is platform invisibility, prefer fixing the earliest missing registration layer.

Typical fixes:

- add missing platform slice registration
- promote `extractionSupported` when implementation is real
- add missing `host_permissions`
- add missing CSP `connect-src` origin
- add or update parity tests

Do not patch popup UI first when the platform is invisible upstream.

## Trigger Phrases

Use this skill when the user says or implies:

- `No active AI chat tab found`
- popup cannot detect current platform
- content script not running on new site
- add a new AI platform
- 平台接入
- 平台注册不全
- 权限漏配
- host_permissions
- CSP 漏配
- popup 识别不到当前标签页
