// 与 biclock.js 中的 DEFAULTS 保持一致；改一处要同步两处。
var DEFAULTS = {
    fontSize: 30,
    color: '#ffffff',
    // 默认背景即 B 站粉品牌色，与时钟叠在 B 站播放器上的语境一致。
    backgroundColor: '#fb7299',
    bgOpacity: 100,
    bold: true,
    // 主题只覆盖视觉相关字段；位置与显示开关始终由用户独立控制。
    clockStyle: 'bili-pink',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Microsoft YaHei", sans-serif',
    textShadow: 'none',
    borderColor: '#ffffff',
    borderOpacity: 0,
    borderWidth: 0,
    accentColor: '#fb7299',
    clockLayout: 'single',
    // 仅全屏显示：true（默认）只在浏览器全屏下显示；false 任意屏幕模式都显示。
    fullscreenOnly: true,
    // 显示模式：false = 鼠标触发（默认），true = 常驻。
    alwaysShow: false,
    // posX/posY 是相对视口宽高的 0..1 比例；初始为顶部居中。
    posX: 0.5,
    posY: 0.04
};

// 颜色色块：popup 专用的便捷入口，点击只覆盖对应的一个键（color 或
// backgroundColor），不引入新设置键，也不需要同步到 biclock.js。
// 取色按"视频画面上可读 + 小色块上彼此易区分"挑：每个色块都落在明显不同的
// 色相上，避免几个深色挤在一起分不清。
var TEXT_SWATCHES = ['#ffffff', '#000000', '#fb7299', '#ffd66e', '#39ff14', '#7fdbff'];
var BG_SWATCHES   = ['#fb7299', '#000000', '#ffffff', '#2563eb', '#16a34a', '#dc2626'];

// 选中主题时直接写入最终样式值，内容脚本无须理解主题名称也能立即更新。
// clockStyle 仅供 popup 标记当前选择；用户手动改外观时会变为 custom。
var THEMES = [
    {
        id: 'bili-pink', name: 'Bilibili 粉', note: '默认品牌标签',
        fontSize: 30, color: '#ffffff', backgroundColor: '#fb7299', bgOpacity: 100, bold: true,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Microsoft YaHei", sans-serif',
        textShadow: 'none', borderColor: '#ffffff', borderOpacity: 0, borderWidth: 0,
        accentColor: '#fb7299', clockLayout: 'single'
    },
    {
        id: 'pods', name: '分舱数码', note: '三段独立数字舱',
        fontSize: 30, color: '#eff6ff', backgroundColor: '#26354a', bgOpacity: 96, bold: true,
        fontFamily: 'ui-monospace, "Roboto Mono", SFMono-Regular, Menlo, Consolas, monospace',
        textShadow: 'none', borderColor: '#8db4e8', borderOpacity: 58, borderWidth: 1,
        accentColor: '#8db4e8', clockLayout: 'segments'
    },
    {
        id: 'capsule', name: '胶囊计时器', note: '圆润轻盈的横条',
        fontSize: 30, color: '#ffe2a8', backgroundColor: '#17120b', bgOpacity: 92, bold: true,
        fontFamily: 'ui-monospace, "Roboto Mono", SFMono-Regular, Menlo, Consolas, monospace',
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.45)', borderColor: '#ffe2a8', borderOpacity: 62, borderWidth: 1,
        accentColor: '#ffe2a8', clockLayout: 'capsule'
    },
    {
        id: 'recording', name: '录像时间码', note: 'REC 播出状态条',
        fontSize: 29, color: '#ffffff', backgroundColor: '#171717', bgOpacity: 94, bold: true,
        fontFamily: 'ui-monospace, "Roboto Mono", SFMono-Regular, Menlo, Consolas, monospace',
        textShadow: 'none', borderColor: '#ff4d4f', borderOpacity: 72, borderWidth: 1,
        accentColor: '#ff3b30', clockLayout: 'recording'
    },
    {
        id: 'analog', name: '指针表盘', note: '圆形模拟时钟',
        fontSize: 48, color: '#e8e5de', backgroundColor: '#3b3d3b', bgOpacity: 96, bold: true,
        fontFamily: 'ui-monospace, "Roboto Mono", SFMono-Regular, Menlo, Consolas, monospace',
        textShadow: 'none', borderColor: '#aaa69c', borderOpacity: 82, borderWidth: 2,
        accentColor: '#a87078', clockLayout: 'analog'
    },
    {
        id: 'flip', name: '翻页时钟', note: '复古翻牌数字',
        fontSize: 31, color: '#f8fafc', backgroundColor: '#111827', bgOpacity: 97, bold: true,
        fontFamily: 'ui-monospace, "Roboto Mono", SFMono-Regular, Menlo, Consolas, monospace',
        textShadow: '0 1px 1px rgba(0, 0, 0, 0.8)', borderColor: '#475569', borderOpacity: 100, borderWidth: 1,
        accentColor: '#94a3b8', clockLayout: 'flip'
    },
    {
        id: 'hud', name: '科幻 HUD', note: '取景框状态读数',
        fontSize: 28, color: '#a7f3d0', backgroundColor: '#06281f', bgOpacity: 52, bold: true,
        fontFamily: 'ui-monospace, "Roboto Mono", SFMono-Regular, Menlo, Consolas, monospace',
        textShadow: '0 0 0.42em rgba(74, 222, 128, 0.7)', borderColor: '#4ade80', borderOpacity: 88, borderWidth: 1,
        accentColor: '#4ade80', clockLayout: 'hud'
    },
    {
        id: 'calendar', name: '日历桌牌', note: '日期与时间卡片',
        fontSize: 27, color: '#172033', backgroundColor: '#fffdf5', bgOpacity: 98, bold: true,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Microsoft YaHei", sans-serif',
        textShadow: 'none', borderColor: '#f43f5e', borderOpacity: 75, borderWidth: 1,
        accentColor: '#f43f5e', clockLayout: 'calendar'
    }
];

