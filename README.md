<div align="center">

<img src="./icons/clock.png" width="96" alt="BiClock">

# BiClock · Bilibili 时钟

一个轻量的 Manifest V3 浏览器扩展。在 Bilibili **全屏**观看视频 / 番剧时,于播放器顶部叠加显示当前时间,样式与位置完全可自定义。

[功能](#功能) · [预览](#预览) · [安装](#安装) · [使用](#使用) · [设置](#设置) · [工作原理](#工作原理)

</div>

> [!NOTE]
> 默认只在「**浏览器全屏(F11)+ 控制条可见**」时出现 —— 既不会被 Bilibili / 浏览器自带的浮动工具栏遮挡,也不会在你专心看片时打扰画面。需要更激进地显示时,可在 popup 中关闭「仅全屏显示」或开启「常驻显示」。

同一套代码、同一个安装包同时支持 Chromium(Chrome / Edge 等)与 Firefox。

## 功能

- **全屏叠加时钟** —— 进入浏览器全屏后,时钟出现在播放器顶部
- **两种显示模式** —— *鼠标触发*(默认,控件可见时才显示,自动隐藏后消失)或*常驻*(进入全屏后一直显示)
- **完全可自定义** —— 字号、文字颜色、背景色、背景透明度、加粗
- **二维位置调节** —— 在 popup 的位置面板上拖动 🕐 即可设定时钟在视频画面内的任意位置
- **实时生效** —— popup 中的每一项改动都会自动保存,并即时同步到已打开的 Bilibili 标签页,无需刷新
- **跨浏览器** —— Manifest V3,同时支持 Chrome / Edge / Firefox
- **零依赖、零构建** —— 纯原生 JS,加载即用

## 预览

![BiClock 设置 popup](./popup-shot.png)

> 扩展弹窗(popup)的设置界面,分为外观、显示、位置三个分区,顶部为时钟的实时预览。

## 安装

### Chrome / Edge(Chromium 系)

1. 打开 `chrome://extensions`(Edge 为 `edge://extensions`)
2. 右上角打开「开发者模式」
3. 点击「加载已解压的扩展程序」,选择本项目文件夹

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击「加载临时附加组件…」
3. 选择本目录下的 `manifest.json`

> [!TIP]
> Firefox 临时附加组件在浏览器关闭后会失效。若需永久安装,需将扩展签名(提交到 [addons.mozilla.org](https://addons.mozilla.org)),或使用 [Firefox Developer Edition / Nightly](https://www.mozilla.org/firefox/developer/) 并设置 `xpinstall.signatures.required = false`。

## 使用

1. 打开任意 Bilibili 视频页(`/video/` 或 `/bangumi/`)
2. 按 **F11** 进入**浏览器全屏**(网页全屏按钮和宽屏模式都不会触发时钟)
3. 移动鼠标使控制条显示,时钟出现(默认的鼠标触发模式)
4. 点击工具栏的扩展图标,在 popup 中切换显示模式、自定义样式或拖动位置,改动即时生效

## 设置

所有改动自动保存到 `chrome.storage.local`,无需点击保存按钮。

| 设置项 | 说明 |
| --- | --- |
| 字体大小 | 时钟文字大小(px) |
| 文字颜色 | 时钟前景色 |
| 背景颜色 + 透明度 | 背景以 `rgba()` 形式应用,透明度 0–100% |
| 粗体 | 是否加粗显示 |
| 仅全屏显示 | 开(默认)= 只在浏览器全屏下显示;关 = 普通播放 / 宽屏 / 网页全屏也都显示 |
| 常驻显示 | 关(默认)= 控件可见时才显示(鼠标触发);开 = 在「仅全屏显示」选定的范围内一直显示 |
| 位置 | 拖动面板里的 🕐 设定时钟在播放器中的位置 |

> [!NOTE]
> 时间格式固定为 **24 小时制 + 显示秒**(`HH:MM:SS`),不可配置。

## 工作原理

`biclock.js` 作为内容脚本注入 Bilibili 页面,创建一个 `.bpx-player-top-clock` 的 `div`,并通过 `MutationObserver` 监听 `.bpx-player-container` 的两个属性:

- **`data-screen`** —— `"full"` 表示真正的浏览器全屏(Fullscreen API)。只有这种模式才会隐藏 Bilibili / 浏览器自带的浮动视频工具栏,因此默认(仅全屏显示)**仅**在此模式下显示;宽屏(`"wide"`)和网页全屏(`"web"`)会保留那些覆盖层,被**故意排除**。关闭「仅全屏显示」后此属性被忽略,任何屏幕模式都显示。
- **`data-ctrl-hidden`** —— `"false"` 表示控制条可见。仅在「鼠标触发」模式下参与判断;「常驻」模式忽略它。

`shouldShow()` 是显示与否的唯一判官,先应用「仅全屏显示」这一范围门,再应用「常驻 / 鼠标触发」这一模式门:

- **鼠标触发**(默认,`alwaysShow=false`):在范围门通过的前提下,再要求控制条可见。
- **常驻**(`alwaysShow=true`):只要范围门通过即一直显示,忽略控制条可见性。

满足显示条件时启动 1 秒定时器刷新时钟;不满足时停止定时器,并把时钟节点从 DOM 中移除,避免残留。用户在 popup 中切换 `fullscreenOnly` / `alwaysShow` 的动作通过 `chrome.storage.onChanged` 实时到达,内容脚本立即重新判断并启停定时器,无需刷新页面。

时钟节点在每次 tick 中被重新挂回 `.bpx-player-container`(节点本身始终是同一个引用,不会重复堆叠)。定位使用 `position: fixed` + 播放器容器的视口坐标:播放器在非全屏模式下并不铺满视口(Bilibili 网页 chrome 占据上下 / 两侧),若用视口坐标比例换算,时钟会跑到视频画面之外;改为相对容器视口矩形计算,才能保证在普通 / 宽屏 / 网页全屏 / 浏览器全屏下都落在视频画面内。

## 已知限制

> [!WARNING]
> 扩展强依赖 Bilibili 当前播放器的 DOM 结构(`.bpx-player-container`、属性 `data-screen` / `data-ctrl-hidden`)。Bilibili 历史上已从 `bilibili-player-` 前缀改到过 `bpx-player-`;若再次改版调整这些类名或属性,时钟会失效。失效时优先排查类名 / 属性是否变更。
