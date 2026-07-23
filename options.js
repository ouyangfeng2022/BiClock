// DEFAULTS / pad / formatTime / makeClockPart / hexToRgba /
// renderClockLayout / migrateRemovedTheme / THEME_STYLE_KEYS / THEME_CSS_KEYS / REMOVED_THEME_IDS
// 由 shared.js 提供（options.html 在本脚本之前 <script> 引入）。
//
// 这是「完整设置页」逻辑：主题网格、外观字段、显示开关、位置面板、
// 自定义 CSS textarea、文档示例复制按钮。popup.js 是它的「快速调整」子集，
// 两边各维护一份（共享会引入参数化复杂度，不符合项目 shared.js 只放纯逻辑的约定）。

// 颜色色块：与 popup 同源，点击只覆盖对应的一个键（color 或 backgroundColor），
// 不引入新设置键，也不需要同步到 biclock.js。
var TEXT_SWATCHES = ['#ffffff', '#000000', '#fb7299', '#ffd66e', '#39ff14', '#7fdbff'];
var BG_SWATCHES   = ['#fb7299', '#000000', '#ffffff', '#2563eb', '#16a34a', '#dc2626'];

// 选中主题时直接写入最终样式值，内容脚本无须理解主题名称也能立即更新。
// clockStyle 仅供标记当前选择；用户手动改外观时会变为 custom。
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

// clockLayout 值 → 卡片副标题里展示的形态描述。自定义主题没有内置 note，
// 用这个表给它补一句副标题，方便多张自定义卡之间区分。
var LAYOUT_LABELS = {
    single: '基础数字',
    segments: '分舱数码',
    capsule: '胶囊计时器',
    recording: '录像时间码',
    analog: '指针表盘',
    flip: '翻页时钟',
    hud: '科幻 HUD',
    calendar: '日历桌牌',
    corner: '边角框'
};

// 用户保存的自定义主题（与 config.customThemes 同源）。每次 rebuildThemeGrid()
// 都从这里读，保存/删除/重命名后写回 storage 再 rebuild。
var customThemes = [];

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
    // 时钟相对预览 banner（B 站播放器外壳）按 posX/posY 比例定位，
    // 与 biclock.js 在真实播放器里的定位方式一致（相对容器的百分比）。
    updatePreviewPosition();

    // 外观双模式：cssMode 时清掉外观类 inline style，用户 CSS 成唯一来源
    // （无需 !important）；否则照常把外观灌成 inline。与 biclock.js 同源，
    // 预览与真实播放器视觉表现一致。
    // 注意调用顺序：必须先写 inline 外观，再调用 refreshPreviewText()
    // （renderClockLayout），与 biclock.js 的 applyStyles() → renderClockLayout()
    // 一致。形态主题（analog / segments / flip / corner / calendar 等）会在
    // renderClockLayout 里把 el 的背景/边框/padding 清成 transparent / 0，
    // 让圆盘或翻牌"裸露"显示；若顺序相反（先布局再 inline），inline 会把
    // 这些清理重新盖回去，预览首帧就出现一圈底层阴影盒子；而 1 秒后
    // setInterval(refreshPreviewText, 1000) 只跑 renderClockLayout 不再写 inline，
    // 盒子又消失，表现为点击主题后"一秒后样式跳变"。
    if (config.customCssEnabled && config.customCss) {
        APPEARANCE_INLINE_KEYS.forEach(function (k) {
            el.style.removeProperty(k);
        });
    } else {
        el.style.fontSize = config.fontSize + 'px';
        el.style.color = config.color;
        el.style.fontWeight = config.bold ? 'bold' : 'normal';
        el.style.fontFamily = config.fontFamily;
        el.style.textShadow = config.textShadow;
        el.style.backgroundColor = hexToRgba(config.backgroundColor, config.bgOpacity / 100);
        el.style.border = config.borderWidth + 'px solid ' + hexToRgba(config.borderColor, config.borderOpacity / 100);
        el.style.boxSizing = 'border-box';
        el.style.padding = '0 ' + (config.fontSize * 0.3).toFixed(1) + 'px';
        el.style.borderRadius = (config.fontSize * 0.3).toFixed(1) + 'px';
    }
    // 用户 CSS 在布局文本之后注入，让选择器在预览里也能命中。
    applyPreviewCustomCss();
    // 最后渲染布局：让形态主题对 el 背景/边框/padding 的清理成为最终态，
    // 与每秒 setInterval 的单独 refreshPreviewText() 渲染路径完全等价。
    refreshPreviewText();
}

