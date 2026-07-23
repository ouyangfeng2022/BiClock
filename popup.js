// DEFAULTS / pad / formatTime / makeClockPart / hexToRgba /
// renderClockLayout / migrateRemovedTheme / THEME_STYLE_KEYS / REMOVED_THEME_IDS
// 由 shared.js 提供（popup.html 在本脚本之前 <script> 引入）。
//
// 这是「快速调整」子集：预览 + 外观基础项（字号/颜色/透明度/粗体）+ 显示开关。
// 主题网格、位置面板、自定义 CSS 文档等完整功能在 options.html（专门设置页）里，
// popup 通过 header 的「更多设置」按钮（chrome.runtime.openOptionsPage）跳转过去。
// 完整逻辑副本见 options.js —— 两边各维护一份，避免抽取引入参数化复杂度。

// 颜色色块：popup 专用的便捷入口，点击只覆盖对应的一个键（color 或
// backgroundColor），不引入新设置键，也不需要同步到 biclock.js。
var TEXT_SWATCHES = ['#ffffff', '#000000', '#fb7299', '#ffd66e', '#39ff14', '#7fdbff'];
var BG_SWATCHES   = ['#fb7299', '#000000', '#ffffff', '#2563eb', '#16a34a', '#dc2626'];

var config = {};

function $(id) {
    return document.getElementById(id);
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
    refreshPreviewText();
    // 用户 CSS 在布局文本之后注入，让选择器在预览里也能命中。
    // 注意：popup 不再提供 customCss 的编辑入口（移到 options 页），
    // 但仍读 storage 里的值反映到预览，保证两边视觉一致。
    applyPreviewCustomCss();
}

function refreshPreviewText() {
    // 用与内容脚本一致的 prefix：preview clock 自身带 .bpx-player-top-clock，
    // 子元素用 .bpx-player-clock-* —— 这样用户写的选择器在预览与播放器里同源。
    renderClockLayout($('previewClock'), formatTime(new Date()), config, 'bpx-player-clock');
}

// 用户 CSS 注入：与 biclock.js 同源，挂一个 <style> 节点到 document.head，
// textContent 随当前 config 重写。popup 只读不写 customCss，但仍要让预览
// 反映 options 页里写的 CSS，否则预览与真实时钟会不一致。
function applyPreviewCustomCss() {
    var style = document.getElementById('preview-custom-css');
    if (!style) return;
    style.textContent = config.customCssEnabled && config.customCss ? config.customCss : '';
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
    $('colorHex').setAttribute('aria-invalid', 'false');
    $('bgColorHex').setAttribute('aria-invalid', 'false');
    $('bgOpacity').value = config.bgOpacity;
    $('bgOpacityValue').textContent = config.bgOpacity + '%';
    refreshOpacityTrack();
    $('bold').checked = config.bold;
    $('fullscreenOnly').checked = config.fullscreenOnly !== false;
    $('modeAlways').checked = !!config.alwaysShow;
    updateSwatchSelection();
    updateHelpActiveStates();
}

function onInput(event) {
    readFromForm();
    // 手动改外观时把已选主题标成「自定义」，提示用户已偏离预设。
    if (!event || ['fontSize', 'bgOpacity', 'bold'].indexOf(event.target.id) !== -1) {
        config.clockStyle = 'custom';
    }
    $('bgOpacityValue').textContent = config.bgOpacity + '%';
    refreshOpacityTrack();
    applyToPreview();
    save();
    updateSwatchSelection();
    updateHelpActiveStates();
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

// 同步"显示"气泡里每个开关项的当前态：选中档加 data-active 满色，
// 另一档调淡。fullscreenOnly 与表单一致用 !== false（默认 true），
// alwaysShow 用 !!（默认 false）。
function updateHelpActiveStates() {
    var map = [
        { key: 'fullscreenOnly', on: config.fullscreenOnly !== false },
        { key: 'alwaysShow',     on: !!config.alwaysShow }
    ];
    map.forEach(function (m) {
        var item = document.querySelector('.help-item[data-help-key="' + m.key + '"]');
        if (!item) return;
        item.querySelectorAll('.help-item-line').forEach(function (line) {
            var isOn = line.getAttribute('data-state') === 'on';
            if (isOn === m.on) {
                line.setAttribute('data-active', '');
            } else {
                line.removeAttribute('data-active');
            }
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
            config[key] = norm;
            config.clockStyle = 'custom';
            applyToPreview();
            save();
            updateSwatchSelection();
        } else {
            el.setAttribute('aria-invalid', el.value.trim() === '' ? 'false' : 'true');
        }
    });
    el.addEventListener('blur', function () {
        el.value = config[key];
        el.setAttribute('aria-invalid', 'false');
    });
}

// 跳转到专门设置页：MV3 options_ui 注册后，openOptionsPage 会按
// open_in_tab 配置在新标签页打开 options.html。
function openOptions() {
    chrome.runtime.openOptionsPage();
}

function init() {
    chrome.storage.local.get(DEFAULTS, function (stored) {
        config = stored;
        migrateRemovedTheme(config, save);
        // 保留所有键（包括 popup 不再编辑的 customThemes/customCss/posX/posY/clockStyle），
        // 它们驱动预览（applyPreviewCustomCss 用 customCss）。save() 不会覆盖 options
        // 的并发编辑 —— save() 只在用户实际改动 popup 字段时调用。
        buildSwatches('colorSwatches', TEXT_SWATCHES, 'color');
        buildSwatches('bgColorSwatches', BG_SWATCHES, 'backgroundColor');
        fillForm();
        applyToPreview();
    });

    // 颜色字段由 bindHexInput 单独处理（含校验逻辑），其余字段走统一的 onInput。
    var ids = ['fontSize', 'bgOpacity', 'bold', 'fullscreenOnly', 'modeAlways'];
    ids.forEach(function (id) {
        $(id).addEventListener('input', onInput);
        $(id).addEventListener('change', onInput);
    });
    bindHexInput('colorHex', 'color');
    bindHexInput('bgColorHex', 'backgroundColor');

    // 预创建 <style> 用于注入用户 CSS 到 popup 预览（与 options 同源）。
    var previewStyle = document.createElement('style');
    previewStyle.id = 'preview-custom-css';
    document.head.appendChild(previewStyle);

    // 跳转到完整设置页：header 按钮 + 底部提示链接共用同一入口。
    $('openOptions').addEventListener('click', openOptions);
    $('openOptionsLink').addEventListener('click', function (e) {
        e.preventDefault();
        openOptions();
    });

    setInterval(refreshPreviewText, 1000);
}

document.readyState !== 'loading' ? init() : document.addEventListener('DOMContentLoaded', init);
