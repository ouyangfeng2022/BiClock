# AGENTS

## Project

**BiClock (Bilibili 时钟)** — a small Manifest V3 browser extension that overlays the current time on top of the Bilibili video player while controls are visible. Loads directly as unpacked source; there is no build step, bundler, TypeScript, or test setup in this repo despite the parent directory being `TypeScript/`.

## Layout

- `manifest.json` — MV3 manifest. Content script `biclock.js` runs on `*://*.bilibili.com/video/*` and `*://*.bilibili.com/bangumi/*`. Includes `browser_specific_settings.gecko.id`, so the same package targets both Firefox and Chromium.
- `biclock.js` — single content script. Creates a `.bpx-player-top-clock` div, formats `HH:MM:SS`, and appends it next to `.bpx-player-top-left`.
- `icons/clock.png` — extension icon (size 200).

## Commands

There is no package manager, no `package.json`, and no scripts. To test changes:

1. Load the folder as an unpacked/temporary extension (chrome://extensions in dev mode, or `about:debugging` → This Firefox → Load Temporary Add-on).
2. Open any Bilibili `/video/` or `/bangumi/` page, enter the player, and move the mouse to show controls — the clock appears centered at the top while `data-ctrl-hidden="false"`.

There is nothing to typecheck or lint; review changes by reading the file.

## Architecture & coupling notes

- `biclock.js` is tightly coupled to Bilibili's current player DOM. It queries specific class names that can change when Bilibili ships a player update:
  - `.bpx-player-container` — the element observed for control visibility.
  - `.bpx-player-top-left` — the sibling the clock is inserted after.
  - Attribute `data-ctrl-hidden` on `.bpx-player-container` — `"false"` means controls visible → timer running; anything else stops the timer.
  - The older `bilibili-player` (`.bilibili-player-`) class prefix is **not** handled; only the current `bpx-player-` prefix is. If the clock stops appearing, the first thing to check is whether Bilibili renamed these classes.
- A `MutationObserver` watches attribute changes on `.bpx-player-container`; the 1-second `setInterval` is started/stopped based on `data-ctrl-hidden`. Don't introduce a second always-running interval — keep it tied to control visibility.
- `updateClock()` re-inserts the clock node on every tick (`insertBefore(... topLeft.nextSibling)`). The clock node is reused (same reference), so this moves rather than duplicates it; if you change this, preserve the "single reused node" invariant to avoid stacking duplicates.
- Styling is applied imperatively via `clock.style.*`. There is no CSS file and no shadow DOM.

## Conventions

- Vanilla JS, `var`/`function` style, browser globals only — no modules, no imports. Match this style for the content script; the file runs as a classic content script.
- Keep all DOM queries defensive: Bilibili pages are SPA-driven, so elements may not exist yet. `run()` currently assumes `.bpx-player-container` is present at `DOMContentLoaded` / on script run; if you add features, re-query at use time rather than caching long-lived references.
