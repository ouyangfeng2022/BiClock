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

    // 外观两模式：HTML 模板启用时清掉外观类 inline style，让用户模板成唯一来源
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
    if (config.customHtmlEnabled && config.customHtml) {
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
    // UI 上呈现的是「启用时钟」总开关，底层存储键仍是 hiddenForever（反向）。
    // 反向语义：勾上启用 = hiddenForever=false；取消勾选 = hiddenForever=true。
    config.hiddenForever = !$('clockEnabled').checked;
    // customHtmlEnabled 是 toggle，沿用 onInput 路径，故也由 readFromForm 读回。
    // customHtml（textarea）由专用 input 绑定直接写 config，不经 readFromForm。
    config.customHtmlEnabled = $('customHtmlEnabled').checked;
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
    // 总开关反向：启用时钟 = !hiddenForever
    $('clockEnabled').checked = !config.hiddenForever;
    $('customHtml').value = config.customHtml || '';
    $('customHtmlEnabled').checked = !!config.customHtmlEnabled;
    refreshTemplateHighlight();
    updateApplyDirtyState();
    updateClearButtonState();
    updateSwatchSelection();
    updateThemeSelection();
    updateHelpActiveStates();
    applyHiddenState();
}

// textarea 保持原生编辑体验；底下的 pre 仅负责展示语法色彩。这样不引入编辑器
// 依赖，也不会改变 storage 中保存的原始 HTML 文本。
function escapeTemplateHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightTemplateHtml(source) {
    var escaped = escapeTemplateHtml(source);
    return escaped.replace(/(&lt;\/?)([\w:-]+)([\s\S]*?)(&gt;)/g,
        function (_, open, name, attributes, close) {
            var highlightedAttrs = attributes.replace(/([\w:-]+)(\s*=\s*)(&quot;.*?&quot;|'[^']*?'|[^\s]+)/g,
                '<span class="template-token-attr">$1</span>$2<span class="template-token-string">$3</span>');
            return '<span class="template-token-tag">' + open + '</span><span class="template-token-name">' + name + '</span>' + highlightedAttrs + '<span class="template-token-tag">' + close + '</span>';
        })
        .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="template-token-comment">$1</span>')
        .replace(/(\{\{\s*(?:hh|mm|ss|time)\s*\}\})/gi, '<span class="template-token-placeholder">$1</span>');
}

function refreshTemplateHighlight() {
    var input = $('customHtml');
    var output = $('customHtmlHighlight');
    var editor = document.querySelector('.template-editor');
    if (!input || !output || !editor) return;
    output.innerHTML = '<code>' + highlightTemplateHtml(input.value) + '</code>';
    output.scrollTop = input.scrollTop;
    output.scrollLeft = input.scrollLeft;
    editor.dataset.empty = input.value ? 'false' : 'true';
}

function initTemplateEditor() {
    var input = $('customHtml');
    if (!input) return;
    input.addEventListener('scroll', refreshTemplateHighlight);
    refreshTemplateHighlight();
}

// 「应用」按钮：HTML 模板从自动保存改为显式提交。
// textarea 编辑期只是草稿，按「应用」才把草稿写进 config.customHtml 并刷新预览 / 落盘。
// dirty 状态用编辑器上的 data-dirty 与按钮的 disabled 双重表达，让用户一眼看出
// 「文本已变、还没生效」。
function updateApplyDirtyState() {
    var editor = document.querySelector('.template-editor');
    var applyBtn = $('applyCustomHtml');
    if (!editor || !applyBtn) return;
    var dirty = $('customHtml').value !== (config.customHtml || '');
    editor.dataset.dirty = dirty ? 'true' : 'false';
    applyBtn.disabled = !dirty;
}

