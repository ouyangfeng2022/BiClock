// 与 biclock.js 中的 DEFAULTS 保持一致；改一处要同步两处。
var DEFAULTS = {
    fontSize: 30,
    color: '#ffffff',
    backgroundColor: '#000000',
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

// 把表单当前值读回 config
function readFromForm() {
    config.fontSize = parseInt($('fontSize').value, 10) || DEFAULTS.fontSize;
    config.color = $('color').value;
    config.backgroundColor = $('backgroundColor').value;
    config.bgOpacity = parseInt($('bgOpacity').value, 10);
    config.bold = $('bold').checked;
    config.fullscreenOnly = $('fullscreenOnly').checked;
    config.alwaysShow = $('modeAlways').checked;
}

function fillForm() {
    $('fontSize').value = config.fontSize;
    $('color').value = config.color;
    $('backgroundColor').value = config.backgroundColor;
    $('bgOpacity').value = config.bgOpacity;
    $('bgOpacityValue').textContent = config.bgOpacity + '%';
    // 同步 range 已填充段（与 onInput 保持一致）
    var pct = config.bgOpacity;
    $('bgOpacity').style.backgroundImage =
        'linear-gradient(to right, var(--pink-track) 0%, var(--pink-track) ' + pct + '%, transparent ' + pct + '%)';
    $('bold').checked = config.bold;
    // 仅全屏显示：checked = 仅全屏（fullscreenOnly=true，默认）。
    $('fullscreenOnly').checked = config.fullscreenOnly !== false;
    // 常驻显示：单个 checkbox，checked = 常驻（alwaysShow=true）。
    $('modeAlways').checked = !!config.alwaysShow;
}

function onInput() {
    readFromForm();
    $('bgOpacityValue').textContent = config.bgOpacity + '%';
    // 给 range 画一条粉色已填充段：左→当前值用 --pink-track，其余透明露出 track 底色。
    // 与 popup.css 里 ::-webkit-slider-runnable-track 的中性底色配合，形成进度感。
    var pct = config.bgOpacity;
    $('bgOpacity').style.backgroundImage =
        'linear-gradient(to right, var(--pink-track) 0%, var(--pink-track) ' + pct + '%, transparent ' + pct + '%)';
    applyToPreview();
    save();
}

// ---- 位置面板 ----
// 拖动面板里的时针图标来设置时钟在播放器中的位置。
// posX/posY 存为 0..1 比例，biclock.js 再按真实视口尺寸换算成像素。

function updatePositionMarker() {
    var marker = $('positionMarker');
    // 比例 -> 面板内的百分比坐标。marker 自身用 translate(-50%,-50%) 居中到该点。
    marker.style.left = (config.posX * 100) + '%';
    marker.style.top = (config.posY * 100) + '%';
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

function init() {
    chrome.storage.local.get(DEFAULTS, function (stored) {
        config = stored;
        fillForm();
        applyToPreview();
        updatePositionMarker();
    });

    var ids = ['fontSize', 'color', 'backgroundColor', 'bgOpacity', 'bold', 'fullscreenOnly', 'modeAlways'];
    ids.forEach(function (id) {
        $(id).addEventListener('input', onInput);
        $(id).addEventListener('change', onInput);
    });

    initPositionPanel();
    initAppearanceReset();

    setInterval(refreshPreviewText, 1000);
}

document.readyState !== 'loading' ? init() : document.addEventListener('DOMContentLoaded', init);
