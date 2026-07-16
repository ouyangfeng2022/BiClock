# AGENTS

## Project

**BiClock (Bilibili 时钟)** — a small Manifest V3 browser extension that overlays the current time on top of the Bilibili video player. By default it shows **while in browser fullscreen and controls are visible**, because only real fullscreen avoids being covered by Bilibili's/browsers' own floating video toolbars; the user can turn off "仅全屏显示" to also show in non-fullscreen player modes. Loads directly as unpacked source; there is no build step, bundler, TypeScript, or test setup in this repo despite the parent directory being `TypeScript/`.

## Layout

- `manifest.json` — MV3 manifest. Content script `biclock.js` runs on `*://*.bilibili.com/video/*` and `*://*.bilibili.com/bangumi/*`. Declares `action.default_popup` → `popup.html`, and `permissions: ["storage"]`. Includes `browser_specific_settings.gecko.id`, so the same package targets both Firefox and Chromium.
- `biclock.js` — single content script. Creates a `.bpx-player-top-clock` div, formats the time according to user settings, and appends it next to `.bpx-player-top-left`.
- `popup.html` / `popup.css` / `popup.js` — the extension popup. Lets the user customize clock styling and time format; writes to `chrome.storage.local` on every change (auto-save), with a live preview driven by a 1-second interval while the popup is open. `popup.js` also renders a row of one-click 配色预设 (color presets: 经典 / 半透明 / B站粉 / 霓虹绿 / 琥珀 / 冰蓝) at the top of the 外观 section; each preset only sets `color` / `backgroundColor` / `bgOpacity`, so it is a popup-only convenience over existing keys — it is **not** a new setting key and is intentionally not duplicated into `biclock.js` or `DEFAULTS`.
- `icons/clock.png` — extension icon (size 200).

## Commands

There is no package manager, no `package.json`, and no scripts. To test changes:

1. Load the folder as an unpacked/temporary extension (chrome://extensions in dev mode, or `about:debugging` → This Firefox → Load Temporary Add-on).
2. Open any Bilibili `/video/` or `/bangumi/` page, enter the player, **enter browser fullscreen**, and move the mouse to show controls — with defaults (仅全屏显示 on, 常驻显示 off) the clock appears centered at the top only while both `data-screen="full"` and `data-ctrl-hidden="false"`.

There is nothing to typecheck or lint; review changes by reading the file.

## Architecture & coupling notes

- `biclock.js` is tightly coupled to Bilibili's current player DOM. It queries specific class names that can change when Bilibili ships a player update:
  - `.bpx-player-container` — the element observed for control visibility and screen mode.
  - `.bpx-player-top-left` — the sibling the clock is inserted after.
  - Attribute `data-screen` on `.bpx-player-container` — `"full"` means true browser fullscreen (Fullscreen API). Only this mode hides Bilibili's/browsers' own floating video toolbars, so by default (仅全屏显示 on) the clock is shown **only** when `data-screen="full"`. When the user turns 仅全屏显示 off, this attribute is ignored and the clock shows in any screen mode (normal, wide, web, full) — the user accepts coexisting with those overlays. Wide (`"wide"`) and web fullscreen (`"web"`) modes are otherwise intentionally excluded.
  - Attribute `data-ctrl-hidden` on `.bpx-player-container` — `"false"` means controls visible. In the default **mouse-triggered** mode (`alwaysShow=false`), this must be `"false"` for the clock to show. In **always-on** mode (`alwaysShow=true`) it is ignored. `shouldShow()` is the single gatekeeper; it first applies the `fullscreenOnly` gate, then the `alwaysShow` gate.
  - The older `bilibili-player` (`.bilibili-player-`) class prefix is **not** handled; only the current `bpx-player-` prefix is. If the clock stops appearing, the first thing to check is whether Bilibili renamed these classes.
- A `MutationObserver` watches attribute changes on `.bpx-player-container`; the 1-second `setInterval` is started only when `shouldShow()` is true and stopped otherwise. `shouldShow()` requires `data-screen="full"` only when `fullscreenOnly` is on; it additionally requires `data-ctrl-hidden="false"` unless `alwaysShow` is on. `stopTimer()` also detaches the clock node from the DOM so it doesn't linger when it shouldn't show. Don't introduce a second always-running interval — keep it tied to `shouldShow()`. Display-setting switches (`fullscreenOnly` / `alwaysShow`) arrive via `chrome.storage.onChanged` (not a player attribute), so the change handler re-runs `shouldShow()` and starts/stops the timer immediately.
- `updateClock()` re-inserts the clock node on every tick. The clock node is reused (same reference), so this moves rather than duplicates it; if you change this, preserve the "single reused node" invariant to avoid stacking duplicates. It is always appended to `.bpx-player-container` (both display modes). The node is positioned with `position: fixed` relative to the **player container's viewport rect** (`getBoundingClientRect`), not relative to the viewport as a whole — the player does not fill the viewport in non-fullscreen modes (Bilibili chrome takes up the top/sides), so a viewport-relative `posX/posY` ratio would place the clock outside the video. Container-relative coordinates keep the clock inside the video across normal/wide/web/fullscreen modes. Mounting on the container (rather than inside the top bar) also avoids the CSS transform/contain trap where a `fixed` descendant is re-anchored to a transformed ancestor; the container is a stable host. `.bpx-player-top-left` is no longer used as a mount point.
- Styling is applied imperatively via `clock.style.*`. There is no CSS file injected into the page and no shadow DOM. (The popup has its own `popup.css`, but the on-page clock is still styled imperatively.)
- User styling flows through `chrome.storage.local`. `popup.js` writes settings on every input event (auto-save, no Save button). `biclock.js` reads them at startup and subscribes to `chrome.storage.onChanged` so changes take effect on an already-open Bilibili tab without a reload.
- `DEFAULTS` is duplicated in both `popup.js` and `biclock.js`. It is the single source of truth for default values; if you change a default or add a field, **update both files**. The keys are: `fontSize`, `color`, `backgroundColor`, `bgOpacity` (0–100), `bold`, `fullscreenOnly` (scope gate: true = browser-fullscreen only, the default; false = show in any player screen mode), `alwaysShow` (display mode within that scope: false = mouse-triggered, true = always-on), `posX`/`posY` (clock position as a 0–1 ratio of the **player container's** width/height, **edge-aligned**: `(posX, posY)` is where the clock's top-left corner lands — `0/0` puts it at the container's top-left, `1/1` puts its bottom-right at the container's bottom-right, `0.5/0.5` is centered; the popup's "位置" panel is the sole source of position — there is no separate top-offset knob). Background color is stored as `#rrggbb` plus a separate `bgOpacity` percentage; both files convert to `rgba()` via the duplicated `hexToRgba()` helper. The time format is hardcoded to 24-hour with seconds (`HH:MM:SS`) and is no longer configurable, so neither `use24Hour` nor `showSeconds` exists as a setting.

## Conventions

- Vanilla JS, `var`/`function` style, browser globals only — no modules, no imports. Match this style for the content script; the file runs as a classic content script.
- Keep all DOM queries defensive: Bilibili pages are SPA-driven, so elements may not exist yet. `run()` currently assumes `.bpx-player-container` is present at `DOMContentLoaded` / on script run; if you add features, re-query at use time rather than caching long-lived references.
