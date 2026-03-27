// Chat bubble display + positioning logic (main window side)

import { emitTo, listen as listenEvent } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

var BUBBLE_MARGIN = 12;
var BUBBLE_GAP = 12;
var BUBBLE_ARROW_HALF = 5;
var BUBBLE_MAX_WIDTH = 280;
var BUBBLE_WINDOW_PAD = 8;

export function initBubble(pet) {
  var bubbleEl = document.getElementById('bubble');
  var bubbleTextEl = document.getElementById('bubble-text');
  var bubbleArrowEl = document.getElementById('bubble-arrow');
  var bubbleTimeout = null;
  var bubbleWindowRef = null;
  var bubbleWindowReadyPromise = null;
  var activeBubbleOverlay = null;
  var latestBubbleSessionId = null;
  var bubbleMeasureResolvers = Object.create(null);
  var bubbleSessionCounter = 0;

  // Notification sound
  var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  function playNotifSound() {
    try {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.08);
      osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.type = 'sine';
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {}
  }

  function onReaction(text) {
    pet.sprite.setState('happy', function() { pet.sprite.setState('idle'); });
    var acks = pet.voice().acks;
    showBubble(acks[Math.floor(Math.random() * acks.length)], 1500, true);
    pet.lastInteractionTime = Date.now();
    pet.gainHeart();
  }

  function onReply() {
    if (pet.openChat) pet.openChat();
  }

  // Inline reply button
  var replyBtn = document.getElementById('bubble-reply');
  if (replyBtn) {
    replyBtn.addEventListener('click', function() {
      bubbleEl.classList.remove('show');
      onReply();
    });
  }

  function clamp(value, min, max) {
    if (max < min) return min;
    return Math.max(min, Math.min(max, value));
  }

  function scoreBubblePlacement(candidate, bubbleWidth, bubbleHeight, winW, winH) {
    var left = candidate.left;
    var top = candidate.top;
    return (
      (candidate.bias || 0) +
      Math.max(0, BUBBLE_MARGIN - left) +
      Math.max(0, BUBBLE_MARGIN - top) +
      Math.max(0, left + bubbleWidth - (winW - BUBBLE_MARGIN)) +
      Math.max(0, top + bubbleHeight - (winH - BUBBLE_MARGIN))
    );
  }

  function applyBubblePlacement(candidate, bubbleWidth, bubbleHeight) {
    var winW = window.innerWidth;
    var winH = window.innerHeight;
    var left = clamp(candidate.left, BUBBLE_MARGIN, winW - bubbleWidth - BUBBLE_MARGIN);
    var top = clamp(candidate.top, BUBBLE_MARGIN, winH - bubbleHeight - BUBBLE_MARGIN);

    bubbleEl.style.left = Math.round(left) + 'px';
    bubbleEl.style.top = Math.round(top) + 'px';
    bubbleEl.style.right = '';
    bubbleEl.style.bottom = '';
    bubbleEl.style.transform = 'none';

    bubbleArrowEl.style.top = '';
    bubbleArrowEl.style.left = '';
    bubbleArrowEl.style.right = '';
    bubbleArrowEl.style.bottom = '';

    if (candidate.arrowSide === 'bottom') {
      var arrowX = clamp(candidate.targetX - left, 16, bubbleWidth - 16);
      bubbleArrowEl.style.bottom = '-5px';
      bubbleArrowEl.style.left = Math.round(arrowX - BUBBLE_ARROW_HALF) + 'px';
      bubbleArrowEl.style.transform = 'rotate(45deg)';
    } else if (candidate.arrowSide === 'left') {
      var arrowLeftY = clamp(candidate.targetY - top, 16, bubbleHeight - 16);
      bubbleArrowEl.style.top = Math.round(arrowLeftY - BUBBLE_ARROW_HALF) + 'px';
      bubbleArrowEl.style.left = '-5px';
      bubbleArrowEl.style.transform = 'rotate(45deg)';
    } else {
      var arrowRightY = clamp(candidate.targetY - top, 16, bubbleHeight - 16);
      bubbleArrowEl.style.top = Math.round(arrowRightY - BUBBLE_ARROW_HALF) + 'px';
      bubbleArrowEl.style.right = '-5px';
      bubbleArrowEl.style.transform = 'rotate(45deg)';
    }
  }

  async function ensureBubbleWindow() {
    if (bubbleWindowRef) {
      if (bubbleWindowReadyPromise) {
        await bubbleWindowReadyPromise;
      }
      return bubbleWindowRef;
    }

    var existing = await WebviewWindow.getByLabel('bubble');
    if (existing) {
      bubbleWindowRef = existing;
      return bubbleWindowRef;
    }

    var bubbleUrl = new URL('./bubble.html', window.location.href).toString();
    var resolveReady;
    var rejectReady;
    var timeout = null;
    bubbleWindowReadyPromise = new Promise(function(resolve, reject) {
      resolveReady = resolve;
      rejectReady = reject;
    });
    var unlisten = await listenEvent('bubble:ready', function(event) {
      if (!event.payload || event.payload.label !== 'bubble') return;
      clearTimeout(timeout);
      unlisten();
      resolveReady();
    });
    timeout = setTimeout(function() {
      unlisten();
      rejectReady(new Error('Bubble window ready timeout'));
    }, 1500);

    bubbleWindowRef = new WebviewWindow('bubble', {
      url: bubbleUrl,
      title: '',
      width: 40,
      height: 40,
      x: 0,
      y: 0,
      visible: false,
      focus: false,
      focusable: true,
      transparent: true,
      decorations: false,
      alwaysOnTop: true,
      shadow: false,
      skipTaskbar: true,
      resizable: false,
    });

    try {
      await bubbleWindowReadyPromise;
    } catch (err) {
      bubbleWindowRef = null;
      bubbleWindowReadyPromise = null;
      throw err;
    }
    return bubbleWindowRef;
  }

  function pickOverlayPlacement(globalRect, bubbleWidth, bubbleHeight) {
    var screenW = window.screen.availWidth;
    var screenH = window.screen.availHeight;
    var cx = globalRect.left + globalRect.width / 2;
    var anchorY = globalRect.top + globalRect.height * 0.28;
    var jx = Math.round((Math.random() - 0.5) * 24);
    var jy = Math.round((Math.random() - 0.5) * 14);

    var candidates = [
      {
        name: 'right',
        left: globalRect.right + BUBBLE_GAP + jx,
        top: anchorY - bubbleHeight * 0.32 + jy,
        targetX: globalRect.right,
        targetY: anchorY,
        arrowSide: 'left',
        bias: 0,
      },
      {
        name: 'left',
        left: globalRect.left - bubbleWidth - BUBBLE_GAP + jx,
        top: anchorY - bubbleHeight * 0.32 + jy,
        targetX: globalRect.left,
        targetY: anchorY,
        arrowSide: 'right',
        bias: 0,
      },
      {
        name: 'top',
        left: cx - bubbleWidth / 2 + jx,
        top: globalRect.top - bubbleHeight - BUBBLE_GAP + jy,
        targetX: cx,
        targetY: globalRect.top,
        arrowSide: 'bottom',
        bias: 6,
      },
      {
        name: 'top-right',
        left: globalRect.right - 36 + jx,
        top: globalRect.top - bubbleHeight - BUBBLE_GAP + jy,
        targetX: globalRect.right - globalRect.width * 0.24,
        targetY: globalRect.top,
        arrowSide: 'bottom',
        bias: 4,
      },
      {
        name: 'top-left',
        left: globalRect.left - bubbleWidth + 36 + jx,
        top: globalRect.top - bubbleHeight - BUBBLE_GAP + jy,
        targetX: globalRect.left + globalRect.width * 0.24,
        targetY: globalRect.top,
        arrowSide: 'bottom',
        bias: 4,
      }
    ];

    candidates.sort(function(a, b) {
      return scoreBubblePlacement(a, bubbleWidth, bubbleHeight, screenW, screenH) -
        scoreBubblePlacement(b, bubbleWidth, bubbleHeight, screenW, screenH);
    });

    var bestScore = scoreBubblePlacement(candidates[0], bubbleWidth, bubbleHeight, screenW, screenH);
    var viable = candidates.filter(function(candidate) {
      return scoreBubblePlacement(candidate, bubbleWidth, bubbleHeight, screenW, screenH) <= bestScore + 6;
    });
    return viable[Math.floor(Math.random() * viable.length)];
  }

  async function positionBubbleOverlay(state) {
    await ensureBubbleWindow();

    var rect = pet.canvas.getBoundingClientRect();
    var scale = window.devicePixelRatio || 1;
    var pos = await pet.appWindow.outerPosition();
    var globalRect = {
      left: pos.x / scale + rect.left,
      top: pos.y / scale + rect.top,
      right: pos.x / scale + rect.right,
      bottom: pos.y / scale + rect.bottom,
      width: rect.width,
      height: rect.height,
    };

    var placement = pickOverlayPlacement(globalRect, state.bubbleWidth, state.bubbleHeight);
    var bubbleLeft = clamp(placement.left, BUBBLE_MARGIN, window.screen.availWidth - state.bubbleWidth - BUBBLE_MARGIN);
    var bubbleTop = clamp(placement.top, BUBBLE_MARGIN, window.screen.availHeight - state.bubbleHeight - BUBBLE_MARGIN);
    var windowLeft = bubbleLeft - BUBBLE_WINDOW_PAD;
    var windowTop = bubbleTop - BUBBLE_WINDOW_PAD;
    var arrowOffset = placement.arrowSide === 'bottom'
      ? clamp(placement.targetX - bubbleLeft, 16, state.bubbleWidth - 16)
      : clamp(placement.targetY - bubbleTop, 16, state.bubbleHeight - 16);

    await emitTo('bubble', 'bubble:display', {
      id: state.id,
      text: state.text,
      reactions: state.reactions,
      duration: state.duration,
      maxWidth: BUBBLE_MAX_WIDTH,
      arrowSide: placement.arrowSide,
      arrowOffset: Math.round(arrowOffset),
      x: Math.round(windowLeft * scale),
      y: Math.round(windowTop * scale),
      windowWidth: Math.round(state.windowWidth * scale),
      windowHeight: Math.round(state.windowHeight * scale),
    });
  }

  async function showBubbleOverlay(text, duration, reactions, quote) {
    var id = 'bubble-' + (++bubbleSessionCounter);
    latestBubbleSessionId = id;
    await ensureBubbleWindow();

    var measured = new Promise(function(resolve, reject) {
      bubbleMeasureResolvers[id] = { resolve: resolve, reject: reject };
      setTimeout(function() {
        if (bubbleMeasureResolvers[id]) {
          delete bubbleMeasureResolvers[id];
          reject(new Error('Bubble measurement timeout'));
        }
      }, 1500);
    });

    await emitTo('bubble', 'bubble:prepare', {
      id: id,
      text: text,
      quote: quote || '',
      reactions: reactions,
      maxWidth: BUBBLE_MAX_WIDTH,
    });

    var metrics = await measured;
    if (latestBubbleSessionId !== id) return;

    activeBubbleOverlay = {
      id: id,
      text: text,
      duration: duration,
      reactions: reactions,
      bubbleWidth: metrics.bubbleWidth,
      bubbleHeight: metrics.bubbleHeight,
      windowWidth: metrics.windowWidth,
      windowHeight: metrics.windowHeight,
    };

    await positionBubbleOverlay(activeBubbleOverlay);
  }

  function showBubbleInline(text, duration, sound, reactions, quote) {
    duration = duration || 4000;
    reactions = reactions || [];

    // Render quote + text
    bubbleTextEl.innerHTML = '';
    if (quote) {
      var quoteEl = document.createElement('div');
      quoteEl.className = 'bubble-quote';
      quoteEl.textContent = quote;
      bubbleTextEl.appendChild(quoteEl);
    }
    bubbleTextEl.appendChild(document.createTextNode(text));

    // Reaction buttons
    var reactionsEl = document.getElementById('bubble-reactions');
    reactionsEl.innerHTML = '';
    if (reactions.length > 0) {
      duration = 15000;
      reactions.forEach(function(r) {
        var btn = document.createElement('button');
        btn.textContent = r;
        btn.onclick = function() { bubbleEl.classList.remove('show'); onReaction(r); };
        reactionsEl.appendChild(btn);
      });
    }

    var rect = pet.canvas.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var anchorY = rect.top + rect.height * 0.28;

    // Small random jitter so it doesn't feel mechanical
    var jx = Math.round((Math.random() - 0.5) * 16);
    var jy = Math.round((Math.random() - 0.5) * 10);
    bubbleEl.style.visibility = 'hidden';
    bubbleEl.style.left = BUBBLE_MARGIN + 'px';
    bubbleEl.style.top = BUBBLE_MARGIN + 'px';
    bubbleEl.style.transform = 'none';
    bubbleEl.classList.add('show');

    var bubbleWidth = Math.ceil(bubbleEl.offsetWidth);
    var bubbleHeight = Math.ceil(bubbleEl.offsetHeight);
    var winW = window.innerWidth;
    var winH = window.innerHeight;

    var candidates = [
      {
        name: 'top',
        left: cx - bubbleWidth / 2 + jx,
        top: rect.top - bubbleHeight - BUBBLE_GAP + jy,
        targetX: cx,
        targetY: rect.top,
        arrowSide: 'bottom'
      },
      {
        name: 'top-right',
        left: rect.right - 36 + jx,
        top: rect.top - bubbleHeight - BUBBLE_GAP + jy,
        targetX: rect.right - rect.width * 0.24,
        targetY: rect.top,
        arrowSide: 'bottom'
      },
      {
        name: 'top-left',
        left: rect.left - bubbleWidth + 36 + jx,
        top: rect.top - bubbleHeight - BUBBLE_GAP + jy,
        targetX: rect.left + rect.width * 0.24,
        targetY: rect.top,
        arrowSide: 'bottom'
      },
      {
        name: 'right',
        left: rect.right + BUBBLE_GAP + jx,
        top: anchorY - bubbleHeight * 0.3 + jy,
        targetX: rect.right,
        targetY: anchorY,
        arrowSide: 'left'
      },
      {
        name: 'left',
        left: rect.left - bubbleWidth - BUBBLE_GAP + jx,
        top: anchorY - bubbleHeight * 0.3 + jy,
        targetX: rect.left,
        targetY: anchorY,
        arrowSide: 'right'
      }
    ];

    candidates.sort(function(a, b) {
      return scoreBubblePlacement(a, bubbleWidth, bubbleHeight, winW, winH) -
        scoreBubblePlacement(b, bubbleWidth, bubbleHeight, winW, winH);
    });

    applyBubblePlacement(candidates[0], bubbleWidth, bubbleHeight);
    bubbleEl.style.visibility = 'visible';

    if (sound) playNotifSound();
    if (bubbleTimeout) clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(function() {
      bubbleEl.classList.remove('show');
      bubbleEl.style.visibility = '';
    }, duration);
  }

  function showBubble(text, duration, sound, reactions, opts) {
    duration = duration || 4000;
    reactions = reactions || [];
    opts = opts || {};
    if (reactions.length > 0) {
      duration = 15000;
    }

    // Prepend quoted user message if present
    var displayText = text;
    var quote = opts.quote || '';

    if (sound) playNotifSound();

    showBubbleOverlay(displayText, duration, reactions, quote).catch(function() {
      showBubbleInline(displayText, duration, false, reactions, quote);
    });
  }

  // Event listeners
  listenEvent('bubble:measured', function(event) {
    var payload = event.payload || {};
    var resolver = bubbleMeasureResolvers[payload.id];
    if (!resolver) return;
    delete bubbleMeasureResolvers[payload.id];
    resolver.resolve(payload);
  });

  listenEvent('bubble:reaction', function(event) {
    if (event.payload && event.payload.reaction) {
      onReaction(event.payload.reaction);
    }
  });

  listenEvent('bubble:reply', function() {
    onReply();
  });

  listenEvent('bubble:hidden', function(event) {
    if (!activeBubbleOverlay) return;
    if (!event.payload || event.payload.id === activeBubbleOverlay.id) {
      activeBubbleOverlay = null;
    }
  });

  pet.appWindow.listen('tauri://move', function() {
    if (activeBubbleOverlay) {
      positionBubbleOverlay(activeBubbleOverlay).catch(function() {});
    }
  });

  pet.appWindow.listen('tauri://resize', function() {
    if (activeBubbleOverlay) {
      positionBubbleOverlay(activeBubbleOverlay).catch(function() {});
    }
  });

  return {
    showBubble: showBubble,
    playNotifSound: playNotifSound,
  };
}
