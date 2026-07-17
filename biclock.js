// DEFAULTS / pad / formatTime / makeClockPart / hexToRgba /
// renderClockLayout / migrateRemovedTheme / THEME_STYLE_KEYS / REMOVED_THEME_IDS
// 由 shared.js 提供（manifest content_scripts 在本脚本之前注入 shared.js）。

var config = {};

var clock = document.createElement('div');
clock.className = 'bpx-player-top-clock';
clock.style.position = 'absolute';
// 用户无法在浏览器全屏里点击时钟（会退出全屏），所以位置改在 popup 面板里调整。
// 高 z-index 避免被 Bilibili 的控件层盖住。
clock.style.zIndex = '9999';
clock.style.userSelect = 'none';

var timer = null;


function applyStyles() {
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
    // 用 fixed 定位 + 相对播放器容器的视口坐标：Bilibili 的 .bpx-player-container
    // 不建立定位上下文，挂在容器里用 absolute 会以错误的祖先为参照，位置漂移。
    // fixed 直接相对视口，再把 (posX, posY) 比例换算成容器在视口里的真实像素，
    // 这样无论普通/宽屏/网页全屏/浏览器全屏，时钟都落在视频画面内。
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
}

function run() {
    var targetDiv = document.getElementsByClassName('bpx-player-container')[0];
    if (!targetDiv) {
        return;
    }
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
            // 显示相关开关（alwaysShow / fullscreenOnly）切换不会触发播放器属性变化，
            // 需要主动按当前状态重启/停止定时器，否则切换后要等下次控件动作才生效。
            if ('alwaysShow' in changes || 'fullscreenOnly' in changes) {
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
