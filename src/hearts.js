// Hearts / affection system

import { getConfig } from './brain.js';

export function initHearts(pet) {
  var MAX_HEARTS = 5;
  var heartsValue = MAX_HEARTS;
  var _isSick = false;
  var HEART_DECAY_RATE = 1 / (30 * 60); // lose 1 heart per 30 min
  var lastDecayTick = Date.now();
  var heartsEl = document.getElementById('hearts');

  function renderHearts() {
    var html = '';
    for (var i = 0; i < MAX_HEARTS; i++) {
      var fill = Math.max(0, Math.min(1, heartsValue - i));
      var fillPx = Math.round(fill * 18);
      html += '<span class="heart-wrap">' +
        '<span class="heart-bg">❤️</span>' +
        '<span class="heart-fill" style="width:' + fillPx + 'px;">❤️</span>' +
        '</span>';
    }
    heartsEl.innerHTML = html;

    var wasSick = _isSick;
    _isSick = heartsValue <= 0;
    if (_isSick && !wasSick) {
      pet.sprite.setState('sleep');
      pet.showBubble('...i don\'t feel so good', 6000, true);
    }
    if (!_isSick && wasSick) {
      pet.sprite.setState('happy', function() { pet.sprite.setState('idle'); });
      pet.showBubble('you came back! 💛', 4000, true);
    }
  }

  function gainHeart() {
    heartsValue = Math.min(MAX_HEARTS, heartsValue + 0.5);
    lastDecayTick = Date.now();
    renderHearts();
  }

  // Smooth decay every 10 seconds
  setInterval(function() {
    var now = Date.now();
    var elapsed = (now - lastDecayTick) / 1000;
    if (elapsed > 60 && heartsValue > 0) {
      heartsValue = Math.max(0, heartsValue - HEART_DECAY_RATE * 10);
      renderHearts();
    }
  }, 10 * 1000);

  renderHearts();

  // Together counter
  var togetherEl = document.getElementById('together');

  function updateTogether() {
    var bornStr = getConfig().pet.born;
    if (!bornStr) { togetherEl.textContent = ''; return; }
    var born = String(bornStr).includes('T') ? new Date(bornStr) : new Date(bornStr + 'T00:00:00');
    var now = new Date();
    var diffMs = now - born;
    var diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= 1) {
      togetherEl.textContent = '🤝 ' + diffDays + ' day' + (diffDays > 1 ? 's' : '') + ' together';
    } else if (diffHours >= 1) {
      togetherEl.textContent = '🤝 ' + diffHours + 'h together';
    } else {
      togetherEl.textContent = '🤝 just met!';
    }
  }

  updateTogether();
  setInterval(updateTogether, 60 * 1000);

  return {
    gainHeart: gainHeart,
    get isSick() { return _isSick; },
    updateTogether: updateTogether,
  };
}
