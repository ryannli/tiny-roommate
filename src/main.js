// TinyRoommate — Main Entry Point
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { SpriteAnimator, getSpriteRenderOptions, STATES } from './sprite.js';
import { trackActivity, getTimeSignals, getIdleSeconds, buildContextString } from './signals.js';
import { loadConfig, saveConfigField, think } from './brain.js';
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

function getSettingsSnapshot() {
  return {
    petName: pet.petName,
    ownerName: pet.ownerName,
    sprite: pet.currentSprite,
    scale: pet.sprite.scale > 0 ? pet.sprite.scale : getDefaultScale(),
    aiProvider: pet.aiProvider || 'claude',
  };
}

function applySpriteSelection(spriteKey) {
  if (!spriteKey || spriteKey === pet.currentSprite) return;
  pet.currentSprite = spriteKey;
  pet.sprite.image.src = '/sprites/' + spriteKey + '.png';
  pet.sprite.edgeClear = getSpriteRenderOptions(spriteKey).edgeClear || 0;
}

document.addEventListener('contextmenu', function(e) {
  e.preventDefault();
  var dpr = window.devicePixelRatio || 1;
  pet.appWindow.outerPosition().then(function(pos) {
    showContextMenu(pos.x / dpr + e.clientX, pos.y / dpr + e.clientY).catch(function() {});
  });
});

listen('contextmenu:action', function(event) {
  var action = event.payload && event.payload.action;
  if (action === 'settings') {
    configLoadedPromise.finally(function() {
      openSettingsWindow(getSettingsSnapshot()).catch(function() {});
    });
  }
  if (action === 'inspect') invoke('toggle_devtools').catch(function() {});
  if (action === 'quit') pet.appWindow.close();
});

listen('settings:apply', function(event) {
  var d = event.payload || {};
  if (d.petName && d.petName !== pet.petName) {
    pet.petName = d.petName;
    pet.showBubble('call me ' + pet.petName + ' now!', 3000, true);
  }
  if (d.ownerName !== undefined) {
    pet.ownerName = d.ownerName;
  }
  if (d.aiProvider) {
    pet.aiProvider = d.aiProvider;
    providerChooser.syncAiProvider(d.aiProvider);
    saveConfigField('ai_provider', d.aiProvider).catch(function() {});
  }
  if (d.sprite) {
    applySpriteSelection(d.sprite);
    saveConfigField('sprite', d.sprite).catch(function() {});
  }
  if (d.scale && d.scale !== pet.sprite.scale) {
    pet.sprite.setScale(d.scale);
    resizeWindowToFit();
    saveConfigField('pet_scale', String(d.scale)).catch(function() {});
  }
  if (d.petName !== undefined) saveConfigField('pet_name', d.petName).catch(function() {});
  if (d.ownerName !== undefined) saveConfigField('owner_name', d.ownerName).catch(function() {});
});

listen('settings:preview-scale', function(event) {
  var scale = event.payload && parseFloat(event.payload.scale);
  if (!scale || scale <= 0 || scale === pet.sprite.scale) return;
  pet.sprite.setScale(scale);
  resizeWindowToFit();
});

listen('settings:preview-sprite', function(event) {
  var sprite = event.payload && event.payload.sprite;
  if (!sprite) return;
  applySpriteSelection(sprite);
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

var configLoadedPromise = loadConfig().then(function(cfg) {
  pet.petName = cfg.pet.name;
  pet.ownerName = cfg.owner.name;
  pet.aiProvider = cfg.aiProvider;
  providerChooser.syncAiProvider(cfg.aiProvider);
  if (cfg.sprite && cfg.sprite !== pet.currentSprite) {
    applySpriteSelection(cfg.sprite);
  }
  var scale = cfg.pet_scale > 0 ? cfg.pet_scale : getDefaultScale();
  pet.sprite.setScale(scale);
  resizeWindowToFit();
  hearts.updateTogether();
  behavior.start();
});
