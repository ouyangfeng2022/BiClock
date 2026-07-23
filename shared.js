// popup.js 与 biclock.js 共享的纯函数与数据。
//
// 加载顺序：popup 端由 popup.html 在 popup.js 之前 <script> 引入；
// 内容脚本端由 manifest 的 content_scripts 在 biclock.js 之前注入。
// 这里所有 var/function 都进入脚本环境的共享全局，供后续脚本直接引用，
// 不使用 ES module，符合本项目 var/function 风格约束。
//
// 这里是 DEFAULTS、renderClockLayout 等逻辑的唯一来源；
// 改一处 popup 与内容脚本同时生效，不再需要两边手工同步。

// 默认配置，同时也是 chrome.storage.local 的默认值。popup.js 与 biclock.js
// 都从这里读，不再各自维护一份。
var DEFAULTS = {
    fontSize: 30,
    color: '#ffffff',
    // 默认背景即 B 站粉品牌色，与时钟叠在 B 站播放器上的语境一致。
    backgroundColor: '#fb7299',
    bgOpacity: 100,
    bold: true,
    // 主题字段由 popup 的主题卡写入；内容脚本只消费最终样式值。
    clockStyle: 'bili-pink',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Microsoft YaHei", sans-serif',
    textShadow: 'none',
    borderColor: '#ffffff',
    borderOpacity: 0,
    borderWidth: 0,
    accentColor: '#fb7299',
    clockLayout: 'single',
    // 仅全屏显示：true = 只在浏览器全屏下显示（默认，避开 B 站/浏览器
    // 原生视频浮窗被挡住的场景）；false = 任何播放器屏幕模式下都显示。
    fullscreenOnly: true,
    // 显示模式：false = 鼠标触发（默认，仅在控件可见时显示），
    // true = 常驻（进入浏览器全屏后一直显示，不随控件隐藏）。
    alwaysShow: false,
    // 位置由 options 页的预览拖拽控制；posX/posY 是相对播放器容器的 0..1 比例
    // （edge-aligned：translate 按自身尺寸反向偏移，posX=0 左贴左，1 右贴右，
    // 0.5 水平居中；posY 同理），这样不同分辨率的屏幕都能正确还原而非写死像素。
    // 默认顶部水平居中、且与视频顶边无间距：posY=0 让时钟左上角贴到容器顶端，
    // translateY(0%) 无偏移，所以时钟真正贴顶（旧值 0.04 会在顶部留约 4% 空隙，
    // 导致「默认位置」与「居中」按钮看似不同——见 options.js resetPosition）。
    posX: 0.5,
    posY: 0,
    // 用户在 options 页保存的自定义主题列表；仅 options 页读写，内容脚本不消费。
    // 每个元素形状：{ id, name } + THEME_STYLE_KEYS 的 12 个外观键
    // + THEME_CSS_KEYS 的 2 个 CSS 键（customCss / customCssEnabled）。
    // id 形如 "custom_<timestamp>"，作为 clockStyle 标记当前激活的自定义主题。
    customThemes: [],
    // 自定义 CSS：用户在 options 页写的任意 CSS，通过 <style> 注入叠加到时钟节点上，
    // 实现内置主题/外观键做不到的视觉效果（动画、阴影、渐变 等）。
    // 语义：预设主题不带 CSS（切回预设会清空当前 CSS）；自定义主题把当前 CSS
    // 作为快照存进主题卡，切回该主题时整体恢复（包括 CSS）。详见 THEME_CSS_KEYS。
    // customCssEnabled 关掉即不注入；空串视为未填写。
    customCss: '',
    customCssEnabled: false
};

// 已下线、不再有主题卡的旧主题 id。打开旧版本遗留的存储时需要回退到默认。
var REMOVED_THEME_IDS = ['minimal', 'glass', 'neon', 'retro', 'corner'];

// 主题能够覆盖的外观字段（位置/显示开关等不归主题管）。
var THEME_STYLE_KEYS = [
    'fontSize', 'color', 'backgroundColor', 'bgOpacity', 'bold',
    'fontFamily', 'textShadow', 'borderColor', 'borderOpacity',
    'borderWidth', 'accentColor', 'clockLayout'
];

