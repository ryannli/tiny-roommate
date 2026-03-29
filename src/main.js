// TinyRoommate — Main Entry Point
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { SpriteAnimator, getSpriteRenderOptions, STATES } from './sprite.js';
import { trackActivity, getTimeSignals, getIdleSeconds, buildContextString } from './signals.js';
import { loadConfig, think } from './brain.js';
import { voice } from './characters.js';
import { initHearts } from './hearts.js';
import { initBubble } from './bubble-manager.js';
import { initBehavior } from './behavior.js';
import { initInteraction } from './interaction.js';
import { getDefaultScale, initProviderChooser, openSettingsWindow, showContextMenu, openChatWindow } from './settings.js';

var pet = {
  canvas: document.getElementById('pet'),
  appWindow: getCurrentWindow(),
  sprite: null,
  currentSprite: 'tabby_cat',
  petName: 'Phoebe',
  ownerName: '',
  aiProvider: '',
  isWalking: false,
  llmBusy: false,
  dragStarted: false,
  lastInteractionTime: 0,
  lastScreenCapture: 0,
  lastScreenContext: null,
  mouseNearPet: false,
  showBubble: null,
  gainHeart: null,
  isSick: false,
  walkRandomDirection: null,
  ensureAiProviderSelected: null,
  voice: function() { return voice(pet); },
  resizeWindowToFit: null,
};

pet.sprite = new SpriteAnimator(
  pet.canvas,
  '/sprites/' + pet.currentSprite + '.png',
  getSpriteRenderOptions(pet.currentSprite)
);
trackActivity();

function resizeWindowToFit() {
  var size = pet.sprite.getSize();
  var dpr = window.devicePixelRatio || 1;
  var w = Math.round(size.width * dpr);
  var h = Math.round(size.height * dpr);
  return pet.appWindow.setSize({ type: 'Physical', width: w, height: h });
}
pet.resizeWindowToFit = resizeWindowToFit;

var hearts = initHearts(pet);
pet.gainHeart = hearts.gainHeart;
Object.defineProperty(pet, 'isSick', { get: function() { return hearts.isSick; } });

var bubble = initBubble(pet);
pet.showBubble = bubble.showBubble;

var behavior = initBehavior(pet);
pet.walkRandomDirection = behavior.walkRandomDirection;

initInteraction(pet);

var providerChooser = initProviderChooser(pet);
pet.ensureAiProviderSelected = providerChooser.ensureAiProviderSelected;

document.addEventListener('contextmenu', function(e) {
  e.preventDefault();
  var dpr = window.devicePixelRatio || 1;
  pet.appWindow.outerPosition().then(function(pos) {
    showContextMenu(pos.x / dpr + e.clientX, pos.y / dpr + e.clientY).catch(function() {});
  });
});

listen('contextmenu:action', function(event) {
  var action = event.payload && event.payload.action;
  if (action === 'settings') openSettingsWindow().catch(function() {});
  if (action === 'inspect') invoke('toggle_devtools').catch(function() {});
  if (action === 'quit') pet.appWindow.close();
});

listen('settings:saved', function(event) {
  var d = event.payload || {};
  if (d.petName && d.petName !== pet.petName) {
    pet.petName = d.petName;
    pet.showBubble('call me ' + pet.petName + ' now!', 3000, true);
  }
  if (d.ownerName !== undefined) pet.ownerName = d.ownerName;
  if (d.aiProvider) {
    pet.aiProvider = d.aiProvider;
    providerChooser.syncAiProvider(d.aiProvider);
  }
  if (d.sprite && d.sprite !== pet.currentSprite) {
    pet.currentSprite = d.sprite;
    pet.sprite.image.src = '/sprites/' + d.sprite + '.png';
    pet.sprite.edgeClear = getSpriteRenderOptions(d.sprite).edgeClear || 0;
  }
  if (d.scale && d.scale !== pet.sprite.scale) {
    pet.sprite.setScale(d.scale);
    resizeWindowToFit();
  }
});

listen('chat:submit', function(event) {
  var text = event.payload && event.payload.text;
  if (!text) {
    pet.sprite.setState('idle');
    return;
  }
  handleChatMessage(text);
});

async function handleChatMessage(text) {
  pet.gainHeart();
  pet.llmBusy = true;
  pet.sprite.setState('talk');
  var thinkingLines = ['🤔 hmm...', '🤔 let me think...', '🤔 umm...', '💭 hmm...', '💭 ...'];
  pet.showBubble(thinkingLines[Math.floor(Math.random() * thinkingLines.length)], 30000);

  var timeSignals = getTimeSignals();
  var context = buildContextString(timeSignals, getIdleSeconds(), pet.lastScreenContext);
  var result = await think('Your owner said to you: "' + text + '"\n\nEnvironment:\n' + context + '\n\nRespond naturally.');

  if (result) {
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

document.addEventListener('keydown', function(e) {
  if (e.metaKey && e.altKey && e.key === 'i') {
    invoke('toggle_devtools').catch(function() {});
  }
});

function animationLoop(timestamp) {
  pet.sprite.update(timestamp);
  requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

loadConfig().then(function(cfg) {
  pet.petName = cfg.pet.name;
  pet.ownerName = cfg.owner.name;
  pet.aiProvider = cfg.aiProvider;
  providerChooser.syncAiProvider(cfg.aiProvider);
  if (cfg.sprite && cfg.sprite !== pet.currentSprite) {
    pet.currentSprite = cfg.sprite;
    pet.sprite.image.src = '/sprites/' + pet.currentSprite + '.png';
    pet.sprite.edgeClear = getSpriteRenderOptions(pet.currentSprite).edgeClear || 0;
  }
  var scale = cfg.pet_scale > 0 ? cfg.pet_scale : getDefaultScale();
  pet.sprite.setScale(scale);
  resizeWindowToFit();
  hearts.updateTogether();
  behavior.start();
});
