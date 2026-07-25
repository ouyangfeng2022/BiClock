// DEFAULTS / pad / formatTime / makeClockPart / hexToRgba /
// renderClockLayout / migrateRemovedTheme / THEME_STYLE_KEYS / THEME_CSS_KEYS / REMOVED_THEME_IDS
// 由 shared.js 提供（manifest content_scripts 在本脚本之前注入 shared.js）。

var config = {};

var clock = document.createElement('div');
clock.className = 'bpx-player-top-clock';
clock.style.position = 'absolute';
// 高 z-index 避免被 Bilibili 的控件层盖住。
clock.style.zIndex = '9999';
clock.style.userSelect = 'none';
// 暗示可拖动：现代浏览器在浏览器全屏里点击页面内容不会退出全屏（只有 Esc 退出），
// 所以位置既能在 options 预览栏拖动设定，也能在真实播放器里直接按住时钟拖动微调。
// 与 options.css 的 .preview-clock 用同一组光标（grab/grabbing），跨场景一致。
clock.style.cursor = 'grab';

// 用户自定义 CSS 通过 <style> 注入：textContent 随 config 重写。
// 挂到 document.documentElement（不挂 head：内容脚本运行时 head 可能尚未就绪，
// documentElement 一定在）。节点只创建一次，反复更新 textContent。
var customCssStyle = document.createElement('style');
customCssStyle.id = 'biclock-custom-css';
document.documentElement.appendChild(customCssStyle);

// 时钟右上角的「×」关闭按钮：作为 clock 的子节点，用 absolute 贴在右上角外侧。
// 这样天然跟随时钟（位置无需每秒重算）、天然随显隐（stopTimer 摘 clock 时一起走）。
// renderClockLayout 每秒 replaceChildren 会清掉子节点，所以 updateClock() 在
// renderClockLayout 之后再 appendChild(closeBtn) 把它补回来。
//
// 视觉刻意做得克制：16×16 小圆点、半透明灰白、默认 opacity:0，悬停 clock 才浮现
// （0.55 不抢眼），悬停叉号本身升到 0.9 提示可点。点叉号展开关闭菜单。
var closeBtn = document.createElement('button');
closeBtn.type = 'button';
closeBtn.className = 'bpx-clock-close';
closeBtn.setAttribute('aria-label', '关闭时钟');
closeBtn.textContent = '×';
closeBtn.style.position = 'absolute';
closeBtn.style.top = '-8px';
closeBtn.style.right = '-8px';
closeBtn.style.width = '16px';
closeBtn.style.height = '16px';
closeBtn.style.margin = '0';
closeBtn.style.padding = '0';
closeBtn.style.lineHeight = '15px';
closeBtn.style.textAlign = 'center';
closeBtn.style.border = '1px solid rgba(0, 0, 0, 0.18)';
closeBtn.style.borderRadius = '50%';
closeBtn.style.background = 'rgba(0, 0, 0, 0.45)';
closeBtn.style.color = 'rgba(255, 255, 255, 0.85)';
closeBtn.style.fontSize = '12px';
closeBtn.style.fontWeight = '700';
closeBtn.style.fontFamily = 'system-ui, sans-serif';
closeBtn.style.cursor = 'pointer';
closeBtn.style.opacity = '0';
closeBtn.style.transition = 'opacity 0.14s ease';
closeBtn.style.pointerEvents = 'auto';
closeBtn.style.userSelect = 'none';

// 关闭菜单：与 clock 同源命名空间（bpx-clock-*），但用 fixed 定位、需要时挂到
// document.body。这样菜单不受 clock 每秒 appendChild 影响，也不被 clock 的
// transform 牵动。showMenu() 时计算位置并 append；hideMenu() 时 detach。
var menuPanel = document.createElement('div');
menuPanel.className = 'bpx-clock-menu';
menuPanel.style.position = 'fixed';
menuPanel.style.zIndex = '10001';
menuPanel.style.minWidth = '188px';
menuPanel.style.padding = '6px';
menuPanel.style.border = '1px solid rgba(0, 0, 0, 0.08)';
menuPanel.style.borderRadius = '8px';
menuPanel.style.background = '#ffffff';
menuPanel.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.18)';
menuPanel.style.color = '#172033';
menuPanel.style.fontSize = '13px';
menuPanel.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif';
menuPanel.style.lineHeight = '1.45';
menuPanel.style.display = 'none';