var THEME_STYLE_KEYS = [
    'fontSize', 'color', 'backgroundColor', 'bgOpacity', 'bold',
    'fontFamily', 'textShadow', 'borderColor', 'borderOpacity', 'borderWidth',
    'accentColor', 'clockLayout'
];

var config = {};

function $(id) {
    return document.getElementById(id);
}

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

// 不同主题可重组时钟的内部结构。样式仍来自主题设置，形态由
// clockLayout 决定，因此用户切换时看到的不是单纯换色。
function renderClockLayout(el, time, style) {
    var parts = time.split(':');
    style = style || config;
    el.replaceChildren();
    el.style.display = 'inline-flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.lineHeight = '1.2';
    // 每次重绘先清掉形态主题留下的布局状态，主题之间切换不会串样式。
    el.style.flexDirection = 'row';
    el.style.overflow = 'visible';
    el.style.backgroundImage = 'none';

    if (style.clockLayout === 'segments') {
        el.style.gap = '3px';
        el.style.padding = '0';
        el.style.backgroundColor = 'transparent';
        el.style.border = '0';
        parts.forEach(function (partText) {
            var part = makeClockPart('clock-segment', partText);
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
        var dot = makeClockPart('clock-rec-dot', '');
        dot.style.width = '0.44em';
        dot.style.height = '0.44em';
        dot.style.borderRadius = '50%';
        dot.style.backgroundColor = style.accentColor;
        dot.style.boxShadow = '0 0 0.34em ' + hexToRgba(style.accentColor, 0.68);
        var rec = makeClockPart('clock-rec-label', 'REC');
        rec.style.color = style.accentColor;
        rec.style.fontSize = '0.52em';
        rec.style.letterSpacing = '0.08em';
        var value = makeClockPart('clock-rec-time', time);
        el.appendChild(dot);
        el.appendChild(rec);
        el.appendChild(value);
        return;
    }

    if (style.clockLayout === 'corner') {
        el.style.gap = '0.22em';
        el.style.padding = '0';
        el.style.backgroundColor = 'transparent';
        el.style.border = '0';
        var left = makeClockPart('clock-corner-left', '');
        var right = makeClockPart('clock-corner-right', '');
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
        el.appendChild(makeClockPart('clock-corner-time', time));
        el.appendChild(right);
        return;
    }

    if (style.clockLayout === 'analog') {
        el.style.padding = '0';
        el.style.backgroundColor = 'transparent';
        el.style.border = '0';
        var now = new Date();
        var dial = makeClockPart('clock-analog-dial', '');
        dial.style.position = 'relative';
        dial.style.width = '2.15em';
        dial.style.height = '2.15em';
        dial.style.borderRadius = '50%';
        dial.style.backgroundColor = hexToRgba(style.backgroundColor, style.bgOpacity / 100);
        dial.style.border = style.borderWidth + 'px solid ' + hexToRgba(style.borderColor, style.borderOpacity / 100);
        dial.style.boxShadow = '0 0.12em 0.28em rgba(0, 0, 0, 0.22)';
        for (var tickIndex = 0; tickIndex < 12; tickIndex++) {
            var tick = makeClockPart('clock-analog-tick', '');
            var isMajor = tickIndex % 3 === 0;
            tick.style.position = 'absolute'; tick.style.left = '50%'; tick.style.top = '0.18em';
            tick.style.width = isMajor ? '0.065em' : '0.04em'; tick.style.height = isMajor ? '0.2em' : '0.12em';
            tick.style.borderRadius = '999px'; tick.style.backgroundColor = isMajor ? style.borderColor : hexToRgba(style.color, 0.42);
            tick.style.transformOrigin = '50% 0.91em';
            tick.style.transform = 'translateX(-50%) rotate(' + (tickIndex * 30) + 'deg)';
            dial.appendChild(tick);
        }
        ['12', '3', '6', '9'].forEach(function (label, index) {
            var marker = makeClockPart('clock-analog-marker', label);
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
            var item = makeClockPart('clock-analog-hand', '');
            item.style.position = 'absolute';
            item.style.left = '50%'; item.style.top = '50%';
            item.style.width = hand.width; item.style.height = hand.height;
            item.style.borderRadius = '999px'; item.style.backgroundColor = hand.color;
            item.style.boxShadow = handIndex === 2 ? 'none' : '0 0.03em 0.06em rgba(0, 0, 0, 0.28)';
            item.style.transformOrigin = '50% 0';
            // 指针从圆心向下延伸；标准钟表角度以 12 点为 0°，故补 180° 对齐。
            item.style.transform = 'translateX(-50%) rotate(' + (hand.angle + 180) + 'deg)';
            dial.appendChild(item);
        });
        var pin = makeClockPart('clock-analog-pin', '');
        pin.style.position = 'absolute'; pin.style.left = '50%'; pin.style.top = '50%';
        pin.style.width = '0.16em'; pin.style.height = '0.16em'; pin.style.borderRadius = '50%';
        pin.style.transform = 'translate(-50%, -50%)'; pin.style.backgroundColor = style.accentColor;
        pin.style.border = '0.06em solid ' + style.backgroundColor;
        pin.style.boxShadow = 'none';
        dial.appendChild(pin); el.appendChild(dial);
        return;
    }

    if (style.clockLayout === 'flip') {
        el.style.gap = '0.12em'; el.style.padding = '0'; el.style.backgroundColor = 'transparent'; el.style.border = '0';
        parts.forEach(function (partText) {
            var card = makeClockPart('clock-flip-card', partText);
            card.style.padding = '0.13em 0.2em'; card.style.borderRadius = '0.11em';
            card.style.backgroundImage = 'linear-gradient(to bottom, ' + hexToRgba(style.backgroundColor, style.bgOpacity / 100) + ' 48%, #020617 49%, #020617 52%, ' + hexToRgba(style.backgroundColor, style.bgOpacity / 100) + ' 53%)';
            card.style.border = style.borderWidth + 'px solid ' + hexToRgba(style.borderColor, style.borderOpacity / 100);
            card.style.boxShadow = '0 0.08em 0.12em rgba(0, 0, 0, 0.35)'; el.appendChild(card);
        });
        return;
    }

    if (style.clockLayout === 'hud') {
        el.style.gap = '0.26em'; el.style.padding = '0.16em 0.28em'; el.style.borderRadius = '0';
        var tag = makeClockPart('clock-hud-tag', 'TIME');
        tag.style.fontSize = '0.42em'; tag.style.letterSpacing = '0.12em'; tag.style.color = style.accentColor;
        el.appendChild(tag); el.appendChild(makeClockPart('clock-hud-time', time));
        return;
    }

    if (style.clockLayout === 'calendar') {
        var date = new Date();
        el.style.flexDirection = 'column'; el.style.gap = '0'; el.style.padding = '0'; el.style.overflow = 'hidden';
        var header = makeClockPart('clock-calendar-header', (date.getMonth() + 1) + ' 月 ' + date.getDate() + ' 日');
        header.style.width = '100%'; header.style.padding = '0.14em 0.55em'; header.style.boxSizing = 'border-box';
        header.style.textAlign = 'center'; header.style.fontSize = '0.42em'; header.style.letterSpacing = '0.08em';
        header.style.backgroundColor = style.accentColor; header.style.color = '#ffffff';
        var value = makeClockPart('clock-calendar-time', time);
        value.style.padding = '0.12em 0.48em 0.16em'; value.style.fontVariantNumeric = 'tabular-nums';
        el.appendChild(header); el.appendChild(value);
        return;
    }

    if (style.clockLayout === 'capsule') {
        el.style.borderRadius = '999px';
    }
    el.appendChild(makeClockPart('clock-single-time', time));
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

// 把任意用户输入归一化为 #rrggbb 小写；不合法返回 null。
// 接受可选前缀 #，3 位 shorthand 会展开为 6 位。
function normalizeHex(raw) {
    if (typeof raw !== 'string') return null;
    var h = raw.trim().replace(/^#/, '').toLowerCase();
    if (!/^[0-9a-f]{6}$/.test(h)) {
        if (/^[0-9a-f]{3}$/.test(h)) {
            h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        } else {
            return null;
        }
    }
    return '#' + h;
}

function applyToPreview() {
    var el = $('previewClock');
    el.style.fontSize = config.fontSize + 'px';
    el.style.color = config.color;
    el.style.fontWeight = config.bold ? 'bold' : 'normal';
    el.style.fontFamily = config.fontFamily;
    el.style.textShadow = config.textShadow;
    el.style.backgroundColor = hexToRgba(config.backgroundColor, config.bgOpacity / 100);
    el.style.border = config.borderWidth + 'px solid ' + hexToRgba(config.borderColor, config.borderOpacity / 100);
    el.style.boxSizing = 'border-box';
    // 圆角背景：与 biclock.js 保持一致，按字号比例缩放。
    el.style.padding = '0 ' + (config.fontSize * 0.3).toFixed(1) + 'px';
    el.style.borderRadius = (config.fontSize * 0.3).toFixed(1) + 'px';
    // 居中由 .preview 的 flex 容器负责（不再用 absolute + transform），
    // 这样大字号下预览条会自然撑高，不会被 overflow: hidden 裁掉。
    // 自定义位置由用户在下方"位置"面板里设置。
    refreshPreviewText();
}

function refreshPreviewText() {
    renderClockLayout($('previewClock'), formatTime(new Date()));
}

function save() {
    chrome.storage.local.set(config);
}

// 把表单当前值读回 config。
// 颜色字段由 Hex 校验函数 normalizeHexInput 负责：合法才落回 config，
// 不合法时 readFromForm 跳过该字段（保留上次有效值），由调用方决定是否落盘。
function readFromForm() {
    config.fontSize = parseInt($('fontSize').value, 10) || DEFAULTS.fontSize;
    var textHex = normalizeHex($('colorHex').value);
    if (textHex) config.color = textHex;
    var bgHex = normalizeHex($('bgColorHex').value);
    if (bgHex) config.backgroundColor = bgHex;
    config.bgOpacity = parseInt($('bgOpacity').value, 10);
    config.bold = $('bold').checked;
    config.fullscreenOnly = $('fullscreenOnly').checked;
    config.alwaysShow = $('modeAlways').checked;
}

// 把当前 backgroundColor + bgOpacity 写入透明度滑条的 --clock-bg，
// 让滑条轨道直接呈现真实时钟背景的半透明色（叠在棋盘格底上）。
function refreshOpacityTrack() {
    $('bgOpacity').style.setProperty(
        '--clock-bg',
        hexToRgba(config.backgroundColor, config.bgOpacity / 100)
    );
}

function fillForm() {
    $('fontSize').value = config.fontSize;
    $('colorHex').value = config.color;
    $('bgColorHex').value = config.backgroundColor;
    // 输入框内容合法时清掉红框；保存的 config 一定是合法的。
    $('colorHex').setAttribute('aria-invalid', 'false');
    $('bgColorHex').setAttribute('aria-invalid', 'false');
    $('bgOpacity').value = config.bgOpacity;
    $('bgOpacityValue').textContent = config.bgOpacity + '%';
    refreshOpacityTrack();
    $('bold').checked = config.bold;
    // 仅全屏显示：checked = 仅全屏（fullscreenOnly=true，默认）。
    $('fullscreenOnly').checked = config.fullscreenOnly !== false;
    // 常驻显示：单个 checkbox，checked = 常驻（alwaysShow=true）。
    $('modeAlways').checked = !!config.alwaysShow;
    // 根据当前值高亮匹配的色块；非色盘内的自定义色全部不高亮。
    updateSwatchSelection();
    updateThemeSelection();
}

function onInput(event) {
    readFromForm();
    // 显示范围与常驻开关不属于主题视觉，不应把已选主题标成“自定义”。
    if (!event || ['fontSize', 'bgOpacity', 'bold'].indexOf(event.target.id) !== -1) {
        config.clockStyle = 'custom';
    }
    $('bgOpacityValue').textContent = config.bgOpacity + '%';
    refreshOpacityTrack();
    applyToPreview();
    save();
    updateSwatchSelection();
    updateThemeSelection();
}

// ---- 位置面板 ----
// 拖动面板里的时针图标来设置时钟在播放器中的位置。
// posX/posY 存为 0..1 比例，biclock.js 再按真实视口尺寸换算成像素。

function updatePositionMarker() {
    var marker = $('positionMarker');
    // left/top 是 (posX, posY) 比例点；--mx/--my 让 transform 用边角对齐镜像时钟真实定位，
    // 这样面板里标记的相对位置与播放器里时钟的相对位置一致。
    marker.style.left = (config.posX * 100) + '%';
    marker.style.top = (config.posY * 100) + '%';
    marker.style.setProperty('--mx', (config.posX * -100) + '%');
    marker.style.setProperty('--my', (config.posY * -100) + '%');
}

function setPositionFromPointer(clientX, clientY) {
    var panel = $('positionPanel');
    var rect = panel.getBoundingClientRect();
    var x = (clientX - rect.left) / rect.width;
    var y = (clientY - rect.top) / rect.height;
    // 夹到面板内，避免图标跑出可视区域。
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    config.posX = x;
    config.posY = y;
    updatePositionMarker();
    save();
}

function initPositionPanel() {
    var panel = $('positionPanel');
    var marker = $('positionMarker');

    function onMove(e) {
        e.preventDefault();
        setPositionFromPointer(e.clientX, e.clientY);
    }

    function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        marker.classList.remove('dragging');
    }

    function onDown(e) {
        // 仅鼠标左键。
        if (e.button !== 0) return;
        e.preventDefault();
        marker.classList.add('dragging');
        // 按下即定位（不用先移动一点才生效）。
        setPositionFromPointer(e.clientX, e.clientY);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    // 在整个面板上按下都可开始拖动，更符合直觉。
    panel.addEventListener('mousedown', onDown);

    $('resetPosition').addEventListener('click', function () {
        config.posX = DEFAULTS.posX;
        config.posY = DEFAULTS.posY;
        save();
        updatePositionMarker();
        applyToPreview();
    });
}

function initAppearanceReset() {
    $('resetAppearance').addEventListener('click', function () {
        config.fontSize = DEFAULTS.fontSize;
        config.color = DEFAULTS.color;
        config.backgroundColor = DEFAULTS.backgroundColor;
        config.bgOpacity = DEFAULTS.bgOpacity;
        config.bold = DEFAULTS.bold;
        config.clockStyle = DEFAULTS.clockStyle;
        config.fontFamily = DEFAULTS.fontFamily;
        config.textShadow = DEFAULTS.textShadow;
        config.borderColor = DEFAULTS.borderColor;
        config.borderOpacity = DEFAULTS.borderOpacity;
        config.borderWidth = DEFAULTS.borderWidth;
        config.accentColor = DEFAULTS.accentColor;
        config.clockLayout = DEFAULTS.clockLayout;
        save();
        fillForm();
        applyToPreview();
    });
}

// ---- 颜色色块 + Hex 输入 ----
// 色块点击即套用对应键（color 或 backgroundColor）；Hex 输入框接受任意 #rrggbb，
// 合法归一化后保存、不合法标红但不覆盖上次有效值。两种入口都同步刷新色块高亮
// 与顶部预览。

function buildSwatches(hostId, palette, applyKey) {
    var host = $(hostId);
    palette.forEach(function (hex) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'swatch';
        btn.title = hex;
        btn.setAttribute('aria-label', hex);
        btn.setAttribute('aria-pressed', 'false');
        btn.style.backgroundColor = hex;
        btn.addEventListener('click', function () {
            config[applyKey] = hex;
            config.clockStyle = 'custom';
            save();
            fillForm();
            applyToPreview();
        });
        host.appendChild(btn);
    });
}

function updateSwatchSelection() {
    var map = [
        { hostId: 'colorSwatches', key: 'color' },
        { hostId: 'bgColorSwatches', key: 'backgroundColor' }
    ];
    map.forEach(function (m) {
        var host = $(m.hostId);
        if (!host) return;
        var buttons = host.querySelectorAll('.swatch');
        buttons.forEach(function (btn) {
            btn.setAttribute('aria-pressed', btn.title === config[m.key] ? 'true' : 'false');
        });
    });
}

function applyTheme(theme) {
    THEME_STYLE_KEYS.forEach(function (key) {
        config[key] = theme[key];
    });
    config.clockStyle = theme.id;
    save();
    fillForm();
    applyToPreview();
}

// 已移除的主题会回退到默认 Bilibili 粉，避免留下没有对应卡片的状态。
function migrateRemovedTheme() {
    if (['minimal', 'glass', 'neon', 'retro', 'corner'].indexOf(config.clockStyle) === -1) return;
    var fallback = THEMES.find(function (theme) { return theme.id === DEFAULTS.clockStyle; });
    THEME_STYLE_KEYS.forEach(function (key) {
        config[key] = fallback[key];
    });
    config.clockStyle = fallback.id;
    save();
}

function buildThemeCards() {
    var host = $('themeGrid');
    THEMES.forEach(function (theme) {
        var button = document.createElement('button');
        var sample = document.createElement('span');
        var copy = document.createElement('span');
        var name = document.createElement('span');
        var note = document.createElement('span');

        button.type = 'button';
        button.className = 'theme-card';
        button.dataset.themeId = theme.id;
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', theme.name + '：' + theme.note);

        sample.className = 'theme-sample';
        sample.style.color = theme.color;
        sample.style.backgroundColor = hexToRgba(theme.backgroundColor, theme.bgOpacity / 100);
        sample.style.fontFamily = theme.fontFamily;
        sample.style.fontWeight = theme.bold ? '700' : '400';
        sample.style.textShadow = theme.textShadow;
        sample.style.border = theme.borderWidth + 'px solid ' + hexToRgba(theme.borderColor, theme.borderOpacity / 100);
        renderClockLayout(sample, '23:47:08', theme);

        copy.className = 'theme-copy';
        name.className = 'theme-name';
        name.textContent = theme.name;
        note.className = 'theme-note';
        note.textContent = theme.note;
        copy.appendChild(name);
        copy.appendChild(note);
        button.appendChild(sample);
        button.appendChild(copy);
        button.addEventListener('click', function () { applyTheme(theme); });
        host.appendChild(button);
    });
}

function updateThemeSelection() {
    var activeId = config.clockStyle;
    var hint = $('themeHint');
    document.querySelectorAll('.theme-card').forEach(function (button) {
        button.setAttribute('aria-pressed', button.dataset.themeId === activeId ? 'true' : 'false');
    });
    hint.textContent = activeId === 'custom'
        ? '自定义：已保留手动调整的外观。'
        : '选择主题会保留你的位置与显示设置。';
}

// Hex 输入：input 事件即时校验，合法归一化保存 + 刷新预览，不合法仅标红不落盘。
function bindHexInput(inputId, key) {
    var el = $(inputId);
    el.addEventListener('input', function () {
        var norm = normalizeHex(el.value);
        if (norm) {
            el.setAttribute('aria-invalid', 'false');
            // 只在完整输入时落盘（输入中途如 "#fb" 也合法字符但不完整 ——
            // 但 normalizeHex 要求 3 或 6 位，所以走到这里一定是完整值）。
            config[key] = norm;
            config.clockStyle = 'custom';
            applyToPreview();
            save();
            updateSwatchSelection();
            updateThemeSelection();
        } else {
            // 空串视为编辑中、不报错；非空且非法才标红。
            el.setAttribute('aria-invalid', el.value.trim() === '' ? 'false' : 'true');
        }
    });
    // 失焦时回填 config 中的合法值，避免输入框残留不完整内容。
    el.addEventListener('blur', function () {
        el.value = config[key];
        el.setAttribute('aria-invalid', 'false');
    });
}

function init() {
    chrome.storage.local.get(DEFAULTS, function (stored) {
        config = stored;
        migrateRemovedTheme();
        buildThemeCards();
        buildSwatches('colorSwatches', TEXT_SWATCHES, 'color');
        buildSwatches('bgColorSwatches', BG_SWATCHES, 'backgroundColor');
        fillForm();
        applyToPreview();
        updatePositionMarker();
    });

    // 颜色字段改由 bindHexInput 单独处理（含校验逻辑），其余字段走统一的 onInput。
    var ids = ['fontSize', 'bgOpacity', 'bold', 'fullscreenOnly', 'modeAlways'];
    ids.forEach(function (id) {
        $(id).addEventListener('input', onInput);
        $(id).addEventListener('change', onInput);
    });
    bindHexInput('colorHex', 'color');
    bindHexInput('bgColorHex', 'backgroundColor');

    initPositionPanel();
    initAppearanceReset();

    setInterval(refreshPreviewText, 1000);
}

document.readyState !== 'loading' ? init() : document.addEventListener('DOMContentLoaded', init);
