# BiClock · Bilibili 时钟

一个轻量的 Manifest V3 浏览器扩展。在 Bilibili **全屏**观看视频 / 番剧时,于播放器顶部居中叠加显示当前时间,并可完全自定义样式与时间格式。

仅在「浏览器全屏(F11)+ 控制条可见」时出现 —— 既不会被 Bilibili / 浏览器自带的浮动工具栏遮挡,也不会在你专心看片时打扰画面。支持 Chromium(Chrome / Edge 等)与 Firefox,同一套代码、同一个安装包即可加载。

## 功能

- 🕐 **全屏叠加时钟** —— 进入浏览器全屏并移动鼠标显示控制条时,时钟出现在播放器顶部居中;控制条自动隐藏后随即消失,不浪费性能
- 🎨 **完全可自定义** —— 字号、文字颜色、背景色、背景透明度、上下位置、是否加粗
- ⏰ **灵活的时间格式** —— 12 / 24 小时制可选,可单独开关是否显示秒
- 🔄 **实时生效** —— 在 popup 中调整的每一项都会自动保存,并即时同步到已打开的 Bilibili 标签页,无需刷新
- 🌐 **跨浏览器** —— Manifest V3,同一套代码同时支持 Chrome / Edge / Firefox
- 🪶 **零依赖、零构建** —— 纯原生 JS,加载即用

## 安装

### Chrome / Edge(Chromium 系)

1. 打开 `chrome://extensions`(Edge 为 `edge://extensions`)
2. 右上角打开「开发者模式」
3. 点击「加载已解压的扩展程序」,选择本项目文件夹

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击「加载临时附加组件…」
3. 选择本目录下的 `manifest.json`

> Firefox 临时附加组件在浏览器关闭后会失效。若需永久安装,需要将扩展签名(提交到 [addons.mozilla.org](https://addons.mozilla.org)),或使用 [Firefox Developer Edition / Nightly](https://www.mozilla.org/firefox/developer/) 并设置 `xpinstall.signatures.required = false`。

## 使用

1. 打开任意 Bilibili 视频页(`/video/` 或 `/bangumi/`)
2. 按 **F11** 进入**浏览器全屏**(注意:网页全屏按钮和宽屏模式都不会触发时钟)
3. 鼠标移入播放器区域使控制条显示 —— 顶部居中即出现当前时间;控制条自动隐藏后时钟也随之消失
4. 点击工具栏的扩展图标,在弹出的 popup 中自定义时钟样式,改动会即时生效

## 自定义项

在扩展 popup 中可调整以下选项,所有改动自动保存到 `chrome.storage.local`:

| 选项 | 说明 |
| --- | --- |
| 字号 | 时钟文字大小 |
| 文字颜色 | 时钟前景色 |
| 背景色 + 背景透明度 | 背景以 `rgba()` 形式应用,透明度 0–100% |
| 上下位置 | 距播放器顶部的偏移 |
| 加粗 | 是否加粗显示 |
| 24 小时制 | 关闭则使用 12 小时制(上午 / 下午) |
| 显示秒 | 是否在时间中包含秒 |

## 工作原理

`biclock.js` 作为内容脚本注入 Bilibili 页面,创建一个 `.bpx-player-top-clock` 的 `div`,并通过 `MutationObserver` 监听 `.bpx-player-container` 的两个属性:

- `data-screen="full"` —— 表示真正的浏览器全屏(Fullscreen API)。只有这种模式才会隐藏 Bilibili / 浏览器自带的浮动视频工具栏,因此时钟**仅**在此模式下显示;宽屏(`"wide"`)和网页全屏(`"web"`)模式会保留那些覆盖层,被**故意排除**。
- `data-ctrl-hidden="false"` —— 表示控制条可见。

两者同时满足时 `shouldShow()` 才返回真:此时启动 1 秒定时器刷新时钟;任一条件不满足时停止定时器,并把时钟节点从 DOM 中移除,避免在非全屏模式下残留。

时钟节点在每次 tick 中通过 `insertBefore` 被重新定位到 `.bpx-player-top-left` 的后面,节点本身始终是同一个引用,避免重复堆叠。用户样式通过 `chrome.storage.local` 传递,`biclock.js` 在启动时读取并订阅 `chrome.storage.onChanged`,因此 popup 中的改动能即时反映到已打开的标签页。

## 已知限制

扩展强依赖 Bilibili 当前播放器的 DOM 结构(`.bpx-player-container`、`.bpx-player-top-left`,以及属性 `data-screen`、`data-ctrl-hidden`)。如果 Bilibili 改版调整这些类名或属性(历史上已经从 `bilibili-player-` 前缀改到过 `bpx-player-`),时钟会失效。失效时优先排查类名 / 属性是否变更。

## 许可证

[MIT License](./LICENSE)