// 自定义 CSS 快照键：保存/恢复自定义主题时随 THEME_STYLE_KEYS 一起带走，
// 让自定义主题成为「一套完整外观（含 CSS）」。
// 预设主题（THEMES）不带这两个键 —— applyTheme 切到预设主题时会显式把
// config.customCss 置空、customCssEnabled 置 false，呈现纯净外观。
// 内容脚本 biclock.js 不引用本常量：它只消费最终的 config.customCss /
// config.customCssEnabled，无论是手填还是从主题恢复，都走同一条注入路径。
var THEME_CSS_KEYS = ['customCss', 'customCssEnabled'];

// 「外观类」inline style 属性清单：biclock.js / popup.js / options.js 三处
// applyStyles / applyToPreview 共用，避免三份清单漂移。
//
// 设计：自定义 CSS 启用时（cssMode = customCssEnabled && customCss），
// JS 不再把这些属性灌成 inline style，而是逐项 removeProperty 清掉，
// 让用户 CSS 成为外观的唯一来源（无需 !important）。
// 注意：position / left / top / transform / zIndex / userSelect 不在此列——
// 它们属于定位/交互层，CSS 模式下仍由 JS 计算，用户 CSS 只专注外观。
var APPEARANCE_INLINE_KEYS = [
    'color', 'backgroundColor', 'fontWeight', 'fontFamily', 'fontSize',
    'textShadow', 'border', 'padding', 'borderRadius', 'boxSizing'
];

function pad(n) {
    return n.toString().padStart(2, '0');
}

// 固定 24 小时制 + 显示秒；不再可配置。
function formatTime(now) {
    return pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
}

function makeClockPart(className, text) {
    var part = document.createElement('span');
    part.className = className;
    part.textContent = text;
    return part;
}