// 把 posX/posY 写到预览时钟。与 biclock.js 在真实播放器里完全一致：
// left/top 把时钟左上角对到容器内 (posX, posY) 比例处，再用 transform
// translate 按自身尺寸反向偏移实现边角对齐（posX=0 左贴左，1 右贴右，0.5 居中）。
// 预览用百分比而非像素，banner 响应式缩放时坐标自动跟随。
function updatePreviewPosition() {
    var el = $('previewClock');
    el.style.left = (config.posX * 100) + '%';
    el.style.top = (config.posY * 100) + '%';
    el.style.transform =
        'translate(' + (config.posX * -100) + '%, ' + (config.posY * -100) + '%)';
}

function refreshPreviewText() {
    // 用与内容脚本一致的 prefix：preview clock 自身带 .bpx-player-top-clock，
    // 子元素用 .bpx-player-clock-* —— 这样用户写的选择器在预览与播放器里同源。
    renderClockLayout($('previewClock'), formatTime(new Date()), config, 'bpx-player-clock');
}

// 用户 CSS 注入：与 biclock.js 同源，挂一个 <style> 节点到 document.head，
// textContent 随当前 config 重写。disabled 或空串时清空（不删节点，避免反复创建）。
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
    // customCssEnabled 是 toggle，沿用 onInput 路径，故也由 readFromForm 读回。
    // customCss（textarea）由专用 input 绑定直接写 config，不经 readFromForm。
    config.customCssEnabled = $('customCssEnabled').checked;
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
    $('customCss').value = config.customCss || '';
    $('customCssEnabled').checked = !!config.customCssEnabled;
    updateSwatchSelection();
    updateThemeSelection();
    updateHelpActiveStates();
}

function onInput(event) {
    readFromForm();
    // 显示范围与常驻开关不属于主题视觉，不应把已选主题标成"自定义"。
    // 外观键与 CSS 启用开关属于主题视觉，编辑即视为偏离当前主题。
    if (!event || ['fontSize', 'bgOpacity', 'bold', 'customCssEnabled'].indexOf(event.target.id) !== -1) {
        config.clockStyle = 'custom';
    }
    $('bgOpacityValue').textContent = config.bgOpacity + '%';
    refreshOpacityTrack();
    applyToPreview();
    save();
    updateSwatchSelection();
    updateThemeSelection();
    updateHelpActiveStates();
}

// ---- 位置控制（集成在预览 banner 里）----
// 直接在预览 banner（B 站播放器外壳）上拖动时钟来设定位置。
// 点击 banner 任意位置 = 把时钟中心移到该点；按住时钟拖动 = 跟随指针。
// posX/posY 存为 0..1 比例，biclock.js 在真实播放器里按视口尺寸换算成像素。

function setPositionFromPointer(clientX, clientY) {
    var banner = $('previewBanner');
    var rect = banner.getBoundingClientRect();
    var x = (clientX - rect.left) / rect.width;
    var y = (clientY - rect.top) / rect.height;
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    config.posX = x;
    config.posY = y;
    updatePreviewPosition();
    save();
}

function initPositionPanel() {
    var banner = $('previewBanner');
    var clock = $('previewClock');

    function onMove(e) {
        e.preventDefault();
        setPositionFromPointer(e.clientX, e.clientY);
    }

    function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        clock.classList.remove('dragging');
    }

    function onDown(e) {
        if (e.button !== 0) return;
        // 点到「重置为居中」按钮时不触发拖动（按钮自己处理 click）。
        if (e.target.closest('.preview-reset')) return;
        e.preventDefault();
        clock.classList.add('dragging');
        setPositionFromPointer(e.clientX, e.clientY);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    banner.addEventListener('mousedown', onDown);

    $('resetPosition').addEventListener('click', function (e) {
        e.stopPropagation();
        config.posX = DEFAULTS.posX;
        config.posY = DEFAULTS.posY;
        save();
        updatePreviewPosition();
    });
}

// 底部「保存当前外观与 CSS 为自定义主题」按钮：保存 12 个外观键 + CSS 快照，
// 让自定义主题成为「一套完整外观（含 CSS）」。CSS 文本本身已自动保存到
// config.customCss，这里额外把它快照进主题卡，以便日后一键切换恢复。
function initSaveCustomTheme() {
    $('saveCustomTheme').addEventListener('click', saveCurrentAsCustomTheme);
}

// ---- 颜色色块 + Hex 输入 ----

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

// 应用主题：恢复 12 个外观键；CSS 按主题类型分别处理。
// 预设主题（在 THEMES 里）不带 CSS —— 切回预设时清空当前 CSS，呈现纯净外观。
// 自定义主题把保存时快照的 CSS 一起恢复。
function applyTheme(theme) {
    THEME_STYLE_KEYS.forEach(function (key) {
        config[key] = theme[key];
    });
    var isPreset = THEMES.some(function (t) { return t.id === theme.id; });
    if (isPreset) {
        config.customCss = '';
        config.customCssEnabled = false;
    } else {
        config.customCss = theme.customCss || '';
        config.customCssEnabled = !!theme.customCssEnabled;
    }
    config.clockStyle = theme.id;
    save();
    fillForm();
    applyToPreview();
}

