// 与 popup.js 中的 DEFAULTS 保持一致；改一处要同步两处。
var DEFAULTS = {
    fontSize: 30,
    color: '#ffffff',
    // 默认背景即 B 站粉品牌色，与时钟叠在 B 站播放器上的语境一致。
    backgroundColor: '#fb7299',
    bgOpacity: 100,
    bold: true,
    // 主题字段由 popup 的主题卡写入；内容脚本只消费最终样式值。
    clockStyle: 'bili-pink',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Microsoft YaHei", sans-serif',
    textShadow: 'none',
    borderColor: '#ffffff',
    borderOpacity: 0,
    borderWidth: 0,
    accentColor: '#fb7299',
    clockLayout: 'single',
    // 仅全屏显示：true = 只在浏览器全屏下显示（默认，避开 B 站/浏览器
    // 原生视频浮窗被挡住的场景）；false = 任何播放器屏幕模式下都显示。
    fullscreenOnly: true,
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

function makeClockPart(className, text) {
    var part = document.createElement('span');
    part.className = className;
    part.textContent = text;
    return part;
}

// 形态主题会重组时钟节点，而不只是调整颜色。所有子节点在每秒更新时
// 被复用为同一父节点的最新内容，始终保持页面中只有一个时钟节点。
function renderClockLayout(time) {
    var parts = time.split(':');
    clock.replaceChildren();
    clock.style.display = 'inline-flex';
    clock.style.alignItems = 'center';
    clock.style.justifyContent = 'center';
    clock.style.lineHeight = '1.2';
    // 每次重绘先清掉形态主题留下的布局状态，主题之间切换不会串样式。
    clock.style.flexDirection = 'row';
    clock.style.overflow = 'visible';
    clock.style.backgroundImage = 'none';
    clock.style.gap = '0';

    if (config.clockLayout === 'segments') {
        clock.style.gap = '3px';
        clock.style.padding = '0';
        clock.style.backgroundColor = 'transparent';
        clock.style.border = '0';
        parts.forEach(function (partText) {
            var part = makeClockPart('bpx-player-clock-segment', partText);
            part.style.padding = '0.12em 0.24em';
            part.style.borderRadius = '0.22em';
            part.style.backgroundColor = hexToRgba(config.backgroundColor, config.bgOpacity / 100);
            part.style.border = config.borderWidth + 'px solid ' + hexToRgba(config.borderColor, config.borderOpacity / 100);
            clock.appendChild(part);
        });
        return;
    }

    if (config.clockLayout === 'recording') {
        clock.style.gap = '0.38em';
        var dot = makeClockPart('bpx-player-clock-rec-dot', '');
        dot.style.width = '0.44em';
        dot.style.height = '0.44em';
        dot.style.borderRadius = '50%';
        dot.style.backgroundColor = config.accentColor;
        dot.style.boxShadow = '0 0 0.34em ' + hexToRgba(config.accentColor, 0.68);
        var rec = makeClockPart('bpx-player-clock-rec-label', 'REC');
        rec.style.color = config.accentColor;
        rec.style.fontSize = '0.52em';
        rec.style.letterSpacing = '0.08em';
        clock.appendChild(dot);
        clock.appendChild(rec);
        clock.appendChild(makeClockPart('bpx-player-clock-rec-time', time));
        return;
    }

    if (config.clockLayout === 'corner') {
        clock.style.gap = '0.22em';
        clock.style.padding = '0';
        clock.style.backgroundColor = 'transparent';
        clock.style.border = '0';
        var left = makeClockPart('bpx-player-clock-corner-left', '');
        var right = makeClockPart('bpx-player-clock-corner-right', '');
        [left, right].forEach(function (corner) {
            corner.style.width = '0.38em';
            corner.style.height = '1em';
            corner.style.borderColor = config.accentColor;
            corner.style.borderStyle = 'solid';
            corner.style.borderWidth = '0.1em';
        });
        left.style.borderRightWidth = '0';
        right.style.borderLeftWidth = '0';
        clock.appendChild(left);
        clock.appendChild(makeClockPart('bpx-player-clock-corner-time', time));
        clock.appendChild(right);
        return;
    }

    if (config.clockLayout === 'analog') {
        clock.style.padding = '0';
        clock.style.backgroundColor = 'transparent';
        clock.style.border = '0';
        var now = new Date();
        var dial = makeClockPart('bpx-player-clock-analog-dial', '');
        dial.style.position = 'relative';
        dial.style.width = '2.15em';
        dial.style.height = '2.15em';
        dial.style.borderRadius = '50%';
        dial.style.backgroundColor = hexToRgba(config.backgroundColor, config.bgOpacity / 100);
        dial.style.border = config.borderWidth + 'px solid ' + hexToRgba(config.borderColor, config.borderOpacity / 100);
        dial.style.boxShadow = '0 0.12em 0.28em rgba(0, 0, 0, 0.22)';
        for (var tickIndex = 0; tickIndex < 12; tickIndex++) {
            var tick = makeClockPart('bpx-player-clock-analog-tick', '');
            var isMajor = tickIndex % 3 === 0;
            tick.style.position = 'absolute'; tick.style.left = '50%'; tick.style.top = '0.18em';
            tick.style.width = isMajor ? '0.065em' : '0.04em'; tick.style.height = isMajor ? '0.2em' : '0.12em';
            tick.style.borderRadius = '999px'; tick.style.backgroundColor = isMajor ? config.borderColor : hexToRgba(config.color, 0.42);
            tick.style.transformOrigin = '50% 0.91em';
            tick.style.transform = 'translateX(-50%) rotate(' + (tickIndex * 30) + 'deg)';
            dial.appendChild(tick);
        }
        ['12', '3', '6', '9'].forEach(function (label, index) {
            var marker = makeClockPart('bpx-player-clock-analog-marker', label);
            marker.style.position = 'absolute'; marker.style.fontSize = '0.2em'; marker.style.fontWeight = '700'; marker.style.color = config.color; marker.style.lineHeight = '1';
            marker.style.left = index === 1 ? '84%' : index === 3 ? '10%' : '50%';
            marker.style.top = index === 0 ? '11%' : index === 2 ? '86%' : '50%';
            marker.style.transform = 'translate(-50%, -50%)'; dial.appendChild(marker);
        });
        [{ angle: (now.getHours() % 12) * 30 + now.getMinutes() * 0.5, width: '0.12em', height: '0.5em', color: config.color }, { angle: now.getMinutes() * 6, width: '0.075em', height: '0.72em', color: config.borderColor }, { angle: now.getSeconds() * 6, width: '0.032em', height: '0.86em', color: config.accentColor }].forEach(function (hand, handIndex) {
            var item = makeClockPart('bpx-player-clock-analog-hand', '');
            item.style.position = 'absolute'; item.style.left = '50%'; item.style.top = '50%';
            item.style.width = hand.width; item.style.height = hand.height; item.style.borderRadius = '999px';
            item.style.backgroundColor = hand.color; item.style.boxShadow = handIndex === 2 ? 'none' : '0 0.03em 0.06em rgba(0, 0, 0, 0.28)'; item.style.transformOrigin = '50% 0';
            // 指针从圆心向下延伸；标准钟表角度以 12 点为 0°，故补 180° 对齐。
            item.style.transform = 'translateX(-50%) rotate(' + (hand.angle + 180) + 'deg)'; dial.appendChild(item);
        });
        var pin = makeClockPart('bpx-player-clock-analog-pin', '');
        pin.style.position = 'absolute'; pin.style.left = '50%'; pin.style.top = '50%';
        pin.style.width = '0.16em'; pin.style.height = '0.16em'; pin.style.borderRadius = '50%';
        pin.style.transform = 'translate(-50%, -50%)'; pin.style.backgroundColor = config.accentColor;
        pin.style.border = '0.06em solid ' + config.backgroundColor;
        pin.style.boxShadow = 'none';
        dial.appendChild(pin); clock.appendChild(dial);
        return;
    }

    if (config.clockLayout === 'flip') {
        clock.style.gap = '0.12em'; clock.style.padding = '0'; clock.style.backgroundColor = 'transparent'; clock.style.border = '0';
        parts.forEach(function (partText) {
            var card = makeClockPart('bpx-player-clock-flip-card', partText);
            card.style.padding = '0.13em 0.2em'; card.style.borderRadius = '0.11em';
            card.style.backgroundImage = 'linear-gradient(to bottom, ' + hexToRgba(config.backgroundColor, config.bgOpacity / 100) + ' 48%, #020617 49%, #020617 52%, ' + hexToRgba(config.backgroundColor, config.bgOpacity / 100) + ' 53%)';
            card.style.border = config.borderWidth + 'px solid ' + hexToRgba(config.borderColor, config.borderOpacity / 100);
            card.style.boxShadow = '0 0.08em 0.12em rgba(0, 0, 0, 0.35)'; clock.appendChild(card);
        });
        return;
    }

    if (config.clockLayout === 'hud') {
        clock.style.gap = '0.26em'; clock.style.padding = '0.16em 0.28em'; clock.style.borderRadius = '0';
        var tag = makeClockPart('bpx-player-clock-hud-tag', 'TIME');
        tag.style.fontSize = '0.42em'; tag.style.letterSpacing = '0.12em'; tag.style.color = config.accentColor;
        clock.appendChild(tag); clock.appendChild(makeClockPart('bpx-player-clock-hud-time', time));
        return;
    }

    if (config.clockLayout === 'calendar') {
        var date = new Date();
        clock.style.flexDirection = 'column'; clock.style.gap = '0'; clock.style.padding = '0'; clock.style.overflow = 'hidden';
        var header = makeClockPart('bpx-player-clock-calendar-header', (date.getMonth() + 1) + ' 月 ' + date.getDate() + ' 日');
        header.style.width = '100%'; header.style.padding = '0.14em 0.55em'; header.style.boxSizing = 'border-box';
        header.style.textAlign = 'center'; header.style.fontSize = '0.42em'; header.style.letterSpacing = '0.08em';
        header.style.backgroundColor = config.accentColor; header.style.color = '#ffffff';
        var value = makeClockPart('bpx-player-clock-calendar-time', time);
        value.style.padding = '0.12em 0.48em 0.16em'; value.style.fontVariantNumeric = 'tabular-nums';
        clock.appendChild(header); clock.appendChild(value);
        return;
    }

    if (config.clockLayout === 'capsule') {
        clock.style.borderRadius = '999px';
    }
    clock.appendChild(makeClockPart('bpx-player-clock-single-time', time));
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

// 已移除的主题若仍有旧存储值，立即回退到默认 Bilibili 粉，
// 避免在没有打开 popup 的情况下继续显示已下线的主题。
function migrateRemovedTheme() {
    if (['minimal', 'glass', 'neon', 'retro', 'corner'].indexOf(config.clockStyle) === -1) return;
    config.clockStyle = DEFAULTS.clockStyle;
    config.fontSize = DEFAULTS.fontSize;
    config.color = DEFAULTS.color;
    config.backgroundColor = DEFAULTS.backgroundColor;
    config.bgOpacity = DEFAULTS.bgOpacity;
    config.bold = DEFAULTS.bold;
    config.fontFamily = DEFAULTS.fontFamily;
    config.textShadow = DEFAULTS.textShadow;
    config.borderColor = DEFAULTS.borderColor;
    config.borderOpacity = DEFAULTS.borderOpacity;
    config.borderWidth = DEFAULTS.borderWidth;
    config.accentColor = DEFAULTS.accentColor;
    config.clockLayout = DEFAULTS.clockLayout;
    chrome.storage.local.set({
        clockStyle: config.clockStyle,
        fontSize: config.fontSize,
        color: config.color,
        backgroundColor: config.backgroundColor,
        bgOpacity: config.bgOpacity,
        bold: config.bold,
        fontFamily: config.fontFamily,
        textShadow: config.textShadow,
        borderColor: config.borderColor,
        borderOpacity: config.borderOpacity,
        borderWidth: config.borderWidth,
        accentColor: config.accentColor,
        clockLayout: config.clockLayout
    });
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
    renderClockLayout(formatTime(new Date()));

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
        migrateRemovedTheme();
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
                renderClockLayout(formatTime(new Date()));
            }
        });
        run();
    });
}

document.readyState !== 'loading' ? init() : document.addEventListener('DOMContentLoaded', init);
