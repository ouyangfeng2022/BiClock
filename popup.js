// 与 biclock.js 中的 DEFAULTS 保持一致；改一处要同步两处。
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

function $(id) {
    return document.getElementById(id);
}

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

// hex (#rrggbb) + 0..1 alpha -> rgba()，背景色用
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

function applyToPreview() {
    var el = $('previewClock');
    el.style.fontSize = config.fontSize + 'px';
    el.style.color = config.color;
    el.style.fontWeight = config.bold ? 'bold' : 'normal';
    el.style.backgroundColor = hexToRgba(config.backgroundColor, config.bgOpacity / 100);
    el.style.top = config.topOffset + 'px';
    refreshPreviewText();
}

function refreshPreviewText() {
    $('previewClock').textContent = formatTime(new Date(), config.use24Hour, config.showSeconds);
}

function save() {
    chrome.storage.local.set(config);
}

// 把表单当前值读回 config
function readFromForm() {
    config.fontSize = parseInt($('fontSize').value, 10) || DEFAULTS.fontSize;
    config.color = $('color').value;
    config.backgroundColor = $('backgroundColor').value;
    config.bgOpacity = parseInt($('bgOpacity').value, 10);
    config.topOffset = parseInt($('topOffset').value, 10) || DEFAULTS.topOffset;
    config.bold = $('bold').checked;
    config.use24Hour = $('use24Hour').checked;
    config.showSeconds = $('showSeconds').checked;
}

function fillForm() {
    $('fontSize').value = config.fontSize;
    $('color').value = config.color;
    $('backgroundColor').value = config.backgroundColor;
    $('bgOpacity').value = config.bgOpacity;
    $('bgOpacityValue').textContent = config.bgOpacity + '%';
    $('topOffset').value = config.topOffset;
    $('bold').checked = config.bold;
    $('use24Hour').checked = config.use24Hour;
    $('showSeconds').checked = config.showSeconds;
}

function onInput() {
    readFromForm();
    $('bgOpacityValue').textContent = config.bgOpacity + '%';
    applyToPreview();
    save();
}

function init() {
    chrome.storage.local.get(DEFAULTS, function (stored) {
        config = stored;
        fillForm();
        applyToPreview();
    });

    var ids = ['fontSize', 'color', 'backgroundColor', 'bgOpacity', 'topOffset', 'bold', 'use24Hour', 'showSeconds'];
    ids.forEach(function (id) {
        $(id).addEventListener('input', onInput);
        $(id).addEventListener('change', onInput);
    });

    setInterval(refreshPreviewText, 1000);
}

document.readyState !== 'loading' ? init() : document.addEventListener('DOMContentLoaded', init);
