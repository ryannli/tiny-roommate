// Interaction handlers: petting, clicking, chat, drag swing physics

import { STATES } from './sprite.js';
import { getTimeSignals, getIdleSeconds, buildContextString } from './signals.js';
import { think } from './brain.js';

var PET_HOLD_MS = 500;
var SWING_DAMPING = 0.92;
var SWING_SPRING = 0.15;
var SWING_FACTOR = 0.12;
var SWING_MAX = 25;

export function initInteraction(pet) {
  var canvas = pet.canvas;
  var mouseDownPos = null;
  var mouseDownTime = 0;
  var isPetting = false;
  var petTimer = null;
  var clickCount = 0;
  var clickTimer = null;
  var chatInput = document.getElementById('chat-input');
  var petHand = document.getElementById('pet-hand');

  // --- Hand rotation ---
  var HANDS = ['/hands/hand_1.svg', '/hands/hand_2.svg', '/hands/hand_3.svg', '/hands/hand_4.svg'];

  function pickRandomHand() {
    var src = HANDS[Math.floor(Math.random() * HANDS.length)];
    petHand.src = src;
  }

  pickRandomHand();
  setInterval(pickRandomHand, 2 * 60 * 60 * 1000);

  // --- Drag swing physics ---
  var swingAngle = 0;
  var swingVelocity = 0;
  var lastDragPos = null;
  var dragAnimId = null;

  function startDragSwing() {
    lastDragPos = null;
    swingAngle = 0;
    swingVelocity = 0;

    function tick() {
      if (!pet.dragStarted) return;

      pet.appWindow.outerPosition().then(function(pos) {
        if (lastDragPos) {
          var dx = pos.x - lastDragPos.x;
          swingVelocity += dx * SWING_FACTOR;
        }
        lastDragPos = { x: pos.x, y: pos.y };

        swingVelocity -= swingAngle * SWING_SPRING;
        swingVelocity *= SWING_DAMPING;
        swingAngle += swingVelocity;
        swingAngle = Math.max(-SWING_MAX, Math.min(SWING_MAX, swingAngle));

        canvas.style.transform = 'rotate(' + swingAngle.toFixed(1) + 'deg)';
        canvas.style.transformOrigin = '50% 0%';
      }).catch(function() {});

      dragAnimId = requestAnimationFrame(tick);
    }
    dragAnimId = requestAnimationFrame(tick);
  }

  function stopDragSwing() {
    if (dragAnimId) {
      cancelAnimationFrame(dragAnimId);
      dragAnimId = null;
    }
    function settle() {
      swingVelocity -= swingAngle * SWING_SPRING;
      swingVelocity *= SWING_DAMPING;
      swingAngle += swingVelocity;

      if (Math.abs(swingAngle) < 0.3 && Math.abs(swingVelocity) < 0.3) {
        swingAngle = 0;
        canvas.style.transform = '';
        canvas.style.transformOrigin = '';
        return;
      }

      canvas.style.transform = 'rotate(' + swingAngle.toFixed(1) + 'deg)';
      requestAnimationFrame(settle);
    }
    settle();
  }

  // --- Mouse events ---
  canvas.addEventListener('mousedown', function(e) {
    if (e.button === 0) {
      mouseDownPos = { x: e.screenX, y: e.screenY };
      mouseDownTime = Date.now();
      pet.dragStarted = false;
      isPetting = false;
      petHand.style.left = (e.clientX - 32) + 'px';
      petHand.style.top = (e.clientY - 50) + 'px';
      petTimer = setTimeout(function() {
        isPetting = true;
        pet.sprite.setState('happy');
        canvas.style.cursor = 'none';
        petHand.classList.add('active');
        pet.showBubble(pet.voice().petHold, 3000, true);
      }, PET_HOLD_MS);
    }
  });

  canvas.addEventListener('mousemove', function(e) {
    if (!mouseDownPos || pet.dragStarted || isPetting) return;
    var dx = e.screenX - mouseDownPos.x;
    var dy = e.screenY - mouseDownPos.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      clearTimeout(petTimer);
      pet.dragStarted = true;
      pet.sprite.setState('drag');
      pet.appWindow.startDragging().catch(function() {});
      startDragSwing();
    }
  });

  canvas.addEventListener('mouseup', function() {
    clearTimeout(petTimer);

    if (pet.dragStarted) {
      pet.sprite.setState('idle');
      stopDragSwing();
    } else if (isPetting) {
      onPetted();
    } else if (mouseDownPos) {
      var holdDuration = Date.now() - mouseDownTime;
      if (holdDuration < PET_HOLD_MS) {
        clickCount++;
        if (clickCount === 1) {
          clickTimer = setTimeout(function() {
            clickCount = 0;
            onPetClicked();
          }, 300);
        } else if (clickCount === 2) {
          clearTimeout(clickTimer);
          clickCount = 0;
          openChat();
        }
      }
    }

    mouseDownPos = null;
    pet.dragStarted = false;
    isPetting = false;
    canvas.style.cursor = '';
    petHand.classList.remove('active');
  });

  // --- Petting ---
  async function onPetted() {
    pet.gainHeart();
    pet.sprite.setState('happy', function() { pet.sprite.setState('idle'); });
    if (pet.llmBusy) {
      var pl = pet.voice().petLines;
      pet.showBubble(pl[Math.floor(Math.random() * pl.length)], 3000, true);
      return;
    }
    pet.llmBusy = true;
    var result = await think('Your owner is petting and rubbing you gently. You feel warm and loved. React.');
    if (result) {
      pet.showBubble(result.text, Math.max(8000, result.text.length * 300), true, result.reactions);
    } else {
      pet.showBubble(pet.voice().petFallback, 2000, true);
    }
    pet.llmBusy = false;
    pet.lastInteractionTime = Date.now();
  }

  // --- Single click ---
  async function onPetClicked() {
    // Stop walking if in motion
    if (pet.isWalking) {
      pet.isWalking = false;
      pet.canvas.style.transform = 'scaleX(1)';
      pet.sprite.setState('idle');
      return;
    }
    pet.gainHeart();
    pet.sprite.setState('talk', function() { pet.sprite.setState('idle'); });
    if (pet.llmBusy) {
      var tl = pet.voice().tapLines;
      pet.showBubble(tl[Math.floor(Math.random() * tl.length)], 2000, true);
      return;
    }
    pet.llmBusy = true;
    var timeSignals = getTimeSignals();
    var context = buildContextString(timeSignals, getIdleSeconds(), pet.lastScreenContext);
    var result = await think("Your owner tapped you to get your attention. React briefly.\n\nEnvironment:\n" + context);
    if (result) {
      pet.showBubble(result.text, Math.max(8000, result.text.length * 300), true, result.reactions);
      if (result.state && STATES[result.state]) {
        pet.sprite.setState(result.state, STATES[result.state].loop ? null : function() { pet.sprite.setState('idle'); });
      }
    } else {
      pet.showBubble(pet.voice().tapFallback, 2000, true);
    }
    pet.llmBusy = false;
    pet.lastInteractionTime = Date.now();
  }

  // --- Double click: chat ---
  function openChat() {
    chatInput.classList.add('show');
    chatInput.focus();
    pet.sprite.setState('talk');
    pet.showBubble('?');
  }

  pet.openChat = openChat;

  chatInput.addEventListener('keydown', async function(e) {
    if (e.key === 'Enter') {
      var text = chatInput.value.trim();
      chatInput.value = '';
      chatInput.classList.remove('show');
      if (!text) { pet.sprite.setState('idle'); return; }
      pet.gainHeart();

      pet.llmBusy = true;
      pet.sprite.setState('talk');
      var thinkingLines = ['🤔 hmm...', '🤔 let me think...', '🤔 umm...', '💭 hmm...', '💭 ...'];
      pet.showBubble(thinkingLines[Math.floor(Math.random() * thinkingLines.length)], 30000);

      var timeSignals = getTimeSignals();
      var context = buildContextString(timeSignals, getIdleSeconds(), pet.lastScreenContext);
      var result = await think('Your owner said to you: "' + text + '"\n\nEnvironment:\n' + context + '\n\nRespond naturally.');

      if (result) {
        // Chat replies stay longer — user is actively reading
        var replyDuration = Math.max(10000, result.text.length * 300);
        pet.showBubble(result.text, replyDuration, true, result.reactions, { quote: text });
        if (result.state && STATES[result.state]) {
          pet.sprite.setState(result.state, STATES[result.state].loop ? null : function() { pet.sprite.setState('idle'); });
        } else {
          pet.sprite.setState('idle');
        }
      } else {
        pet.showBubble(pet.voice().chatFallback, 2000, true);
        pet.sprite.setState('idle');
      }
      pet.llmBusy = false;
      pet.lastInteractionTime = Date.now();
    }

    if (e.key === 'Escape') {
      chatInput.value = '';
      chatInput.classList.remove('show');
      pet.sprite.setState('idle');
    }
  });

  chatInput.addEventListener('blur', function() {
    setTimeout(function() {
      chatInput.classList.remove('show');
      if (pet.sprite) pet.sprite.setState('idle');
    }, 200);
  });
}
