var clock = document.createElement('div');
clock.className = 'bpx-player-top-clock';
clock.style.position = 'absolute';
clock.style.left = '50%';
clock.style.transform = 'translateX(-50%)';
clock.style.top = '10px';
clock.style.fontSize = '30px';
clock.style.color = 'white';
clock.style.backgroundColor = 'rgb(0, 0, 0)';

var timer = null;
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
}

function updateClock() {
    var topLeft = document.getElementsByClassName("bpx-player-top-left")[0];
    if (!topLeft) {
        return;
    }
    var now = new Date();
    var hours = now.getHours();
    var minutes = now.getMinutes();
    var seconds = now.getSeconds();
    hours = hours.toString().padStart(2, '0');
    minutes = minutes.toString().padStart(2, '0');
    seconds = seconds.toString().padStart(2, '0');
    clock.textContent = hours + ':' + minutes + ':' + seconds;
    topLeft.parentNode.insertBefore(clock, topLeft.nextSibling);
}

function run() {
    var targetDiv = document.getElementsByClassName('bpx-player-container')[0];
    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.attributeName === 'data-ctrl-hidden') {
                var ctrlHidden = targetDiv.getAttribute('data-ctrl-hidden');
                if (ctrlHidden === "false") {
                    startTimer();
                } else {
                    stopTimer();
                }
            }
        });
    });
    var config = { attributes: true };
    observer.observe(targetDiv, config);
}

document.readyState !== 'loading' ? run() : document.addEventListener('DOMContentLoaded', run);