function initApplyButton() {
    var applyBtn = $('applyCustomHtml');
    if (!applyBtn) return;
    applyBtn.addEventListener('click', function () {
        // 提交草稿：把 textarea 当前值写入 config，与旧版自动保存路径完全一致
        // （写 customHtml + 标记 clockStyle + 刷新预览 + 落盘 + 同步主题选中态）。
        config.customHtml = $('customHtml').value;
        // HTML 模板也是自定义主题的一部分；手动提交即偏离任何已保存主题。
        config.clockStyle = 'custom';
        applyToPreview();
        save();
        updateThemeSelection();
        // dirty 已消化；按钮回禁用态、编辑器边框恢复正常。
        updateApplyDirtyState();
        // customHtml 由空变非空，「清除」按钮需要从禁用态唤醒；
        // 漏掉这一步会导致「刚应用完模板却点不动清除」，直到刷新页面才恢复。
        updateClearButtonState();
    });
}

// 「清除」按钮：把当前已应用的自定义 HTML 模板文本整段清空。
// 注意：只清内容，不动 customHtmlEnabled——「启用」是模块开关，是否启用 HTML 模板
// 模块与「模板里有没有内容」是两件事。清空后模块仍处于启用态，只是模板为空，
// 等同于没有可应用的模板（renderClockLayout 的 HTML 模板分支 gate 是
// customHtmlEnabled && customHtml，空串会自然落到内置布局）。
// 会丢失已应用的模板文本，故二次确认：首次点击进入确认态（按钮变红 + 文案改成
// 「确认清除？」），3 秒内再次点击才真正执行；超时、点别处、或按 Esc 自动取消。
function updateClearButtonState() {
    var clearBtn = $('clearCustomHtml');
    if (!clearBtn) return;
    // 只看 config.customHtml（已应用的那份），不看 textarea 草稿：
    // 草稿有内容但还没应用时，清除已应用的空模板本来就没东西可清。
    var hasApplied = !!(config.customHtml || '').trim();
    // 确认态下不强抢 disabled——确认态本身就是「即将执行」的中间态。
    if (clearBtn.dataset.confirm !== 'true') {
        clearBtn.disabled = !hasApplied;
    }
}

function initClearButton() {
    var clearBtn = $('clearCustomHtml');
    if (!clearBtn) return;
    var confirmTimer = null;
    var originalText = clearBtn.textContent;

    function leaveConfirmState(restoreText) {
        if (confirmTimer) {
            clearTimeout(confirmTimer);
            confirmTimer = null;
        }
        clearBtn.removeAttribute('data-confirm');
        if (restoreText) clearBtn.textContent = originalText;
        updateClearButtonState();
    }

    function performClear() {
        // 只清空模板内容，保留 customHtmlEnabled 不变：
        // 启用开关是模块级开关，与本按钮「清空当前模板」的职责正交。
        config.customHtml = '';
        config.clockStyle = 'custom';
        $('customHtml').value = '';
        applyToPreview();
        save();
        refreshTemplateHighlight();
        updateApplyDirtyState();
        updateThemeSelection();
        // 清除完同样给个即时反馈，与「载入起步模板」的成功态同源。
        clearBtn.textContent = '✓ 已清除';
        leaveConfirmState(false);
        setTimeout(function () {
            clearBtn.textContent = originalText;
        }, 1400);
    }

    clearBtn.addEventListener('click', function () {
        // 已经在确认态 → 第二次点击 = 确认执行。
        if (clearBtn.dataset.confirm === 'true') {
            performClear();
            return;
        }
        // 否则进入确认态。
        clearBtn.dataset.confirm = 'true';
        clearBtn.textContent = '确认清除？';
        clearBtn.disabled = false;
        // 3 秒窗口；超时自动退出确认态、恢复原文案、按 hasApplied 重算 disabled。
        confirmTimer = setTimeout(function () {
            leaveConfirmState(true);
        }, 3000);
    });

    // 点击确认态以外的任意处，或在编辑器内按 Esc，都视为放弃确认。
    // 用 mousedown 而非 click：让按钮自身的 click 优先触发（先进入确认态），
    // 同一笔 mousedown→click 不会立刻把刚进入的确认态又关掉。
    document.addEventListener('mousedown', function (e) {
        if (clearBtn.dataset.confirm !== 'true') return;
        if (e.target === clearBtn || clearBtn.contains(e.target)) return;
        leaveConfirmState(true);
    });
    $('customHtml').addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && clearBtn.dataset.confirm === 'true') {
            leaveConfirmState(true);
        }
    });
}

