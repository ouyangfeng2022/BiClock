# AGENTS

## Project

**BiClock (Bilibili 时钟)** — a small Manifest V3 browser extension that overlays the current time on top of the Bilibili video player **while in browser fullscreen and controls are visible**. Showing only in real fullscreen avoids being covered by Bilibili's/browsers' own floating video toolbars in non-fullscreen or web-fullscreen modes. Loads directly as unpacked source; there is no build step, bundler, TypeScript, or test setup in this repo despite the parent directory being `TypeScript/`.

## Layout

- `manifest.json` — MV3 manifest. Content script `biclock.js` runs on `*://*.bilibili.com/video/*` and `*://*.bilibili.com/bangumi/*`. Declares `action.default_popup` → `popup.html`, and `permissions: ["storage"]`. Includes `browser_specific_settings.gecko.id`, so the same package targets both Firefox and Chromium.
- `biclock.js` — single content script. Creates a `.bpx-player-top-clock` div, formats the time according to user settings, and appends it next to `.bpx-player-top-left`.
- `popup.html` / `popup.css` / `popup.js` — the extension popup. Lets the user customize clock styling and time format; writes to `chrome.storage.local` on every change (auto-save), with a live preview driven by a 1-second interval while the popup is open.
- `icons/clock.png` — extension icon (size 200).

## Commands

There is no package manager, no `package.json`, and no scripts. To test changes:

1. Load the folder as an unpacked/temporary extension (chrome://extensions in dev mode, or `about:debugging` → This Firefox → Load Temporary Add-on).
2. Open any Bilibili `/video/` or `/bangumi/` page, enter the player, **enter browser fullscreen**, and move the mouse to show controls — the clock appears centered at the top only while both `data-screen="full"` and `data-ctrl-hidden="false"`.

There is nothing to typecheck or lint; review changes by reading the file.

## Architecture & coupling notes

- `biclock.js` is tightly coupled to Bilibili's current player DOM. It queries specific class names that can change when Bilibili ships a player update:
  - `.bpx-player-container` — the element observed for control visibility and screen mode.
  - `.bpx-player-top-left` — the sibling the clock is inserted after.
  - Attribute `data-screen` on `.bpx-player-container` — `"full"` means true browser fullscreen (Fullscreen API). Only this mode hides Bilibili's/browsers' own floating video toolbars, so the clock is shown **only** when `data-screen="full"`. Wide (`"wide"`) and web fullscreen (`"web"`) modes keep those overlays visible and are intentionally excluded.
  - Attribute `data-ctrl-hidden` on `.bpx-player-container` — `"false"` means controls visible. In the default **mouse-triggered** mode (`alwaysShow=false`), this must be `"false"` for the clock to show. In **always-on** mode (`alwaysShow=true`) it is ignored — the clock stays as long as `data-screen="full"`. In both modes `shouldShow()` is the single gatekeeper.
  - The older `bilibili-player` (`.bilibili-player-`) class prefix is **not** handled; only the current `bpx-player-` prefix is. If the clock stops appearing, the first thing to check is whether Bilibili renamed these classes.
- A `MutationObserver` watches attribute changes on `.bpx-player-container`; the 1-second `setInterval` is started only when `shouldShow()` is true and stopped otherwise. `shouldShow()` always requires `data-screen="full"`; it additionally requires `data-ctrl-hidden="false"` unless `alwaysShow` is on. `stopTimer()` also detaches the clock node from the DOM so it doesn't linger in non-fullscreen modes. Don't introduce a second always-running interval — keep it tied to `shouldShow()`. Mode switches arrive via `chrome.storage.onChanged` (not a player attribute), so the `alwaysShow` change handler re-runs `shouldShow()` and starts/stops the timer immediately.
- `updateClock()` re-inserts the clock node on every tick (`insertBefore(... topLeft.nextSibling)`). The clock node is reused (same reference), so this moves rather than duplicates it; if you change this, preserve the "single reused node" invariant to avoid stacking duplicates.
- Styling is applied imperatively via `clock.style.*`. There is no CSS file injected into the page and no shadow DOM. (The popup has its own `popup.css`, but the on-page clock is still styled imperatively.)
- User styling flows through `chrome.storage.local`. `popup.js` writes settings on every input event (auto-save, no Save button). `biclock.js` reads them at startup and subscribes to `chrome.storage.onChanged` so changes take effect on an already-open Bilibili tab without a reload.
- `DEFAULTS` is duplicated in both `popup.js` and `biclock.js`. It is the single source of truth for default values; if you change a default or add a field, **update both files**. The keys are: `fontSize`, `color`, `backgroundColor`, `bgOpacity` (0–100), `topOffset`, `bold`, `use24Hour`, `showSeconds`, `alwaysShow` (display mode: false = mouse-triggered, true = always-on). Background color is stored as `#rrggbb` plus a separate `bgOpacity` percentage; both files convert to `rgba()` via the duplicated `hexToRgba()` helper.

## Conventions

- Vanilla JS, `var`/`function` style, browser globals only — no modules, no imports. Match this style for the content script; the file runs as a classic content script.
- Keep all DOM queries defensive: Bilibili pages are SPA-driven, so elements may not exist yet. `run()` currently assumes `.bpx-player-container` is present at `DOMContentLoaded` / on script run; if you add features, re-query at use time rather than caching long-lived references.
