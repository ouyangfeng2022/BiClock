// 与 biclock.js 中的 DEFAULTS 保持一致；改一处要同步两处。
var DEFAULTS = {
    fontSize: 30,
    color: '#ffffff',
    // 默认背景即 B 站粉品牌色，与时钟叠在 B 站播放器上的语境一致。
    backgroundColor: '#fb7299',
    bgOpacity: 100,
    bold: false,
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
    el.style.backgroundColor = hexToRgba(config.backgroundColor, config.bgOpacity / 100);
    // 圆角背景：与 biclock.js 保持一致，按字号比例缩放。
    el.style.padding = '0 ' + (config.fontSize * 0.3).toFixed(1) + 'px';
    el.style.borderRadius = (config.fontSize * 0.3).toFixed(1) + 'px';
    // 预览框尺寸远小于真实播放器，预览里始终展示默认的居中效果，
    // 自定义位置由用户在下方"位置"面板里设置。
    el.style.top = '50%';
    el.style.left = '50%';
    el.style.transform = 'translate(-50%, -50%)';
    refreshPreviewText();
}

function refreshPreviewText() {
    $('previewClock').textContent = formatTime(new Date());
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
}

function onInput() {
    readFromForm();
    $('bgOpacityValue').textContent = config.bgOpacity + '%';
    refreshOpacityTrack();
    applyToPreview();
    save();
    updateSwatchSelection();
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
            applyToPreview();
            save();
            updateSwatchSelection();
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