// 渲染主题小样：把主题外观键灌到一个 .theme-sample 节点里，让卡片预览
// 与时钟真实渲染同源（都用 renderClockLayout）。preset 与 custom 共用。
function paintThemeSample(sample, theme) {
    sample.style.color = theme.color;
    sample.style.backgroundColor = hexToRgba(theme.backgroundColor, theme.bgOpacity / 100);
    sample.style.fontFamily = theme.fontFamily;
    sample.style.fontWeight = theme.bold ? '700' : '400';
    sample.style.textShadow = theme.textShadow;
    sample.style.border = theme.borderWidth + 'px solid ' + hexToRgba(theme.borderColor, theme.borderOpacity / 100);
    renderClockLayout(sample, '23:47:08', theme, 'clock');
}

function buildPresetCard(theme) {
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
    paintThemeSample(sample, theme);

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
    return button;
}

function buildCustomCard(theme) {
    var card = document.createElement('div');
    var actions = document.createElement('span');
    var updateBtn = document.createElement('button');
    var deleteBtn = document.createElement('button');
    var sample = document.createElement('span');
    var copy = document.createElement('span');
    var name = document.createElement('span');
    var note = document.createElement('span');

    card.className = 'theme-card theme-card-custom';
    card.dataset.themeId = theme.id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-pressed', 'false');
    card.setAttribute('aria-label', theme.name + '：' + (LAYOUT_LABELS[theme.clockLayout] || '自定义主题'));

    actions.className = 'theme-actions';
    updateBtn.type = 'button';
    updateBtn.className = 'theme-action theme-update';
    updateBtn.title = '更新为当前外观';
    updateBtn.setAttribute('aria-label', '更新"' + theme.name + '"为当前外观');
    updateBtn.textContent = '↻';
    deleteBtn.type = 'button';
    deleteBtn.className = 'theme-action theme-delete';
    deleteBtn.title = '删除该自定义主题';
    deleteBtn.setAttribute('aria-label', '删除"' + theme.name + '"');
    deleteBtn.textContent = '×';
    [updateBtn, deleteBtn].forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    });
    updateBtn.addEventListener('click', function () { updateCustomTheme(theme.id); });
    deleteBtn.addEventListener('click', function () { deleteCustomTheme(theme.id); });
    actions.appendChild(updateBtn);
    actions.appendChild(deleteBtn);

    sample.className = 'theme-sample';
    paintThemeSample(sample, theme);

    copy.className = 'theme-copy';
    name.className = 'theme-name';
    name.textContent = theme.name;
    name.title = '双击重命名';
    note.className = 'theme-note';
    note.textContent = LAYOUT_LABELS[theme.clockLayout] || '自定义主题';
    copy.appendChild(name);
    copy.appendChild(note);

    card.appendChild(actions);
    card.appendChild(sample);
    card.appendChild(copy);

    card.addEventListener('click', function () { applyTheme(theme); });
    card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            applyTheme(theme);
        }
    });
    name.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        startRename(theme, name);
    });
    return card;
}

function rebuildThemeGrid() {
    var host = $('themeGrid');
    host.replaceChildren();
    THEMES.forEach(function (theme) { host.appendChild(buildPresetCard(theme)); });
    customThemes.forEach(function (theme) { host.appendChild(buildCustomCard(theme)); });
    updateThemeSelection();
}

function nextCustomName(themes) {
    var max = 0;
    themes.forEach(function (t) {
        var m = /^自定义 (\d+)$/.exec(t.name || '');
        if (m) {
            var n = parseInt(m[1], 10);
            if (n > max) max = n;
        }
    });
    return '自定义 ' + (max + 1);
}

function saveCurrentAsCustomTheme() {
    var theme = { id: 'custom_' + Date.now(), name: nextCustomName(customThemes) };
    THEME_STYLE_KEYS.forEach(function (key) {
        theme[key] = config[key];
    });
    // CSS 作为快照随主题保存：自定义主题 = 一套完整外观（含 CSS）。
    THEME_CSS_KEYS.forEach(function (key) {
        theme[key] = config[key];
    });
    customThemes.push(theme);
    config.customThemes = customThemes;
    config.clockStyle = theme.id;
    save();
    rebuildThemeGrid();
}

function updateCustomTheme(id) {
    var theme = null;
    for (var i = 0; i < customThemes.length; i++) {
        if (customThemes[i].id === id) { theme = customThemes[i]; break; }
    }
    if (!theme) return;
    THEME_STYLE_KEYS.forEach(function (key) {
        theme[key] = config[key];
    });
    THEME_CSS_KEYS.forEach(function (key) {
        theme[key] = config[key];
    });
    config.customThemes = customThemes;
    config.clockStyle = theme.id;
    save();
    rebuildThemeGrid();
}

