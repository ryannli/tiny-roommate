// Chat bubble display + positioning logic (main window side)

import { emitTo, listen as listenEvent } from '@tauri-apps/api/event';
import { monitorFromPoint } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  BUBBLE_LAYOUT_DEFAULTS,
  clamp,
  pickBubblePlacement,
  pickBubblePlacementWithinBounds,
  resolveBubbleRect,
  resolveBubbleRectWithinBounds,
  resolveWideBubbleSize,
} from './bubble-layout.js';

var BUBBLE_MARGIN = BUBBLE_LAYOUT_DEFAULTS.margin;
var BUBBLE_ARROW_HALF = 5;
var BUBBLE_MIN_WIDTH = BUBBLE_LAYOUT_DEFAULTS.minWidth;
var BUBBLE_MAX_WIDTH = BUBBLE_LAYOUT_DEFAULTS.maxWidth;
var BUBBLE_WINDOW_PAD = 8;
var BOUNDS_FALLBACK_PAD = 8192;

export function initBubble(pet) {
  var bubbleEl = document.getElementById('bubble');
  var bubbleTextEl = document.getElementById('bubble-text');
  var bubbleArrowEl = document.getElementById('bubble-arrow');
  var measureStageEl = document.createElement('div');
  var measureBubbleEl = document.createElement('div');
  var measureTextEl = document.createElement('span');
  var measureActionsEl = document.createElement('div');
  var measureReactionsEl = document.createElement('div');
  var measureReplyBtn = document.createElement('button');
  var bubbleTimeout = null;
  var bubbleWindowRef = null;
  var bubbleWindowReadyPromise = null;
  var activeBubbleOverlay = null;
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

  // Hidden local measurer so overlay sizing doesn't depend on a cross-window round trip.
  measureStageEl.style.position = 'fixed';
  measureStageEl.style.left = '-10000px';
  measureStageEl.style.top = '-10000px';
  measureStageEl.style.width = '0';
  measureStageEl.style.height = '0';
  measureStageEl.style.pointerEvents = 'none';
  measureStageEl.style.visibility = 'hidden';
  measureStageEl.style.zIndex = '-1';

  measureBubbleEl.style.position = 'absolute';
  measureBubbleEl.style.left = BUBBLE_WINDOW_PAD + 'px';
  measureBubbleEl.style.top = BUBBLE_WINDOW_PAD + 'px';
  measureBubbleEl.style.boxSizing = 'border-box';
  measureBubbleEl.style.maxWidth = BUBBLE_MAX_WIDTH + 'px';
  measureBubbleEl.style.minWidth = BUBBLE_MIN_WIDTH + 'px';
  measureBubbleEl.style.width = 'fit-content';
  measureBubbleEl.style.padding = '10px 16px';
  measureBubbleEl.style.font = "14px/1.5 'SF Pro Rounded', system-ui, -apple-system, sans-serif";
  measureBubbleEl.style.fontWeight = '500';
  measureBubbleEl.style.textAlign = 'left';
  measureBubbleEl.style.wordWrap = 'break-word';
  measureBubbleEl.style.letterSpacing = '0.01em';

  measureActionsEl.style.display = 'flex';
  measureActionsEl.style.alignItems = 'center';
  measureActionsEl.style.marginTop = '8px';
  measureActionsEl.style.gap = '6px';

  measureReactionsEl.style.display = 'flex';
  measureReactionsEl.style.gap = '6px';
  measureReactionsEl.style.flexWrap = 'nowrap';
  measureReactionsEl.style.flex = '1';

  measureReplyBtn.textContent = '↩';
  measureReplyBtn.type = 'button';
  measureReplyBtn.style.marginLeft = 'auto';
  measureReplyBtn.style.padding = '2px 6px';
  measureReplyBtn.style.border = 'none';
  measureReplyBtn.style.borderRadius = '8px';
  measureReplyBtn.style.background = 'transparent';
  measureReplyBtn.style.color = 'rgba(100, 75, 60, 0.3)';
  measureReplyBtn.style.font = "13px/1 'SF Pro Rounded', system-ui, sans-serif";
  measureReplyBtn.style.flexShrink = '0';

  measureActionsEl.appendChild(measureReactionsEl);
  measureActionsEl.appendChild(measureReplyBtn);
  measureBubbleEl.appendChild(measureTextEl);
  measureBubbleEl.appendChild(measureActionsEl);
  measureStageEl.appendChild(measureBubbleEl);
  document.body.appendChild(measureStageEl);

  function renderBubbleContent(targetTextEl, targetReactionsEl, text, quote, reactions, onReactionClick, isMeasurePass) {
    targetTextEl.innerHTML = '';
    if (quote) {
      var quoteEl = document.createElement('div');
      quoteEl.className = 'bubble-quote';
      if (isMeasurePass) {
        quoteEl.style.fontSize = '11px';
        quoteEl.style.color = 'rgba(100, 75, 60, 0.4)';
        quoteEl.style.marginBottom = '4px';
        quoteEl.style.paddingBottom = '4px';
        quoteEl.style.borderBottom = '1px solid rgba(200, 160, 120, 0.12)';
        quoteEl.style.lineHeight = '1.4';
      }
      quoteEl.textContent = quote;
      targetTextEl.appendChild(quoteEl);
    }
    targetTextEl.appendChild(document.createTextNode(text || ''));

    targetReactionsEl.innerHTML = '';
    (reactions || []).forEach(function(reaction) {
      var btn = document.createElement('button');
      btn.textContent = reaction;
      if (isMeasurePass) {
        btn.type = 'button';
        btn.style.padding = '4px 10px';
        btn.style.border = '1px solid rgba(200, 140, 100, 0.25)';
        btn.style.borderRadius = '10px';
        btn.style.background = 'rgba(255, 255, 255, 0.7)';
        btn.style.color = '#5a3d2e';
        btn.style.font = "12px/1 'SF Pro Rounded', system-ui, sans-serif";
      }
      if (onReactionClick) {
        btn.onclick = function() {
          bubbleEl.classList.remove('show');
          onReactionClick(reaction);
        };
      }
      targetReactionsEl.appendChild(btn);
    });
  }

  function measureOverlayBubble(text, reactions, quote) {
    renderBubbleContent(measureTextEl, measureReactionsEl, text, quote, reactions, null, true);
    measureBubbleEl.style.width = 'fit-content';

    var measured = resolveWideBubbleSize(function(width) {
      measureBubbleEl.style.width = width ? width + 'px' : 'fit-content';
      return {
        width: Math.ceil(measureBubbleEl.offsetWidth),
        height: Math.ceil(measureBubbleEl.offsetHeight),
      };
    });

    return {
      bubbleWidth: measured.width,
      bubbleHeight: measured.height,
      windowWidth: Math.ceil(measured.width + BUBBLE_WINDOW_PAD * 2),
      windowHeight: Math.ceil(measured.height + BUBBLE_WINDOW_PAD * 2),
    };
  }

  function applyBubblePlacement(candidate, bubbleWidth, bubbleHeight) {
    var winW = window.innerWidth;
    var winH = window.innerHeight;
    var bubbleRect = resolveBubbleRect(candidate, bubbleWidth, bubbleHeight, winW, winH, BUBBLE_MARGIN);
    var left = bubbleRect.left;
    var top = bubbleRect.top;

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
    }, 5000);

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

  function createFixedRandom(values) {
    var index = 0;
    return function() {
      if (!values.length) return 0.5;
      var safeIndex = index < values.length ? index : values.length - 1;
      var value = values[safeIndex];
      index += 1;
      return value;
    };
  }

  function scaleValue(value, scaleFactor) {
    return value * scaleFactor;
  }

  function resolveMonitorBoundsRect(monitor, anchorRect) {
    if (!monitor || !monitor.workArea) {
      return {
        left: anchorRect.left - BOUNDS_FALLBACK_PAD,
        top: anchorRect.top - BOUNDS_FALLBACK_PAD,
        right: anchorRect.right + BOUNDS_FALLBACK_PAD,
        bottom: anchorRect.bottom + BOUNDS_FALLBACK_PAD,
      };
    }

    return {
      left: monitor.workArea.position.x,
      top: monitor.workArea.position.y,
      right: monitor.workArea.position.x + monitor.workArea.size.width,
      bottom: monitor.workArea.position.y + monitor.workArea.size.height,
    };
  }

  async function resolvePetAnchorRect() {
    var rect = pet.canvas.getBoundingClientRect();
    var pos = await pet.appWindow.innerPosition();
    var scaleFactor = await pet.appWindow.scaleFactor();
    var left = pos.x + scaleValue(rect.left, scaleFactor);
    var top = pos.y + scaleValue(rect.top, scaleFactor);
    var width = scaleValue(rect.width, scaleFactor);
    var height = scaleValue(rect.height, scaleFactor);

    return {
      rect: {
        left: left,
        top: top,
        right: left + width,
        bottom: top + height,
        width: width,
        height: height,
      },
      scaleFactor: scaleFactor,
    };
  }

  async function positionBubbleOverlay(state) {
    await ensureBubbleWindow();

    var anchor = await resolvePetAnchorRect();
    var anchorRect = anchor.rect;
    var centerX = anchorRect.left + anchorRect.width / 2;
    var centerY = anchorRect.top + anchorRect.height / 2;
    var monitor = null;
    try {
      monitor = await monitorFromPoint(centerX, centerY);
    } catch (err) {
      monitor = null;
    }

    var bubbleScaleFactor = monitor && monitor.scaleFactor ? monitor.scaleFactor : anchor.scaleFactor;
    var boundsRect = resolveMonitorBoundsRect(monitor, anchorRect);
    var bubbleWidthPhysical = scaleValue(state.bubbleWidth, bubbleScaleFactor);
    var bubbleHeightPhysical = scaleValue(state.bubbleHeight, bubbleScaleFactor);
    var placementRandom = state.placementRandom || [Math.random(), Math.random(), Math.random()];
    state.placementRandom = placementRandom;

    var placement = pickBubblePlacementWithinBounds(
      anchorRect,
      bubbleWidthPhysical,
      bubbleHeightPhysical,
      boundsRect,
      {
        random: createFixedRandom(placementRandom),
        margin: scaleValue(BUBBLE_MARGIN, bubbleScaleFactor),
        minGap: scaleValue(BUBBLE_LAYOUT_DEFAULTS.minGap, bubbleScaleFactor),
        maxGap: scaleValue(BUBBLE_LAYOUT_DEFAULTS.gap, bubbleScaleFactor),
        petPadding: scaleValue(BUBBLE_LAYOUT_DEFAULTS.petPadding, bubbleScaleFactor),
        jitterX: scaleValue(BUBBLE_LAYOUT_DEFAULTS.jitterX, bubbleScaleFactor),
        jitterY: scaleValue(BUBBLE_LAYOUT_DEFAULTS.jitterY, bubbleScaleFactor),
      }
    );
    var bubbleRect = resolveBubbleRectWithinBounds(
      placement,
      bubbleWidthPhysical,
      bubbleHeightPhysical,
      boundsRect,
      scaleValue(BUBBLE_MARGIN, bubbleScaleFactor)
    );
    var bubbleLeft = bubbleRect.left;
    var bubbleTop = bubbleRect.top;
    var windowLeft = bubbleLeft - scaleValue(BUBBLE_WINDOW_PAD, bubbleScaleFactor);
    var windowTop = bubbleTop - scaleValue(BUBBLE_WINDOW_PAD, bubbleScaleFactor);
    var arrowOffset = Math.max(
      16,
      Math.min(state.bubbleWidth - 16, (placement.targetX - bubbleLeft) / bubbleScaleFactor)
    );

    await emitTo('bubble', 'bubble:display', {
      id: state.id,
      text: state.text,
      quote: state.quote,
      reactions: state.reactions,
      duration: state.duration,
      maxWidth: BUBBLE_MAX_WIDTH,
      bubbleWidth: state.bubbleWidth,
      arrowSide: placement.arrowSide,
      arrowOffset: Math.round(arrowOffset),
      x: Math.round(windowLeft),
      y: Math.round(windowTop),
      windowWidth: Math.round(state.windowWidth),
      windowHeight: Math.round(state.windowHeight),
      positionType: 'Physical',
      sizeType: 'Logical',
    });
  }

  async function showBubbleOverlay(text, duration, reactions, quote) {
    var id = 'bubble-' + (++bubbleSessionCounter);
    await ensureBubbleWindow();
    var metrics = measureOverlayBubble(text, reactions, quote);

    activeBubbleOverlay = {
      id: id,
      text: text,
      quote: quote,
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
    var metrics = measureOverlayBubble(text, reactions, quote);

    var reactionsEl = document.getElementById('bubble-reactions');
    renderBubbleContent(bubbleTextEl, reactionsEl, text, quote, reactions, onReaction, false);
    bubbleEl.style.width = metrics.bubbleWidth + 'px';
    bubbleEl.style.maxWidth = BUBBLE_MAX_WIDTH + 'px';
    if (reactions.length > 0) {
      duration = 15000;
    }

    var rect = pet.canvas.getBoundingClientRect();
    bubbleEl.style.visibility = 'hidden';
    bubbleEl.style.left = BUBBLE_MARGIN + 'px';
    bubbleEl.style.top = BUBBLE_MARGIN + 'px';
    bubbleEl.style.transform = 'none';
    bubbleEl.classList.add('show');

    var bubbleWidth = metrics.bubbleWidth;
    var bubbleHeight = metrics.bubbleHeight;
    var winW = window.innerWidth;
    var winH = window.innerHeight;

    var placement = pickBubblePlacement(rect, bubbleWidth, bubbleHeight, winW, winH, { random: Math.random });
    applyBubblePlacement(placement, bubbleWidth, bubbleHeight);
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

    showBubbleOverlay(displayText, duration, reactions, quote).catch(function(err) {
      console.warn('Bubble overlay failed, using inline:', err);
      showBubbleInline(displayText, duration, false, reactions, quote);
    });
  }

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
    getBubbleWindow: function() { return bubbleWindowRef; },
  };
}