var timer = null;


function applyStyles() {
    // 定位始终由 JS 计算（用户在 options 页拖拽 posX/posY 设定位置），
    // 不受外观模式影响：用 fixed 定位 + 相对播放器容器的视口坐标。Bilibili 的
    // .bpx-player-container 不建立定位上下文，挂在容器里用 absolute 会以错误的
    // 祖先为参照，位置漂移。fixed 直接相对视口，再把 (posX, posY) 比例换算成
    // 容器在视口里的真实像素，这样无论普通/宽屏/网页全屏/浏览器全屏，时钟都
    // 落在视频画面内。
    clock.style.position = 'fixed';
    var container = document.getElementsByClassName('bpx-player-container')[0];
    var rect = container ? container.getBoundingClientRect() : null;
    var w = rect ? rect.width : window.innerWidth;
    var h = rect ? rect.height : window.innerHeight;
    var ox = rect ? rect.left : 0;
    var oy = rect ? rect.top : 0;
    // 用 translate 把时钟左上角对到容器内 (posX, posY) 比例处，
    // 加上容器左上角偏移得到视口坐标，适配任意分辨率与页面布局。
    var x = (ox + config.posX * w).toFixed(1);
    var y = (oy + config.posY * h).toFixed(1);
    clock.style.left = x + 'px';
    clock.style.top = y + 'px';
    // 边角对齐：translate 的百分比相对元素自身尺寸。
    // posX=0 → 不偏移（左贴左），posX=1 → 偏移整身宽（右贴右），
    // 0.5 → 偏移半身（居中）。不测量像素，让 posY=0 能真正贴顶。
    clock.style.transform = 'translate(' + (config.posX * -100) + '%, ' + (config.posY * -100) + '%)';

    // 外观双模式：cssMode 时清掉外观类 inline style，用户 CSS 成唯一来源
    // （无需 !important）；否则照常把外观灌成 inline。
    // updateClock() 每秒 tick 都会重跑这里，所以两种模式之间切换不会留下残留，
    // 用户也不会看到「inline 又回来盖住 CSS」的闪烁。
    if (config.customCssEnabled && config.customCss) {
        APPEARANCE_INLINE_KEYS.forEach(function (k) {
            clock.style.removeProperty(k);
        });
    } else {
        clock.style.fontSize = config.fontSize + 'px';
        clock.style.color = config.color;
        clock.style.fontWeight = config.bold ? 'bold' : 'normal';
        clock.style.fontFamily = config.fontFamily;
        clock.style.textShadow = config.textShadow;
        clock.style.backgroundColor = hexToRgba(config.backgroundColor, config.bgOpacity / 100);
        clock.style.border = config.borderWidth + 'px solid ' + hexToRgba(config.borderColor, config.borderOpacity / 100);
        clock.style.boxSizing = 'border-box';
        // 圆角背景：按字号比例缩放，不同字号下弧度协调一致。
        clock.style.padding = '0 ' + (config.fontSize * 0.3).toFixed(1) + 'px';
        clock.style.borderRadius = (config.fontSize * 0.3).toFixed(1) + 'px';
    }

    // 用户自定义 CSS：disabled 或空串时清空（不删节点，避免反复创建）。
    applyCustomCss();
}

// 把 config.customCss 同步到 <style> 节点。
// 用户写的 CSS 作用域是整个 B 站页面，但选择器前缀 .bpx-player-top-clock /
// .bpx-player-clock-* 只有时钟节点匹配；用户用 !important 才能覆盖 inline style。
function applyCustomCss() {
    customCssStyle.textContent =
        config.customCssEnabled && config.customCss ? config.customCss : '';
}

