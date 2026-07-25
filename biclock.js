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

// 时钟右上角的「×」关闭按钮与弹出菜单：与 clock 同级的兄弟节点，
// 不放进 clock 子节点（renderClockLayout 每秒 replaceChildren 会清掉子节点），
// 由 updateClock() 统一 append + applyCloseMenuPosition() 跟随时钟定位。
// 三个节点由 stopTimer() 一并摘下，保持「不可见时 DOM 里无残留」不变量。
var closeBtn = document.createElement('button');
closeBtn.type = 'button';
closeBtn.className = 'bpx-clock-close';
closeBtn.setAttribute('aria-label', '关闭时钟');
closeBtn.textContent = '×';
// fixed 定位与 clock 同源：每秒 tick 由 applyCloseMenuPosition() 重算 left/top。
closeBtn.style.position = 'fixed';
closeBtn.style.zIndex = '10000';
closeBtn.style.width = '20px';
closeBtn.style.height = '20px';
closeBtn.style.lineHeight = '18px';
closeBtn.style.textAlign = 'center';
closeBtn.style.padding = '0';
closeBtn.style.border = '0';
closeBtn.style.borderRadius = '50%';
closeBtn.style.background = 'rgba(0, 0, 0, 0.62)';
closeBtn.style.color = '#ffffff';
closeBtn.style.fontSize = '15px';
closeBtn.style.fontWeight = '700';
closeBtn.style.cursor = 'pointer';
closeBtn.style.opacity = '0';
closeBtn.style.transition = 'opacity 0.12s ease';
closeBtn.style.pointerEvents = 'auto';

var menuPanel = document.createElement('div');
menuPanel.className = 'bpx-clock-menu';
menuPanel.style.position = 'fixed';
menuPanel.style.zIndex = '10000';
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

// 鼠标是否停留在 clock 或 closeBtn 上（initCloseMenu 维护）。
// onUp 在拖动结束时根据它恢复叉号可见性 —— 拖动期间强制隐去叉号，
// 但拖动结束后若指针仍在时钟上，应立即恢复显示，避免要等下次 mouseenter。
var hoverCount = 0;

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
// 与 clock 同级（兄弟节点），由 updateClock() 统一挂载/摘除、applyCloseMenuPosition()
// 跟随时钟左上角重算 left/top。叉号默认 opacity:0，鼠标进入时钟区域显示，离开隐藏。
// 点叉号展开菜单：三个可见性开关的快捷入口（写 chrome.storage.local 后由 storage.onChanged
// 回调统一收尾，与设置页手动改开关走同一路径）。点菜单外或 Esc 收起菜单。
//
// 拖动期间（dragging=true）叉号自动隐去；菜单展开期间不允许拖动。
//
// 所有 mousedown/click 都 stopPropagation + preventDefault：避免触发时钟自身的拖动
// 起始点（onDown 监听在 clock 上，叉号在 clock 内部，e.target 会落在叉号上），
// 也避免冒泡到 Bilibili 播放器被误判为「点视频暂停」。

function buildMenuItems() {
    var items = [
        { text: '改为仅全屏显示', desc: '关掉「仅全屏显示」的快捷入口', apply: { fullscreenOnly: true } },
        { text: '改为随进度条显示', desc: '关掉「常驻显示」的快捷入口', apply: { alwaysShow: false } },
        { text: '永久隐藏',          desc: '可在设置页「显示」分区关闭', apply: { hiddenForever: true } }
    ];
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
        // 第三个选项（永久隐藏）单独染色，提示语义更重。
        if (item.apply.hiddenForever) {
            btn.style.color = '#dc2626';
        }
        // hover 用 mouseover/mouseout 实现以兼容性更好；不依赖 :hover。
        btn.addEventListener('mouseover', function () {
            if (!item.apply.hiddenForever) {
                btn.style.background = 'oklch(97.2% 0.004 350)';
                btn.style.color = '#fb7299';
            } else {
                btn.style.background = 'oklch(96.5% 0.03 25)';
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
            chrome.storage.local.set(item.apply);
            // 三个选项都不会立即关闭菜单，靠 storage.onChanged 触发 stopTimer()/startTimer()
            // 自然收尾：选项 3 永久隐藏会让整个时钟+叉号+菜单被摘下；
            // 选项 1/2 改开关后菜单保持展开，方便用户连续调整。
        });
        menuPanel.appendChild(btn);
    });
}

