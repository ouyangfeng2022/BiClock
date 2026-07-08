# BiClock

一个轻量的 Manifest V3 浏览器扩展。播放 Bilibili 视频时，当播放器控制条可见，会在播放器顶部居中叠加显示当前时间（`HH:MM:SS`），方便在网页全屏 / 系统全屏时查看时间。

支持 Chromium（Chrome / Edge 等）与 Firefox，同一个安装包即可加载。

## 功能

- 在 Bilibili 播放器顶部居中显示当前时间
- 仅在播放器控制条可见时显示并刷新（鼠标移入播放器），控制条自动隐藏时停止计时，不浪费性能
- 无需任何配置，加载即用
- 纯原生 JS，无依赖、无构建步骤

## 安装

### Chrome / Edge（Chromium 系）

1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）
2. 右上角打开「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本项目文件夹

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击「加载临时附加组件…」
3. 选择本目录下的 `manifest.json`

> Firefox 临时附加组件在浏览器关闭后会失效。若需永久安装，需要将扩展签名（提交到 [addons.mozilla.org](https://addons.mozilla.org)），或使用 [Firefox Developer Edition / Nightly](https://www.mozilla.org/firefox/developer/) 并设置 `xpinstall.signatures.required = false`。

## 使用

1. 打开任意 Bilibili 视频页（`/video/` 或 `/bangumi/`）
2. 鼠标移入播放器区域，使控制条显示
3. 顶部居中即出现当前时间；控制条自动隐藏后时钟也随之消失

## 工作原理

`biclock.js` 作为内容脚本注入 Bilibili 页面，创建一个 `.bpx-player-top-clock` 的 `div`，并通过 `MutationObserver` 监听 `.bpx-player-container` 的 `data-ctrl-hidden` 属性：

- `data-ctrl-hidden="false"`（控制条可见）→ 启动 1 秒定时器刷新时钟
- 其他值（控制条隐藏）→ 停止定时器

时钟节点在每次 tick 中通过 `insertBefore` 被重新定位到 `.bpx-player-top-left` 的后面，节点本身始终是同一个引用，避免重复堆叠。

## 已知限制

扩展强依赖 Bilibili 当前播放器的 DOM 类名（`bpx-player-container`、`bpx-player-top-left`、属性 `data-ctrl-hidden`）。如果 Bilibili 改版调整这些类名（历史上已经从 `bilibili-player-` 改到过 `bpx-player-`），时钟会失效。失效时优先排查类名是否变更。

## 许可证

[MIT License](./LICENSE)