// 真实播放器里的时钟拖动：与 options.js 预览栏拖动同源。
// 按住时钟左键即可拖动；松开后写回 chrome.storage.local，与 options 预览栏
// 共用同一份 posX/posY，所以两边的位置永远一致。显示行为完全保持原样：
// 鼠标触发模式下控件隐藏仍会摘下时钟，再次显示时落在最新位置。
//
// 拖动期间 updateClock() 每秒 tick 仍会 appendChild + applyStyles ——
// appendChild 复用同一节点不会产生副本；applyStyles 从 config.posX/posY
// 重算位置，而我们拖动时正是把它写进 config，所以每秒 tick 反而把刚拖到
// 的位置稳定住，不会跳回原位。
//
// grabOffset：与 options.js 同思路，记录 mousedown 时指针相对时钟左上角的
// 偏移，让拖动时"指针贴住时钟的同一处"而不是"时钟跳到指针处"。纯点击
// （按下即松开、无 mousemove）不会移动时钟，位置不变。
var grabOffsetX = 0;
var grabOffsetY = 0;
var dragging = false;
// 鼠标是否悬停在时钟上：鼠标触发模式下，B 站会因鼠标静止超时而隐藏控件
// （data-ctrl-hidden=true），时钟跟着消失；时钟一没，鼠标瞬间又"落回"视频
// 区，B 站又把控件显示回来——如此往复形成抖动，用户根本没法把鼠标停在
// 叉号上点它。悬停时把时钟"钉"住（shouldShow 增加此例外），离开后再回归
// 自然显隐。
var clockHovered = false;

function setPositionFromPointer(clientX, clientY, offsetX, offsetY) {
    var container = document.getElementsByClassName('bpx-player-container')[0];
    if (!container) return;
    var rect = container.getBoundingClientRect();
    var ownW = clock.offsetWidth;
    var ownH = clock.offsetHeight;
    // edge-aligned：定位是 left/top + transform 按自身尺寸反向偏移，
    // 所以时钟真正可移动范围是容器减去自身尺寸，分母必须用 spanX/Y，
    // 否则首次 mousemove 会因比例错位让时钟先抖一下再开始跟随。
    var spanX = Math.max(1, rect.width - ownW);
    var spanY = Math.max(1, rect.height - ownH);
    var x = (clientX - rect.left - (offsetX || 0)) / spanX;
    var y = (clientY - rect.top - (offsetY || 0)) / spanY;
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    config.posX = x;
    config.posY = y;
    // 立即重应用位置，不等下一秒 tick：拖动响应跟手。
    applyStyles();
}

// ---- 「×」关闭按钮 + 菜单面板 ----
//
// closeBtn 是 clock 的子节点（absolute 贴右上角外侧）；menuPanel 是独立节点，
// 用 fixed 定位、showMenu 时挂 document.body、hideMenu 时摘下。点叉号展开菜单：
// 三个可见性开关的快捷入口（写 chrome.storage.local 后由 storage.onChanged
// 回调统一收尾，与设置页手动改开关走同一路径）。点菜单外或 Esc 收起菜单。
//
// 拖动期间（dragging=true）叉号自动隐去；菜单展开期间不允许拖动。
//
// 所有 mousedown/click 都 stopPropagation + preventDefault：避免触发时钟自身的
// 拖动起始点（onDown 监听在 clock 上，叉号在 clock 内部，e.target 会落在叉号上），
// 也避免冒泡到 Bilibili 播放器被误判为「点视频暂停」。

