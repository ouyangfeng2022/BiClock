// 与 popup.js 中的 DEFAULTS 保持一致；改一处要同步两处。
var DEFAULTS = {
    fontSize: 30,
    color: '#ffffff',
    backgroundColor: '#000000',
    bgOpacity: 100,
    topOffset: 10,
    bold: false,
    use24Hour: true,
    showSeconds: true
};

var config = {};

var clock = document.createElement('div');
clock.className = 'bpx-player-top-clock';
clock.style.position = 'absolute';
clock.style.left = '50%';
clock.style.transform = 'translateX(-50%)';

var timer = null;

function pad(n) {
    return n.toString().padStart(2, '0');
}

function formatTime(now, use24Hour, showSeconds) {
    var h = now.getHours();
    var suffix = '';
    if (!use24Hour) {
        suffix = h >= 12 ? ' PM' : ' AM';
        h = h % 12;
        if (h === 0) h = 12;
    }
    var base = pad(h) + ':' + pad(now.getMinutes());
    if (showSeconds) base += ':' + pad(now.getSeconds());
    return base + suffix;
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
    clock.style.top = config.topOffset + 'px';
    clock.style.backgroundColor = hexToRgba(config.backgroundColor, config.bgOpacity / 100);
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

// 仅在浏览器全屏（Bilibili 的 data-screen="full"）且控件可见时显示。
// 浏览器全屏才会隐藏其原生视频工具栏，宽屏/网页全屏仍然会浮在视频上方。
function shouldShow() {
    var targetDiv = document.getElementsByClassName('bpx-player-container')[0];
    if (!targetDiv) return false;
    return targetDiv.getAttribute('data-screen') === 'full'
        && targetDiv.getAttribute('data-ctrl-hidden') === 'false';
}

function updateClock() {
    var topLeft = document.getElementsByClassName("bpx-player-top-left")[0];
    if (!topLeft) {
        return;
    }
    applyStyles();
    clock.textContent = formatTime(new Date(), config.use24Hour, config.showSeconds);
    topLeft.parentNode.insertBefore(clock, topLeft.nextSibling);
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
        });
        run();
    });
}

document.readyState !== 'loading' ? init() : document.addEventListener('DOMContentLoaded', init);