function applyCloseMenuPosition() {
    // 叉号贴在时钟右上角外侧（top: -8px; right: -8px → left/top 用时钟 left+宽-偏移）。
    var clockRect = clock.getBoundingClientRect();
    var size = 20;
    var offset = 6;
    closeBtn.style.left = (clockRect.right - size + offset).toFixed(1) + 'px';
    closeBtn.style.top = (clockRect.top - offset).toFixed(1) + 'px';
    // 菜单展开在叉号下方，左对齐时钟右边缘（避免出右边界则向左展开）。
    if (menuPanel.style.display !== 'none') {
        var menuW = menuPanel.offsetWidth || 188;
        var menuH = menuPanel.offsetHeight || 100;
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var left = clockRect.right - menuW;
        if (left < 8) left = clockRect.left;
        if (left + menuW > vw - 8) left = vw - 8 - menuW;
        var top = clockRect.bottom + 6;
        if (top + menuH > vh - 8) top = clockRect.top - menuH - 6;
        menuPanel.style.left = left.toFixed(1) + 'px';
        menuPanel.style.top = top.toFixed(1) + 'px';
    }
}

function showMenu() {
    menuPanel.style.display = 'block';
    applyCloseMenuPosition();
}

function hideMenu() {
    menuPanel.style.display = 'none';
}

function initCloseMenu() {
    // 构建菜单项一次（菜单面板节点本身是单例）。
    buildMenuItems();

    // 鼠标进入时钟/叉号任一区域 → 显示叉号；都离开 → 隐藏叉号。
    // 用 hoverCount 跨节点跟踪（模块级变量，onUp 也读它恢复可见性）：
    // clock 与 closeBtn 是兄弟节点，鼠标从 clock 移到 closeBtn 会先触发
    // clock.mouseleave（count--）再触发 closeBtn.mouseenter（count++），
    // 若简单按单个节点的 enter/leave 切换会瞬间 opacity:0→1 闪烁。
    // 拖动期间（dragging=true）强制隐去；菜单展开期间强制保留。
    hoverCount = 0;
    function enter() {
        hoverCount++;
        if (dragging) return;
        closeBtn.style.opacity = '1';
    }
    function leave() {
        hoverCount = Math.max(0, hoverCount - 1);
        if (hoverCount === 0 && menuPanel.style.display === 'none') {
            closeBtn.style.opacity = '0';
        }
    }
    clock.addEventListener('mouseenter', enter);
    clock.addEventListener('mouseleave', leave);
    closeBtn.addEventListener('mouseenter', enter);
    closeBtn.addEventListener('mouseleave', leave);

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
        // 拖动结束：若指针仍在时钟/叉号上（hoverCount>0）恢复叉号可见。
        if (hoverCount > 0) closeBtn.style.opacity = '1';
        // 拦截 mouseup 的冒泡，与 onDown 对称：避免 Bilibili 把 mousedown+mouseup
        // 合成的 click 解释为"点视频暂停"。
        e.stopPropagation();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        // 持久化最终位置：写入 chrome.storage.local 后，
        // options 预览栏下次打开会用这个新位置；同标签页的 storage.onChanged
        // 会回调把 config 同样的值写一遍（幂等），无副作用。
        chrome.storage.local.set({ posX: config.posX, posY: config.posY });
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
    if (clock.parentNode) {
        clock.parentNode.removeChild(clock);
    }
    // 「×」关闭按钮与菜单面板是 clock 的兄弟节点，一并摘下，
    // 保持「不可见时 DOM 里无残留」不变量；菜单自然收起。
    if (closeBtn.parentNode) {
        closeBtn.parentNode.removeChild(closeBtn);
    }
    hideMenu();
    if (menuPanel.parentNode) {
        menuPanel.parentNode.removeChild(menuPanel);
    }
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
    return targetDiv.getAttribute('data-ctrl-hidden') === 'false';
}

function updateClock() {
    var container = document.getElementsByClassName('bpx-player-container')[0];
    if (!container) {
        return;
    }
    applyStyles();
    renderClockLayout(clock, formatTime(new Date()), config, 'bpx-player-clock');

    // 两种显示模式都挂到播放器根容器：位置用 fixed + 容器视口坐标独立计算，
    // 挂载点不影响定位。挂在顶栏（.bpx-player-top）里会踩到 CSS contain/transform
    // 陷阱——祖先有 transform 时 fixed 会改以该祖先为参照系，位置随之漂移；
    // 根容器稳定，避开这个问题。鼠标触发模式下控件隐藏时 stopTimer() 会立刻
    // 把节点摘下，所以无需依赖顶栏的显隐来带走时钟。
    container.appendChild(clock);
    // 「×」关闭按钮与菜单面板跟随时钟挂载，按位置同步。
    if (!closeBtn.parentNode) container.appendChild(closeBtn);
    if (!menuPanel.parentNode) container.appendChild(menuPanel);
    applyCloseMenuPosition();
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

function init() {
    chrome.storage.local.get(DEFAULTS, function (stored) {
        config = stored;
        // 内容脚本可能在没打开 popup 时被加载，故迁移结果需自行写回存储，
        // 避免每次加载都重复迁移。onPersist 由 shared 版本在改完 config 后回调。
        migrateRemovedTheme(config, function (cfg) {
            chrome.storage.local.set(cfg);
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