function buildMenuItems() {
    // 每次打开菜单都重建：菜单面板节点本身是单例，但项要根据当前状态（如
    // 是否处于全屏）动态决定，否则在全屏下显示「改为仅全屏显示」既无意义
    // （当前已是全屏，开启 fullscreenOnly 时钟仍显示，无可见变化）又会被
    // 误以为是损坏的菜单项。
    while (menuPanel.firstChild) menuPanel.removeChild(menuPanel.firstChild);
    var container = document.getElementsByClassName('bpx-player-container')[0];
    var screenAttr = container ? container.getAttribute('data-screen') : '';
    // 用多个信号综合判断"当前是否处于全屏"：任一为真即视为全屏。
    // - document.fullscreenElement：Fullscreen API 标准信号（浏览器原生全屏）。
    // - data-screen === 'full'：B 站属性，'full' = 浏览器原生全屏。
    // - data-screen === 'web'：B 站"网页全屏"，用户体感也是"全屏"。
    // 不同浏览器/版本里单一信号可能失灵（如 Firefox 某些场景 fullscreenElement
    // 时序晚），多信号 OR 兜底，确保全屏下不会误显该项。
    var inFullscreen = document.fullscreenElement != null
        || screenAttr === 'full'
        || screenAttr === 'web';
    // fullscreenOnly 已开启时，再点也不会改变 config，同样隐藏。
    var alreadyFsOnly = !!config.fullscreenOnly;
    var items = [];
    // 仅在「非全屏 且 fullscreenOnly 未开启」时提供「改为仅全屏显示」。
    if (!inFullscreen && !alreadyFsOnly) {
        items.push({ text: '改为仅全屏显示', apply: { fullscreenOnly: true } });
    }
    items.push({ text: '改为随进度条显示', apply: { alwaysShow: false } });
    items.push({ text: '关闭时钟',         apply: { hiddenForever: true } });
    items.forEach(function (item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bpx-clock-menu-item';
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.padding = '7px 10px';
        btn.style.border = '0';
        btn.style.borderRadius = '5px';
        btn.style.background = 'transparent';
        btn.style.color = '#172033';
        btn.style.font = 'inherit';
        btn.style.fontSize = '13px';
        btn.style.textAlign = 'left';
        btn.style.cursor = 'pointer';
        btn.textContent = item.text;
        // 「关闭时钟」单独染红色，提示语义更重（不可恢复式操作）。
        if (item.apply.hiddenForever) {
            btn.style.color = '#dc2626';
        }
        btn.addEventListener('mouseover', function () {
            if (!item.apply.hiddenForever) {
                btn.style.background = '#fb7299';
                btn.style.color = '#ffffff';
            } else {
                btn.style.background = '#fee2e2';
            }
        });
        btn.addEventListener('mouseout', function () {
            btn.style.background = 'transparent';
            btn.style.color = item.apply.hiddenForever ? '#dc2626' : '#172033';
        });
        btn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            e.stopPropagation();
        });
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            safeStorageSet(item.apply);
            // 三个选项都不立即关闭菜单，靠 storage.onChanged 触发 stopTimer()/startTimer()
            // 自然收尾：「关闭时钟」会让整个时钟+叉号被摘下（菜单随后被 hideMenu 摘）；
            // 选项 1/2 改开关后菜单保持展开，方便用户连续调整。
        });
        menuPanel.appendChild(btn);
    });
}

// 计算菜单位置：以叉号为锚点，菜单从叉号右下方展开；超出视口时向反方向翻。
// 只在 showMenu 时调一次（菜单用 fixed 定位、挂 body，不受 clock tick 影响）。
function positionMenu() {
    var anchor = closeBtn.getBoundingClientRect();
    menuPanel.style.display = 'block'; // 先显示才能测宽高
    var menuW = menuPanel.offsetWidth || 188;
    var menuH = menuPanel.offsetHeight || 100;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    // 默认贴叉号右侧、下方 4px；右越界 → 翻到左侧；下越界 → 翻到上方。
    var left = anchor.right - menuW;
    if (left < 8) left = Math.max(8, anchor.left);
    if (left + menuW > vw - 8) left = vw - 8 - menuW;
    var top = anchor.bottom + 4;
    if (top + menuH > vh - 8) top = Math.max(8, anchor.top - menuH - 4);
    menuPanel.style.left = left.toFixed(1) + 'px';
    menuPanel.style.top = top.toFixed(1) + 'px';
}

function showMenu() {
    if (!menuPanel.parentNode) {
        // 浏览器全屏（Fullscreen API）下只有全屏元素的后代可见，
        // 挂 document.body 会被全屏层盖住、菜单看不到（叉号点击像无效）。
        // 时钟挂在 .bpx-player-container 且全屏下能显示，说明 container 在
        // 全屏树内；菜单挂到同一处即可。container 无 transform（否则时钟
        // 自身的 position: fixed 也会漂），菜单的 fixed 定位仍然相对视口。
        var container = document.getElementsByClassName('bpx-player-container')[0];
        (container || document.body).appendChild(menuPanel);
    }
    // 每次展开都重建菜单项：根据当前是否全屏决定是否显示「改为仅全屏显示」。
    buildMenuItems();
    positionMenu();
}