function deleteCustomTheme(id) {
    customThemes = customThemes.filter(function (t) { return t.id !== id; });
    config.customThemes = customThemes;
    if (config.clockStyle === id) {
        config.clockStyle = 'custom';
    }
    save();
    rebuildThemeGrid();
}

function startRename(theme, nameSpan) {
    if (!nameSpan.parentNode) return;
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'theme-name-input';
    input.value = theme.name;
    input.maxLength = 20;
    input.setAttribute('aria-label', '重命名"' + theme.name + '"');
    nameSpan.parentNode.replaceChild(input, nameSpan);
    input.focus();
    input.select();

    var done = false;
    function commit() {
        if (done) return;
        done = true;
        var v = (input.value || '').trim();
        if (v && v !== theme.name) {
            theme.name = v;
            config.customThemes = customThemes;
            save();
        }
        rebuildThemeGrid();
    }
    function cancel() {
        if (done) return;
        done = true;
        rebuildThemeGrid();
    }
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('click', function (e) { e.stopPropagation(); });
}

function updateThemeSelection() {
    var activeId = config.clockStyle;
    var hint = $('themeHint');
    document.querySelectorAll('.theme-card').forEach(function (button) {
        button.setAttribute('aria-pressed', button.dataset.themeId === activeId ? 'true' : 'false');
    });
    if (activeId === 'custom') {
        hint.textContent = '已手动调整外观。点击下方「保存当前外观与 CSS 为自定义主题」可存成主题卡。';
    } else {
        var isPreset = THEMES.some(function (t) { return t.id === activeId; });
        hint.textContent = isPreset
            ? '当前为预设主题：不带 CSS，切回时不会恢复自定义 CSS。'
            : '当前为自定义主题：外观与 CSS 已一并恢复。';
    }
}

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
            updateThemeSelection();
        } else {
            el.setAttribute('aria-invalid', el.value.trim() === '' ? 'false' : 'true');
        }
    });
    el.addEventListener('blur', function () {
        el.value = config[key];
        el.setAttribute('aria-invalid', 'false');
    });
}

// 文档示例「复制」按钮：点一下把对应 <pre> 的文本写进剪贴板，
// 按钮短暂切到「✓ 已复制」反馈成功。剪贴板不可用（旧浏览器 / 权限）时
// 回退到选中文本，让用户手动 Ctrl+C。
function initCopyButtons() {
    var buttons = document.querySelectorAll('.copy-btn[data-copy]');
    buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var codeEl = document.getElementById('code-' + btn.dataset.copy);
            var text = codeEl ? codeEl.textContent : '';
            function flash() {
                var prev = btn.textContent;
                btn.textContent = '✓ 已复制';
                btn.setAttribute('data-copied', 'true');
                setTimeout(function () {
                    btn.textContent = prev;
                    btn.removeAttribute('data-copied');
                }, 1400);
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(flash, function () {
                    // 权限被拒 / 不支持：选中文本让用户手动复制。
                    var range = document.createRange();
                    range.selectNodeContents(codeEl);
                    var sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                });
            } else if (codeEl) {
                var range = document.createRange();
                range.selectNodeContents(codeEl);
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        });
    });
}

function init() {
    chrome.storage.local.get(DEFAULTS, function (stored) {
        config = stored;
        migrateRemovedTheme(config, save);
        customThemes = Array.isArray(stored.customThemes) ? stored.customThemes : [];
        config.customThemes = customThemes;
        rebuildThemeGrid();
        buildSwatches('colorSwatches', TEXT_SWATCHES, 'color');
        buildSwatches('bgColorSwatches', BG_SWATCHES, 'backgroundColor');
        fillForm();
        applyToPreview();
    });

    var ids = ['fontSize', 'bgOpacity', 'bold', 'fullscreenOnly', 'modeAlways', 'customCssEnabled'];
    ids.forEach(function (id) {
        $(id).addEventListener('input', onInput);
        $(id).addEventListener('change', onInput);
    });
    bindHexInput('colorHex', 'color');
    bindHexInput('bgColorHex', 'backgroundColor');

    var previewStyle = document.createElement('style');
    previewStyle.id = 'preview-custom-css';
    document.head.appendChild(previewStyle);
    $('customCss').addEventListener('input', function () {
        config.customCss = $('customCss').value;
        // CSS 现在是自定义主题的一部分；手动编辑即偏离任何已保存主题。
        config.clockStyle = 'custom';
        applyToPreview();
        save();
        updateThemeSelection();
    });

    initPositionPanel();
    initSaveCustomTheme();
    initCopyButtons();

    setInterval(refreshPreviewText, 1000);
}

document.readyState !== 'loading' ? init() : document.addEventListener('DOMContentLoaded', init);
