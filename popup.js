// DEFAULTS / pad / formatTime / makeClockPart / hexToRgba /
// renderClockLayout / migrateRemovedTheme / THEME_STYLE_KEYS / REMOVED_THEME_IDS
// 由 shared.js 提供（popup.html 在本脚本之前 <script> 引入）。

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
    renderClockLayout($('previewClock'), formatTime(new Date()), config, 'clock');
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
    updateHelpActiveStates();
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
    updateHelpActiveStates();
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

function initSaveCustomTheme() {
    $('saveCustomTheme').addEventListener('click', saveCurrentAsCustomTheme);
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

// 预制主题卡：<button>，整卡可点。结构和样式保持原样，不引入 actions。
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

// 自定义主题卡：外层 div（容纳内部 <button> actions 与可编辑名称），整卡点击
// 等价于套用该主题；右上 ↻ 更新当前外观、× 删除；双击名称可重命名。
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
    // 名称里的连字符等不需要特意处理；副标题给个形态描述帮助区分多张自定义卡。
    card.setAttribute('aria-label', theme.name + '：' + (LAYOUT_LABELS[theme.clockLayout] || '自定义主题'));

    actions.className = 'theme-actions';
    updateBtn.type = 'button';
    updateBtn.className = 'theme-action theme-update';
    updateBtn.title = '更新为当前外观';
    updateBtn.setAttribute('aria-label', '更新“' + theme.name + '”为当前外观');
    updateBtn.textContent = '↻';
    deleteBtn.type = 'button';
    deleteBtn.className = 'theme-action theme-delete';
    deleteBtn.title = '删除该自定义主题';
    deleteBtn.setAttribute('aria-label', '删除“' + theme.name + '”');
    deleteBtn.textContent = '×';
    // 阻止冒泡到外层 div 触发 applyTheme，否则按 × 的同时会先把主题套上再删。
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
    // 键盘可达：Enter / Space 触发套用（与 <button> 默认行为对齐）。
    card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            applyTheme(theme);
        }
    });
    name.addEventListener('dblclick', function (e) {
        // 双击只重命名，不冒泡触发 applyTheme。
        e.stopPropagation();
        startRename(theme, name);
    });
    return card;
}

// 主题集合发生变化（首次渲染、保存、删除、重命名）时清空网格重建。
// 预制主题在前、自定义主题在后，顺序稳定。
function rebuildThemeGrid() {
    var host = $('themeGrid');
    host.replaceChildren();
    THEMES.forEach(function (theme) { host.appendChild(buildPresetCard(theme)); });
    customThemes.forEach(function (theme) { host.appendChild(buildCustomCard(theme)); });
    updateThemeSelection();
}

// 扫描已有名称里的“自定义 N”，取最大编号 +1。已被重命名的卡不参与编号，
// 避免覆盖用户的命名（不会出现“自定义 2”与“我的粉色”撞号）。
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

// 外观 fieldset 底部按钮：把当前外观 12 键打包成一张新自定义主题。
// 位置/全屏/常驻不进主题；新卡立即激活。
function saveCurrentAsCustomTheme() {
    var theme = { id: 'custom_' + Date.now(), name: nextCustomName(customThemes) };
    THEME_STYLE_KEYS.forEach(function (key) {
        theme[key] = config[key];
    });
    customThemes.push(theme);
    config.customThemes = customThemes;
    config.clockStyle = theme.id;
    // save() 写整个 config，已包含 customThemes；无需再单独 saveCustomThemes()。
    save();
    rebuildThemeGrid();
}

// 把当前外观 12 键覆盖回已有自定义主题。多用于：套用某张自定义卡后又微调，
// 想把微调并入该卡。
function updateCustomTheme(id) {
    var theme = null;
    for (var i = 0; i < customThemes.length; i++) {
        if (customThemes[i].id === id) { theme = customThemes[i]; break; }
    }
    if (!theme) return;
    THEME_STYLE_KEYS.forEach(function (key) {
        theme[key] = config[key];
    });
    config.customThemes = customThemes;
    // 当前外观与该主题已一致，标回该 id（如果之前是 custom 的话也借此激活）。
    config.clockStyle = theme.id;
    save();
    rebuildThemeGrid();
}

// 删除自定义主题。删的是当前激活卡时回退到 custom（hint 会提示已保留手动调整）。
function deleteCustomTheme(id) {
    customThemes = customThemes.filter(function (t) { return t.id !== id; });
    config.customThemes = customThemes;
    if (config.clockStyle === id) {
        config.clockStyle = 'custom';
    }
    save();
    rebuildThemeGrid();
}

// 双击名称 → 原地换成 input；Enter/blur 提交、Esc 还原。空名视为取消。
function startRename(theme, nameSpan) {
    if (!nameSpan.parentNode) return;
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'theme-name-input';
    input.value = theme.name;
    input.maxLength = 20;
    input.setAttribute('aria-label', '重命名“' + theme.name + '”');
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
            // save() 写整个 config，已包含 customThemes；无需再单独 saveCustomThemes()。
            save();
        }
        // 无论是否改名，rebuild 会用最新 name 重建卡片（input 被一并替换掉）。
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
    // 重命名期间禁用卡片点击套用（输入框吞掉鼠标事件，但仍保险）。
    input.addEventListener('click', function (e) { e.stopPropagation(); });
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
        migrateRemovedTheme(config, save);
        // DEFAULTS 已注入 customThemes: []，这里再防御一下老 storage 的脏值。
        customThemes = Array.isArray(stored.customThemes) ? stored.customThemes : [];
        config.customThemes = customThemes;
        rebuildThemeGrid();
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
    initSaveCustomTheme();

    setInterval(refreshPreviewText, 1000);
}

document.readyState !== 'loading' ? init() : document.addEventListener('DOMContentLoaded', init);