// 新用户可一键把最简、可运行的示例放进编辑器，再在此基础上修改。
// 读取 textContent 而不是硬编码字符串，确保「起步模板」与文档示例始终一致。
function initStarterTemplate() {
    var button = $('useStarterTemplate');
    var input = $('customHtml');
    var source = $('code-html-minimal');
    if (!button || !input || !source) return;

    button.addEventListener('click', function () {
        // 载入起步模板只把示例文本灌进 textarea 当作草稿，不立即写 config / 不
        // 刷新预览 / 不落盘——与「编辑 textarea 后须点『应用』」的显式提交契约
        // 保持一致，避免这里绕过应用按钮直接生效。用户随后点『应用』才把草稿
        // 提交进 config.customHtml。模块「启用」开关也保持原样不被强开：启用与
        // 「有没有模板内容」是两件事（与「清除」按钮同源）。
        input.value = source.dataset.copyText || source.textContent;
        refreshTemplateHighlight();
        updateApplyDirtyState();
        input.focus();
        button.textContent = '✓ 已载入草稿，点应用生效';
        button.dataset.loaded = 'true';
        setTimeout(function () {
            button.textContent = '重新载入起步模板';
            delete button.dataset.loaded;
        }, 1800);
    });
}

function getAiTemplatePrompt() {
    var description = ($('aiStyleDescription').value || '').trim();
    return [
        '请为 BiClock 浏览器扩展生成一份“自定义 HTML 模板”。',
        '',
        '请严格遵守：',
        '1. 只输出可直接粘贴的完整 HTML 片段；不要 Markdown 代码围栏、解释或使用说明。',
        '2. 如果写 CSS，必须把全部 CSS 放进模板最开头的 <style> 和 </style> 之间；在第一个 HTML 标签前先关闭 </style>。绝不能把 CSS 裸写在模板最外层。',
        '3. 可使用普通 HTML 标签、SVG 和这个内嵌 <style> 标签；不要使用 <script>、事件属性或外部资源。',
        '4. 时钟外层容器已经由扩展提供，类名为 .bpx-player-top-clock；不要重复创建这个外层容器。',
        '5. 给你自己创建的内部元素取独特 class name，例如 .my-clock、.my-clock-frame。',
        '6. <style> 中的每一条选择器都必须以 .bpx-player-top-clock 开头，例如：.bpx-player-top-clock .my-clock { ... }。不要给 body、html 或 B 站页面其它元素写样式。',
        '7. 模板中必须保留至少一个时间占位符：{{time}}（HH:MM:SS）、{{hh}}、{{mm}} 或 {{ss}}。占位符会由扩展每秒自动更新。',
        '8. 外层位置由扩展拖拽控制；不要对 .bpx-player-top-clock 设置 position、left、top 或 transform。',
        '9. 请确保文字易读，成品在深色视频播放器上也能看清。',
        '',
        '我希望的视觉风格：',
        description || '请设计一个精致、简洁且具有辨识度的时钟样式。'
    ].join('\n');
}

