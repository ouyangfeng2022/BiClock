// 与 popup.js 中的 DEFAULTS 保持一致；改一处要同步两处。
var DEFAULTS = {
    fontSize: 30,
    color: '#ffffff',
    backgroundColor: '#000000',
    bgOpacity: 100,
    bold: false,
    // 显示模式：false = 鼠标触发（默认，仅在控件可见时显示），
    // true = 常驻（进入浏览器全屏后一直显示，不随控件隐藏）。
    alwaysShow: false,
    // 位置由 popup 里的"位置"面板控制；posX/posY 是相对视口的 0..1 比例，
    // 这样不同分辨率的屏幕都能正确还原，而不是写死像素。
    posX: 0.5,
    posY: 0.04
};

var config = {};

var clock = document.createElement('div');
clock.className = 'bpx-player-top-clock';
clock.style.position = 'absolute';
// 用户无法在浏览器全屏里点击时钟（会退出全屏），所以位置改在 popup 面板里调整。
// 高 z-index 避免被 Bilibili 的控件层盖住。
clock.style.zIndex = '9999';
clock.style.userSelect = 'none';

var timer = null;

function pad(n) {
    return n.toString().padStart(2, '0');
}

// 固定 24 小时制 + 显示秒；不再可配置。
function formatTime(now) {
    return pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
}

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

function applyStyles() {
    clock.style.fontSize = config.fontSize + 'px';
    clock.style.color = config.color;
    clock.style.fontWeight = config.bold ? 'bold' : 'normal';
    clock.style.backgroundColor = hexToRgba(config.backgroundColor, config.bgOpacity / 100);
    // 常驻模式挂到 .bpx-player-container 上，该容器不一定建立定位上下文，
    // 改用 fixed 直接相对视口定位，避免位置受 Bilibili 容器的 position 影响。
    // 鼠标触发模式挂在顶栏里，沿用 absolute 让它跟随顶栏的布局。
    clock.style.position = config.alwaysShow ? 'fixed' : 'absolute';
    // 位置统一由 popup 的"位置"面板控制，没有单独的顶部偏移项。
    // 用 translate 把时钟中心点对到 (posX, posY) 比例处，
    // 比例换算成视口像素，适配任意分辨率。
    var x = (config.posX * window.innerWidth).toFixed(1);
    var y = (config.posY * window.innerHeight).toFixed(1);
    clock.style.left = x + 'px';
    clock.style.top = y + 'px';
    clock.style.transform = 'translate(-50%, -50%)';
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

// 是否显示时钟的统一判官。两种显示模式：
// - 鼠标触发（alwaysShow=false）：浏览器全屏 + 控件可见才显示。
//   控件自动隐藏后随即消失，避免遮挡画面。
// - 常驻（alwaysShow=true）：只要处于浏览器全屏就一直显示，
//   不再受控件可见性影响。
// 两种模式都要求 data-screen="full"——浏览器全屏才会隐藏其原生视频工具栏，
// 宽屏/网页全屏仍会被那些覆盖层挡住，故始终排除。
function shouldShow() {
    var targetDiv = document.getElementsByClassName('bpx-player-container')[0];
    if (!targetDiv) return false;
    if (targetDiv.getAttribute('data-screen') !== 'full') return false;
    if (config.alwaysShow) return true;
    return targetDiv.getAttribute('data-ctrl-hidden') === 'false';
}

function updateClock() {
    var container = document.getElementsByClassName('bpx-player-container')[0];
    if (!container) {
        return;
    }
    applyStyles();
    clock.textContent = formatTime(new Date());

    if (config.alwaysShow) {
        // 常驻模式挂到播放器根容器：Bilibili 在控件隐藏时会把整个顶栏
        // （.bpx-player-top，含标题及 .bpx-player-top-left 的兄弟节点）一起隐藏，
        // 挂在顶栏子树里的时钟会被连带带走，导致常驻模式视觉上失效。
        // 挂到根容器即可摆脱顶栏的显隐——根容器本身不会随 data-ctrl-hidden 隐藏。
        container.appendChild(clock);
    } else {
        // 鼠标触发模式维持挂在顶栏里，能跟着顶栏的渐隐一起淡出，过渡更自然。
        var topLeft = document.getElementsByClassName('bpx-player-top-left')[0];
        if (!topLeft) {
            return;
        }
        topLeft.parentNode.insertBefore(clock, topLeft.nextSibling);
    }
}

function run() {
    var targetDiv = document.getElementsByClassName('bpx-player-container')[0];
    if (!targetDiv) {
        return;
    }
    var observer = new MutationObserver(function (mutations) {
        // 任意属性变化后都用 shouldShow() 统一判断，避免漏掉 data-screen
        // 与 data-ctrl-hidden 之间谁先谁后的顺序问题。
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
        // popup 修改后实时生效：无需刷新页面
        chrome.storage.onChanged.addListener(function (changes, area) {
            if (area !== 'local') return;
            Object.keys(changes).forEach(function (key) {
                config[key] = changes[key].newValue;
            });
            // 显示模式切换不会触发播放器属性变化，需要主动按当前状态
            // 重启/停止定时器，否则切换 alwaysShow 后要等下次控件动作才生效。
            if ('alwaysShow' in changes) {
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
            }
        });
        run();
    });
}

document.readyState !== 'loading' ? init() : document.addEventListener('DOMContentLoaded', init);
