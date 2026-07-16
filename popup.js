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

// 配色预设：popup 专用的快捷配色入口，只覆盖 color / backgroundColor / bgOpacity，
// 不动 bold / 字号 / 位置，也不引入新的设置键（因此不需要同步到 biclock.js）。
// 每组都按"视频画面上可读"挑过：经典高对比、半透明柔和、B 站粉品牌色、
// 霓虹绿 / 琥珀 / 冰蓝三种带个性的深底亮字。
var PRESETS = [
    { name: '经典',   color: '#ffffff', backgroundColor: '#000000', bgOpacity: 100 },
    { name: '半透明', color: '#ffffff', backgroundColor: '#000000', bgOpacity: 55  },
    { name: 'B站粉',  color: '#ffffff', backgroundColor: '#fb7299', bgOpacity: 100 },
    { name: '霓虹绿', color: '#39ff14', backgroundColor: '#000000', bgOpacity: 70  },
    { name: '琥珀',   color: '#ffb000', backgroundColor: '#1a1200', bgOpacity: 100 },
    { name: '冰蓝',   color: '#7fdbff', backgroundColor: '#001b2e', bgOpacity: 100 }
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
    $('color').value = config.color;
    $('backgroundColor').value = config.backgroundColor;
    $('bgOpacity').value = config.bgOpacity;
    $('bgOpacityValue').textContent = config.bgOpacity + '%';
    refreshOpacityTrack();
    $('bold').checked = config.bold;
    // 仅全屏显示：checked = 仅全屏（fullscreenOnly=true，默认）。
    $('fullscreenOnly').checked = config.fullscreenOnly !== false;
    // 常驻显示：单个 checkbox，checked = 常驻（alwaysShow=true）。
    $('modeAlways').checked = !!config.alwaysShow;
    // 根据当前配色高亮匹配的预设；手动改成非预设组合时全部熄灭（= 自定义）。
    updatePresetSelection();
}

function onInput() {
    readFromForm();
    $('bgOpacityValue').textContent = config.bgOpacity + '%';
    refreshOpacityTrack();
    applyToPreview();
    save();
    updatePresetSelection();
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

// ---- 配色预设 ----
// 一组迷你时钟药丸：点击即套用该 preset 的 color/backgroundColor/bgOpacity，
// 并在下方表单里同步显示；当前配色恰好等于某组 preset 时，该 chip 高亮。

function presetMatches(p) {
    return config.color === p.color &&
           config.backgroundColor === p.backgroundColor &&
           config.bgOpacity === p.bgOpacity;
}

function buildPresets() {
    var host = $('presets');
    PRESETS.forEach(function (p, i) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'preset';
        btn.title = p.name;
        btn.setAttribute('aria-pressed', 'false');

        var swatch = document.createElement('span');
        swatch.className = 'preset-swatch';

        var pill = document.createElement('span');
        pill.className = 'preset-pill';
        pill.textContent = '12:34';
        pill.style.color = p.color;
        pill.style.backgroundColor = hexToRgba(p.backgroundColor, p.bgOpacity / 100);

        var name = document.createElement('span');
        name.className = 'preset-name';
        name.textContent = p.name;

        swatch.appendChild(pill);
        btn.appendChild(swatch);
        btn.appendChild(name);
        btn.addEventListener('click', function () { applyPreset(i); });
        host.appendChild(btn);
    });
}

function applyPreset(i) {
    var p = PRESETS[i];
    config.color = p.color;
    config.backgroundColor = p.backgroundColor;
    config.bgOpacity = p.bgOpacity;
    save();
    fillForm();
    applyToPreview();
}

function updatePresetSelection() {
    var buttons = document.querySelectorAll('.preset');
    buttons.forEach(function (btn, i) {
        btn.setAttribute('aria-pressed', presetMatches(PRESETS[i]) ? 'true' : 'false');
    });
}

function init() {
    chrome.storage.local.get(DEFAULTS, function (stored) {
        config = stored;
        buildPresets();
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