function hideMenu() {
    menuPanel.style.display = 'none';
    if (menuPanel.parentNode) menuPanel.parentNode.removeChild(menuPanel);
}

function initCloseMenu() {
    // 菜单项在每次 showMenu() 时按当前状态重建，这里不再预构建。

    // 悬停逻辑：closeBtn 是 clock 子节点，鼠标在 clock 内部移动不会触发 clock.mouseleave
    // （mouseleave 不冒泡，且只在离开整个 clock 含子节点时触发），所以无需 hoverCount。
    // 拖动期间强制隐去；菜单展开期间强制保留 0.55。
    clock.addEventListener('mouseenter', function () {
        clockHovered = true;
        if (dragging) return;
        closeBtn.style.opacity = '0.55';
    });
    clock.addEventListener('mouseleave', function () {
        clockHovered = false;
        if (menuPanel.style.display !== 'none') return;
        closeBtn.style.opacity = '0';
    });
    // 悬停叉号本身：升到 0.9 提示可点。
    closeBtn.addEventListener('mouseenter', function () {
        closeBtn.style.opacity = '0.9';
    });
    closeBtn.addEventListener('mouseleave', function () {
        // 回到「clock 被 hover 但叉号未被 hover」的中等档。
        closeBtn.style.opacity = '0.55';
    });

    // 叉号点击：切换菜单可见性；mousedown 拦截拖动起点。
    closeBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();
    });
    closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (menuPanel.style.display === 'none') showMenu(); else hideMenu();
    });

    // 菜单展开时点其它地方 / 按 Esc 收起。
    document.addEventListener('mousedown', function (e) {
        if (menuPanel.style.display === 'none') return;
        if (e.target === closeBtn || e.target.closest('.bpx-clock-menu')) return;
        hideMenu();
    }, true);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menuPanel.style.display !== 'none') {
            hideMenu();
        }
    });
}

function initClockDrag() {
    function onMove(e) {
        if (!dragging) return;
        e.preventDefault();
        clock.style.cursor = 'grabbing';
        setPositionFromPointer(e.clientX, e.clientY, grabOffsetX, grabOffsetY);
    }
    function onUp(e) {
        if (!dragging) return;
        dragging = false;
        clock.style.cursor = 'grab';
        // 拖动结束：若指针仍在时钟上（含子节点叉号），恢复叉号的中等档可见。
        // 用 :hover 检测，避免再维护跨节点 hoverCount。
        if (clock.matches(':hover')) closeBtn.style.opacity = '0.55';
        // 拦截 mouseup 的冒泡，与 onDown 对称：避免 Bilibili 把 mousedown+mouseup
        // 合成的 click 解释为"点视频暂停"。
        e.stopPropagation();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        // 持久化最终位置：写入 chrome.storage.local 后，
        // options 预览栏下次打开会用这个新位置；同标签页的 storage.onChanged
        // 会回调把 config 同样的值写一遍（幂等），无副作用。
        safeStorageSet({ posX: config.posX, posY: config.posY });
    }
    function onClick(e) {
        // 时钟自己消费 click：阻止它冒泡到 Bilibili 的视频区，否则一次拖动收尾
        // （或单纯点一下时钟）会被 B 站误判为点击视频区域而暂停 / 恢复播放。
        // 不阻止同一 frame 的其它 listener（capture 阶段），只切断冒泡。
        e.stopPropagation();
    }
    function onDown(e) {
        if (e.button !== 0) return;
        // 点在「×」关闭按钮或菜单面板内时，让 initCloseMenu 自己处理，
        // 不进入拖动状态（否则叉号点击会被误判为拖动起点）。
        if (e.target === closeBtn || e.target.closest('.bpx-clock-menu') || e.target.closest('.bpx-clock-close')) return;
        // 菜单展开期间不允许开始拖动（避免拖动+菜单同时操作造成混乱）。
        if (menuPanel.style.display !== 'none') return;
        // 只有时钟自己消费这次按下：Bilibili 播放器的全局鼠标监听不应被触发，
        // 例如误判用户在视频区域点击而隐藏控件。stopPropagation 切断冒泡，
        // preventDefault 阻止选区/拖拽幽灵图等默认副作用。
        e.preventDefault();
        e.stopPropagation();
        var clockRect = clock.getBoundingClientRect();
        grabOffsetX = e.clientX - clockRect.left;
        grabOffsetY = e.clientY - clockRect.top;
        dragging = true;
        // 拖动期间隐藏叉号（避免它跟着时钟飘动）；菜单收起保证一致。
        closeBtn.style.opacity = '0';
        hideMenu();
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }
    clock.addEventListener('mousedown', onDown);
    clock.addEventListener('click', onClick);
}