// 把约束与用户的审美描述合成一段可直接发送给 LLM 的提示词。
function initAiPrompt() {
    var input = $('aiStyleDescription');
    var output = $('aiPromptText');
    var button = $('copyAiPrompt');
    if (!input || !output || !button) return;

    function refresh() {
        output.textContent = getAiTemplatePrompt();
    }

    function selectPrompt() {
        var range = document.createRange();
        range.selectNodeContents(output);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    input.addEventListener('input', refresh);
    button.addEventListener('click', function () {
        var prompt = getAiTemplatePrompt();
        function flash() {
            button.textContent = '✓ 已复制，可发给 AI';
            button.dataset.copied = 'true';
            setTimeout(function () {
                button.textContent = '复制提示词';
                delete button.dataset.copied;
            }, 1600);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(prompt).then(flash, selectPrompt);
        } else {
            selectPrompt();
        }
    });
    refresh();
}

// 示例代码与编辑器使用同一套 token 色彩。示例的原始文本始终保留在 data 属性中，
// 因此高亮插入的 span 不会影响「复制」得到的内容。
function highlightExampleCode(source) {
    var parts = source.split(/(<!--[\s\S]*?-->|<\/?[\w:-]+(?:\s+[^<>]*?)?>|\{\{\s*(?:hh|mm|ss|time)\s*\}\})/gi);
    var inStyle = false;

    return parts.map(function (part) {
        if (!part) return '';
        if (/^<!--[\s\S]*-->$/.test(part)) {
            return '<span class="template-token-comment">' + escapeTemplateHtml(part) + '</span>';
        }
        if (/^\{\{\s*(?:hh|mm|ss|time)\s*\}\}$/i.test(part)) {
            return '<span class="template-token-placeholder">' + escapeTemplateHtml(part) + '</span>';
        }
        if (/^<\/?[\w:-]+/.test(part)) {
            var match = part.match(/^<(\/)?([\w:-]+)([\s\S]*?)(\/?)>$/);
            if (!match) return escapeTemplateHtml(part);
            var closing = !!match[1];
            var name = match[2];
            var attrs = escapeTemplateHtml(match[3]).replace(/([\w:-]+)(\s*=\s*)(&quot;.*?&quot;|'[^']*?'|[^\s]+)/g,
                '<span class="template-token-attr">$1</span>$2<span class="template-token-string">$3</span>');
            if (name.toLowerCase() === 'style') inStyle = !closing;
            return '<span class="template-token-tag">&lt;' + (closing ? '/' : '') + '</span><span class="template-token-name">' + name + '</span>' + attrs + '<span class="template-token-tag">' + (match[4] || '') + '&gt;</span>';
        }
        if (!inStyle) return escapeTemplateHtml(part);
        return escapeTemplateHtml(part).replace(/(\/\*[\s\S]*?\*\/|&quot;.*?&quot;|'[^']*?')|([\w-]+)(?=\s*:)|(#[\da-f]{3,8}\b)|(\b\d+(?:\.\d+)?(?:px|em|rem|%|s|deg)?\b)/gi,
            function (_, literal, property, color, value) {
                if (literal) return '<span class="' + (literal.indexOf('/*') === 0 ? 'template-token-comment' : 'template-token-string') + '">' + literal + '</span>';
                if (property) return '<span class="template-token-css-property">' + property + '</span>';
                if (color) return '<span class="template-token-css-value">' + color + '</span>';
                return '<span class="template-token-css-value">' + value + '</span>';
            });
    }).join('');
}

function initExampleHighlights() {
    document.querySelectorAll('pre.docs-code code').forEach(function (codeEl) {
        var source = codeEl.textContent;
        codeEl.dataset.copyText = source;
        codeEl.innerHTML = highlightExampleCode(source);
    });
}

// 关闭时钟（hiddenForever=true）时把主题 / 外观 / CSS / 预览 / 保存按钮
// 全部折叠，预览栏换成占位卡片，导航对应项置灰不可点。靠 body 上的
// data-clock-disabled 属性 + options.css 的属性选择器统一驱动，
// 比 JS 逐个 toggle classList 简洁、且不会有中间态闪烁。
function applyHiddenState() {
    document.body.dataset.clockDisabled = config.hiddenForever ? 'true' : 'false';
}

function onInput(event) {
    readFromForm();
    // 显示范围与常驻开关不属于主题视觉，不应把已选主题标成"自定义"。
    // 外观键与 CSS 启用开关属于主题视觉，编辑即视为偏离当前主题。
    if (!event || ['fontSize', 'bgOpacity', 'bold', 'customHtmlEnabled'].indexOf(event.target.id) !== -1) {
        config.clockStyle = 'custom';
    }
    $('bgOpacityValue').textContent = config.bgOpacity + '%';
    refreshOpacityTrack();
    applyToPreview();
    save();
    updateSwatchSelection();
    updateThemeSelection();
    updateHelpActiveStates();
    // hiddenForever 切换后由 applyHiddenState 折叠/展开下方设置。
    applyHiddenState();
}

// ---- 位置控制（集成在预览 banner 里）----
// 直接在预览 banner（B 站播放器外壳）上拖动时钟来设定位置。
// 点击 banner 空白处 = 把时钟移到该点（click-to-place）；按住时钟拖动 =
// 指针贴住时钟的相对位置不变、整体跟随。点中时钟本身不会让它跳动——
// 只有真的拖动时才跟随，避免每次点击时钟都位移一下。
// posX/posY 存为 0..1 比例，biclock.js 在真实播放器里按视口尺寸换算成像素。

// 拖动时让"指针落在时钟上的相对位置"保持不变：记录 mousedown 时
// 指针相对时钟左上角的偏移（grabOffsetX/Y，单位 px），mousemove 时从
// 指针坐标减去它再换算成比例，时钟就不会"跳"到指针处。click-to-place
// （点空白处）不用这个偏移，直接以指针为目标点。
var grabOffsetX = 0;
var grabOffsetY = 0;

// 指针坐标 → posX/posY 比例。关键：定位是 edge-aligned（left/top 百分比 +
// transform 按自身尺寸反向偏移），所以时钟真正可移动的范围是 banner 减去
// 自身尺寸：renderedLeft = posX * (bannerW - ownW)。换算分母必须用
// (bannerW - ownW) / (bannerH - ownH)，否则 mousedown 记录的偏移在第一次
// mousemove 时被错误的比例"对不上"，时钟会先抖一下再开始跟随。
// offsetX/Y 是指针相对时钟左上角的偏移（拖动用），click-to-place 传 0。
function setPositionFromPointer(clientX, clientY, offsetX, offsetY) {
    var banner = $('previewBanner');
    var clock = $('previewClock');
    var rect = banner.getBoundingClientRect();
    var ownW = clock.offsetWidth;
    var ownH = clock.offsetHeight;
    // 时钟尺寸接近 banner 时（极端情况）退化为整 banner 范围，避免除以 0。
    var spanX = Math.max(1, rect.width - ownW);
    var spanY = Math.max(1, rect.height - ownH);
    var x = (clientX - rect.left - (offsetX || 0)) / spanX;
    var y = (clientY - rect.top - (offsetY || 0)) / spanY;
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
        setPositionFromPointer(e.clientX, e.clientY, grabOffsetX, grabOffsetY);
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
        var onClock = e.target.closest('#previewClock');
        if (onClock) {
            // 点在时钟上：记录指针相对时钟左上角的偏移，拖动时减掉它，
            // 让时钟"贴住"指针而不是跳到指针处。mousedown 本身不移动时钟，
            // 所以单纯点击（没有拖动）时钟不会发生任何位移。
            var clockRect = clock.getBoundingClientRect();
            grabOffsetX = e.clientX - clockRect.left;
            grabOffsetY = e.clientY - clockRect.top;
        } else {
            // 点在 banner 空白处：click-to-place，立即把时钟左上角对到指针处。
            grabOffsetX = 0;
            grabOffsetY = 0;
            setPositionFromPointer(e.clientX, e.clientY);
        }
        clock.classList.add('dragging');
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

// 底部「保存当前外观为自定义主题」按钮：保存 12 个外观键 + HTML 模板快照，
// 让自定义主题成为「一套完整外观（含 HTML 模板）」。HTML 模板文本本身已自动
// 保存到 config.customHtml，这里额外把它快照进主题卡，以便日后一键切换恢复。
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
        config.customHtml = '';
        config.customHtmlEnabled = false;
    } else {
        config.customHtml = theme.customHtml || '';
        config.customHtmlEnabled = !!theme.customHtmlEnabled;
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
    // HTML 模板作为快照随主题保存：自定义主题 = 一套完整外观（含 HTML 模板）。
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
    document.querySelectorAll('.theme-card').forEach(function (button) {
        button.setAttribute('aria-pressed', button.dataset.themeId === activeId ? 'true' : 'false');
    });
}

function updateHelpActiveStates() {
    var map = [
        // 总开关在 UI 上是「启用时钟」（与 hiddenForever 反向）；
        // help-bubble 的 data-help-key 也跟着 UI 改名，这里 on 用 !hiddenForever。
        { key: 'clockEnabled',  on: !config.hiddenForever },
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
            var text = codeEl ? (codeEl.dataset.copyText || codeEl.textContent) : '';
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

// 左侧导航的 scroll-spy：用 IntersectionObserver 跟踪四个分区，
// 把当前落在"活跃区"（视口中部一带）最靠上的分区对应的 .nav-item 高亮。
// 活跃区设为视口 20% ~ 70% 这一段（rootMargin 上 -20% / 下 -70%），
// 这样只有当分区真正进入阅读区时才计为"当前"，避免滚动中导航频繁抖动。
// 全部分区都不在活跃区时（页面顶部或底部）兜底取第一个，保持总有一项高亮。
function initNavSpy() {
    var sectionIds = ['sec-display', 'sec-theme', 'sec-appearance', 'sec-html', 'sec-about'];
    var sections = sectionIds.map(function (id) { return $(id); }).filter(Boolean);
    var items = document.querySelectorAll('.nav-item');
    if (!sections.length || !items.length) return;

    var visible = {};
    var currentId = null;

    function pick() {
        // 在可见集合里取文档顺序最靠前的那一个
        var picked = null;
        sections.forEach(function (sec) {
            if (!visible[sec.id]) return;
            if (!picked || sec.compareDocumentPosition(picked) & Node.DOCUMENT_POSITION_FOLLOWING) {
                picked = sec;
            }
        });
        // 兜底：活跃区空了，回落到第一个分区，避免导航全部熄灭
        if (!picked) picked = sections[0];
        if (picked.id === currentId) return;
        currentId = picked.id;
        items.forEach(function (item) {
            item.classList.toggle('is-active', item.getAttribute('href') === '#' + currentId);
        });
    }

    // 老浏览器没有 IntersectionObserver 时静默降级：只高亮第一项，
    // 不影响锚点跳转（<a href="#..."> + scroll-behavior:smooth 自带）。
    if (typeof IntersectionObserver === 'undefined') {
        items[0].classList.add('is-active');
        return;
    }

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            visible[entry.target.id] = entry.isIntersecting;
        });
        pick();
    }, {
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0
    });

    sections.forEach(function (sec) { observer.observe(sec); });
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

    var ids = ['fontSize', 'bgOpacity', 'bold', 'fullscreenOnly', 'modeAlways', 'customHtmlEnabled', 'clockEnabled'];
    ids.forEach(function (id) {
        $(id).addEventListener('input', onInput);
        $(id).addEventListener('change', onInput);
    });
    bindHexInput('colorHex', 'color');
    bindHexInput('bgColorHex', 'backgroundColor');

    $('customHtml').addEventListener('input', function () {
        // 编辑不再立即写入 config.customHtml：textarea 是草稿态，应用按钮才提交。
        // 这里只刷新高亮预览与 dirty 标记，让用户看到「文本已变、还没生效」。
        refreshTemplateHighlight();
        updateApplyDirtyState();
    });
    initTemplateEditor();
    initStarterTemplate();
    initAiPrompt();
    initExampleHighlights();
    initApplyButton();
    initClearButton();

    initPositionPanel();
    initSaveCustomTheme();
    initCopyButtons();
    initNavSpy();

    setInterval(refreshPreviewText, 1000);
}

document.readyState !== 'loading' ? init() : document.addEventListener('DOMContentLoaded', init);