// hex (#rrggbb) + 0..1 alpha -> rgba()，背景色用
function hexToRgba(hex, alpha) {
    var h = hex.replace('#', '');
    if (h.length === 3) {
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    var r = parseInt(h.substring(0, 2), 16) || 0;
    var g = parseInt(h.substring(2, 4), 16) || 0;
    var b = parseInt(h.substring(4, 6), 16) || 0;
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

// 形态主题会重组时钟节点，而不只是调整颜色。所有子节点在每秒更新时
// 被复用为同一父节点的最新内容，始终保持页面中只有一个时钟节点。
//
// prefix 决定子节点 className 前缀：
//   - popup 预览用 'clock'（与 popup.css 选择器对齐）
//   - 内容脚本用 'bpx-player-clock'（与 B 站播放器命名空间对齐）
function renderClockLayout(el, time, style, prefix) {
    var parts = time.split(':');
    style = style || {};
    prefix = prefix || 'clock';
    el.replaceChildren();
    el.style.display = 'inline-flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.lineHeight = '1.2';
    // 每次重绘先清掉形态主题留下的布局状态，主题之间切换不会串样式。
    el.style.flexDirection = 'row';
    el.style.overflow = 'visible';
    el.style.backgroundImage = 'none';
    el.style.gap = '0';

    if (style.clockLayout === 'segments') {
        el.style.gap = '3px';
        el.style.padding = '0';
        el.style.backgroundColor = 'transparent';
        el.style.border = '0';
        parts.forEach(function (partText) {
            var part = makeClockPart(prefix + '-segment', partText);
            part.style.padding = '0.12em 0.24em';
            part.style.borderRadius = '0.22em';
            part.style.backgroundColor = hexToRgba(style.backgroundColor, style.bgOpacity / 100);
            part.style.border = style.borderWidth + 'px solid ' + hexToRgba(style.borderColor, style.borderOpacity / 100);
            el.appendChild(part);
        });
        return;
    }

    if (style.clockLayout === 'recording') {
        el.style.gap = '0.38em';
        var dot = makeClockPart(prefix + '-rec-dot', '');
        dot.style.width = '0.44em';
        dot.style.height = '0.44em';
        dot.style.borderRadius = '50%';
        dot.style.backgroundColor = style.accentColor;
        dot.style.boxShadow = '0 0 0.34em ' + hexToRgba(style.accentColor, 0.68);
        var rec = makeClockPart(prefix + '-rec-label', 'REC');
        rec.style.color = style.accentColor;
        rec.style.fontSize = '0.52em';
        rec.style.letterSpacing = '0.08em';
        el.appendChild(dot);
        el.appendChild(rec);
        el.appendChild(makeClockPart(prefix + '-rec-time', time));
        return;
    }

    if (style.clockLayout === 'corner') {
        el.style.gap = '0.22em';
        el.style.padding = '0';
        el.style.backgroundColor = 'transparent';
        el.style.border = '0';
        var left = makeClockPart(prefix + '-corner-left', '');
        var right = makeClockPart(prefix + '-corner-right', '');
        [left, right].forEach(function (corner) {
            corner.style.width = '0.38em';
            corner.style.height = '1em';
            corner.style.borderColor = style.accentColor;
            corner.style.borderStyle = 'solid';
            corner.style.borderWidth = '0.1em';
        });
        left.style.borderRightWidth = '0';
        right.style.borderLeftWidth = '0';
        el.appendChild(left);
        el.appendChild(makeClockPart(prefix + '-corner-time', time));
        el.appendChild(right);
        return;
    }

    if (style.clockLayout === 'analog') {
        el.style.padding = '0';
        el.style.backgroundColor = 'transparent';
        el.style.border = '0';
        var now = new Date();
        var dial = makeClockPart(prefix + '-analog-dial', '');
        dial.style.position = 'relative';
        dial.style.width = '2.15em';
        dial.style.height = '2.15em';
        dial.style.borderRadius = '50%';
        dial.style.backgroundColor = hexToRgba(style.backgroundColor, style.bgOpacity / 100);
        dial.style.border = style.borderWidth + 'px solid ' + hexToRgba(style.borderColor, style.borderOpacity / 100);
        dial.style.boxShadow = '0 0.12em 0.28em rgba(0, 0, 0, 0.22)';
        for (var tickIndex = 0; tickIndex < 12; tickIndex++) {
            var tick = makeClockPart(prefix + '-analog-tick', '');
            var isMajor = tickIndex % 3 === 0;
            tick.style.position = 'absolute';
            tick.style.left = '50%';
            tick.style.top = '0.18em';
            tick.style.width = isMajor ? '0.065em' : '0.04em';
            tick.style.height = isMajor ? '0.2em' : '0.12em';
            tick.style.borderRadius = '999px';
            tick.style.backgroundColor = isMajor ? style.borderColor : hexToRgba(style.color, 0.42);
            tick.style.transformOrigin = '50% 0.91em';
            tick.style.transform = 'translateX(-50%) rotate(' + (tickIndex * 30) + 'deg)';
            dial.appendChild(tick);
        }
        ['12', '3', '6', '9'].forEach(function (label, index) {
            var marker = makeClockPart(prefix + '-analog-marker', label);
            marker.style.position = 'absolute';
            marker.style.fontSize = '0.2em';
            marker.style.fontWeight = '700';
            marker.style.color = style.color;
            marker.style.lineHeight = '1';
            marker.style.left = index === 1 ? '84%' : index === 3 ? '10%' : '50%';
            marker.style.top = index === 0 ? '11%' : index === 2 ? '86%' : '50%';
            marker.style.transform = 'translate(-50%, -50%)';
            dial.appendChild(marker);
        });
        [{ angle: (now.getHours() % 12) * 30 + now.getMinutes() * 0.5, width: '0.12em', height: '0.5em', color: style.color }, { angle: now.getMinutes() * 6, width: '0.075em', height: '0.72em', color: style.borderColor }, { angle: now.getSeconds() * 6, width: '0.032em', height: '0.86em', color: style.accentColor }].forEach(function (hand, handIndex) {
            var item = makeClockPart(prefix + '-analog-hand', '');
            item.style.position = 'absolute';
            item.style.left = '50%';
            item.style.top = '50%';
            item.style.width = hand.width;
            item.style.height = hand.height;
            item.style.borderRadius = '999px';
            item.style.backgroundColor = hand.color;
            item.style.boxShadow = handIndex === 2 ? 'none' : '0 0.03em 0.06em rgba(0, 0, 0, 0.28)';
            item.style.transformOrigin = '50% 0';
            // 指针从圆心向下延伸；标准钟表角度以 12 点为 0°，故补 180° 对齐。
            item.style.transform = 'translateX(-50%) rotate(' + (hand.angle + 180) + 'deg)';
            dial.appendChild(item);
        });
        var pin = makeClockPart(prefix + '-analog-pin', '');
        pin.style.position = 'absolute';
        pin.style.left = '50%';
        pin.style.top = '50%';
        pin.style.width = '0.16em';
        pin.style.height = '0.16em';
        pin.style.borderRadius = '50%';
        pin.style.transform = 'translate(-50%, -50%)';
        pin.style.backgroundColor = style.accentColor;
        pin.style.border = '0.06em solid ' + style.backgroundColor;
        pin.style.boxShadow = 'none';
        dial.appendChild(pin);
        el.appendChild(dial);
        return;
    }

    if (style.clockLayout === 'flip') {
        el.style.gap = '0.12em';
        el.style.padding = '0';
        el.style.backgroundColor = 'transparent';
        el.style.border = '0';
        parts.forEach(function (partText) {
            var card = makeClockPart(prefix + '-flip-card', partText);
            card.style.padding = '0.13em 0.2em';
            card.style.borderRadius = '0.11em';
            card.style.backgroundImage = 'linear-gradient(to bottom, ' + hexToRgba(style.backgroundColor, style.bgOpacity / 100) + ' 48%, #020617 49%, #020617 52%, ' + hexToRgba(style.backgroundColor, style.bgOpacity / 100) + ' 53%)';
            card.style.border = style.borderWidth + 'px solid ' + hexToRgba(style.borderColor, style.borderOpacity / 100);
            card.style.boxShadow = '0 0.08em 0.12em rgba(0, 0, 0, 0.35)';
            el.appendChild(card);
        });
        return;
    }

    if (style.clockLayout === 'hud') {
        el.style.gap = '0.26em';
        el.style.padding = '0.16em 0.28em';
        el.style.borderRadius = '0';
        var tag = makeClockPart(prefix + '-hud-tag', 'TIME');
        tag.style.fontSize = '0.42em';
        tag.style.letterSpacing = '0.12em';
        tag.style.color = style.accentColor;
        el.appendChild(tag);
        el.appendChild(makeClockPart(prefix + '-hud-time', time));
        return;
    }

    if (style.clockLayout === 'calendar') {
        var date = new Date();
        el.style.flexDirection = 'column';
        el.style.gap = '0';
        el.style.padding = '0';
        el.style.overflow = 'hidden';
        var header = makeClockPart(prefix + '-calendar-header', (date.getMonth() + 1) + ' 月 ' + date.getDate() + ' 日');
        header.style.width = '100%';
        header.style.padding = '0.14em 0.55em';
        header.style.boxSizing = 'border-box';
        header.style.textAlign = 'center';
        header.style.fontSize = '0.42em';
        header.style.letterSpacing = '0.08em';
        header.style.backgroundColor = style.accentColor;
        header.style.color = '#ffffff';
        var value = makeClockPart(prefix + '-calendar-time', time);
        value.style.padding = '0.12em 0.48em 0.16em';
        value.style.fontVariantNumeric = 'tabular-nums';
        el.appendChild(header);
        el.appendChild(value);
        return;
    }

    if (style.clockLayout === 'capsule') {
        el.style.borderRadius = '999px';
    }
    el.appendChild(makeClockPart(prefix + '-single-time', time));
}

// 已下线的主题：把 config 里残留的外观字段回退到 DEFAULTS 值，并把
// clockStyle 重置为 DEFAULTS.clockStyle。落盘方式因调用方而异
// （popup 用自己的 save()，内容脚本用 chrome.storage.local.set），
// 故通过 onPersist(config) 回调交还调用方决定；为空则不落盘。
function migrateRemovedTheme(config, onPersist) {
    if (REMOVED_THEME_IDS.indexOf(config.clockStyle) === -1) return;
    THEME_STYLE_KEYS.forEach(function (key) {
        config[key] = DEFAULTS[key];
    });
    config.clockStyle = DEFAULTS.clockStyle;
    if (onPersist) onPersist(config);
}