function startTimer() {
    stopTimer();
    updateClock();
    timer = setInterval(updateClock, 1000);
}

function stopTimer() {
    if (timer !== null) {
        clearInterval(timer);
        timer = null;
    }
    // 非全屏或控件隐藏时，把 clock 从 DOM 中移除，
    // 避免在浏览器原生视频浮窗仍然可见的场景下残留。
    // 叉号是 clock 的子节点，跟着 clock 一起走；菜单是独立节点（挂 body），
    // 需单独 hideMenu() 摘下。
    if (clock.parentNode) {
        clock.parentNode.removeChild(clock);
    }
    hideMenu();
}

// 是否显示时钟的统一判官。
//
// 仅全屏显示（fullscreenOnly）：
// - true（默认）：仅 data-screen="full" 时显示。浏览器全屏才会隐藏其原生
//   视频工具栏，宽屏/网页全屏仍会被那些覆盖层挡住，故默认排除。
// - false：任何播放器屏幕模式都显示（普通/宽屏/网页全屏/浏览器全屏），
//   用户接受与 B 站自身覆盖层并存。
//
// 显示模式（alwaysShow）：
// - false（鼠标触发，默认）：在 fullscreenOnly 选定的范围内，再要求控件可见
//   才显示；控件自动隐藏后随即消失，避免遮挡画面。
// - true（常驻）：在 fullscreenOnly 选定的范围内一直显示，不随控件隐藏。
function shouldShow() {
    var targetDiv = document.getElementsByClassName('bpx-player-container')[0];
    if (!targetDiv) return false;
    // 永久隐藏是最高优先级闸门：用户从「×」菜单选了「永久隐藏」或手动开了
    // 设置页的开关后，无视 fullscreenOnly / alwaysShow，一律不显示。
    if (config.hiddenForever) return false;
    if (config.fullscreenOnly && targetDiv.getAttribute('data-screen') !== 'full') {
        return false;
    }
    if (config.alwaysShow) return true;
    // 鼠标触发模式下的悬停守护：鼠标正在时钟上时，即便 B 站把控件隐藏了
    // （data-ctrl-hidden=true，鼠标静止超时），也保持时钟可见。否则会出现
    // 控件隐藏→时钟消失→鼠标"落回"视频区→控件再显→时钟再显 的抖动循环，
    // 让叉号根本无法被点中。仅对 hover 生效；一旦鼠标离开时钟回归自然显隐。
    if (clockHovered) return true;
    return targetDiv.getAttribute('data-ctrl-hidden') === 'false';
}

function updateClock() {
    var container = document.getElementsByClassName('bpx-player-container')[0];
    if (!container) {
        return;
    }
    applyStyles();
    renderClockLayout(clock, formatTime(new Date()), config, 'bpx-player-clock');
    // renderClockLayout 用 replaceChildren 清空了 clock 的子节点（包括叉号），
    // 这里立刻把叉号补回。每秒 tick 都重挂一次（节点复用），保证叉号始终在 clock 里。
    clock.appendChild(closeBtn);

    // 两种显示模式都挂到播放器根容器：位置用 fixed + 容器视口坐标独立计算，
    // 挂载点不影响定位。挂在顶栏（.bpx-player-top）里会踩到 CSS contain/transform
    // 陷阱——祖先有 transform 时 fixed 会改以该祖先为参照系，位置随之漂移；
    // 根容器稳定，避开这个问题。鼠标触发模式下控件隐藏时 stopTimer() 会立刻
    // 把节点摘下，所以无需依赖顶栏的显隐来带走时钟。
    // 叉号是 clock 的子节点，跟着 clock 一起挂/摘；菜单是独立节点，由 showMenu/hideMenu
    // 单独管理（不在每秒 tick 里重挂）。
    container.appendChild(clock);
}

function run() {
    var targetDiv = document.getElementsByClassName('bpx-player-container')[0];
    if (!targetDiv) {
        return;
    }
    initClockDrag();
    initCloseMenu();
    var observer = new MutationObserver(function (mutations) {
        // 任意属性变化后都用 shouldShow() 统一判断，避免漏掉 data-screen
        // 与 data-ctrl-hidden 之间谁先谁后的顺序问题。
        // data-screen 在 fullscreenOnly=false 时不再参与判断，但监听开销极低，
        // 仍统一交给 shouldShow()，无需在此分支。
        if (mutations.some(function (m) {
            return m.attributeName === 'data-screen' || m.attributeName === 'data-ctrl-hidden';
        })) {
            if (shouldShow()) {
                startTimer();
            } else {
                stopTimer();
            }
        }
    });
    var config_observer = { attributes: true };
    observer.observe(targetDiv, config_observer);

    // 首次进入时若已经处于全屏 + 控件可见，直接启动。
    if (shouldShow()) {
        startTimer();
    }
}

// 安全写入 chrome.storage.local：扩展被重载后，旧标签页里残留的内容脚本
// 仍会跑（直到标签页刷新），此时它的 chrome.* 引用已失效，任何调用都会抛
// "Extension context invalidated"。包装一层 try/catch，让当下操作（拖动落点、
// 关闭菜单）不因存储写入失败而中断 —— 数据暂留内存，下次刷新标签页自然丢，
// 不影响用户当前会话。
function safeStorageSet(obj) {
    try {
        if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set(obj);
        }
    } catch (e) {
        // 扩展上下文已失效（用户重载了扩展但没刷新本标签页）；静默降级。
    }
}

function init() {
    // 扩展被重载后，旧标签页里残留的内容脚本仍会跑一次 init()，但 chrome.*
    // 引用已失效。这种情况下静默退出，等用户刷新标签页加载新版本。
    try {
        if (!chrome || !chrome.storage || !chrome.storage.local) return;
    } catch (e) {
        return;
    }
    chrome.storage.local.get(DEFAULTS, function (stored) {
        config = stored;
        // 内容脚本可能在没打开 popup 时被加载，故迁移结果需自行写回存储，
        // 避免每次加载都重复迁移。onPersist 由 shared 版本在改完 config 后回调。
        migrateRemovedTheme(config, function (cfg) {
            safeStorageSet(cfg);
        });
        // popup 修改后实时生效：无需刷新页面
        chrome.storage.onChanged.addListener(function (changes, area) {
            if (area !== 'local') return;
            Object.keys(changes).forEach(function (key) {
                config[key] = changes[key].newValue;
            });
            // 显示相关开关（alwaysShow / fullscreenOnly / hiddenForever）切换
            // 不会触发播放器属性变化，需要主动按当前状态重启/停止定时器，
            // 否则切换后要等下次控件动作才生效。
            if ('alwaysShow' in changes || 'fullscreenOnly' in changes || 'hiddenForever' in changes) {
                if (shouldShow()) {
                    startTimer();
                } else {
                    stopTimer();
                }
                return;
            }
            // 其余样式字段（透明度、颜色、字号、位置等）只更新 config 的话，
            // 要等下一秒 updateClock() 的 tick 才应用到 DOM，拖动滑块时会有
            // 明显延迟、看似"设置无效"。这里在时钟可见时立即重应用样式。
            if (clock.parentNode) {
                applyStyles();
                renderClockLayout(clock, formatTime(new Date()), config, 'bpx-player-clock');
            }
        });
        run();
    });
}

document.readyState !== 'loading' ? init() : document.addEventListener('DOMContentLoaded', init);
