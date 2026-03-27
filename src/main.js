// TinyRoommate — Main Entry Point
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SpriteAnimator, getSpriteRenderOptions } from './sprite.js';
import { trackActivity } from './signals.js';
import { loadConfig } from './brain.js';
import { voice } from './characters.js';
import { initHearts } from './hearts.js';
import { initBubble } from './bubble-manager.js';
import { initBehavior } from './behavior.js';
import { initInteraction } from './interaction.js';
import { initSettings } from './settings.js';

// Shared state object — passed to all modules
var pet = {
  canvas: document.getElementById('pet'),
  appWindow: getCurrentWindow(),
  sprite: null,
  currentSprite: 'tabby_cat',
  petName: 'Phoebe',
  ownerName: '',
  isWalking: false,
  llmBusy: false,
  dragStarted: false,
  lastInteractionTime: 0,
  lastScreenCapture: 0,
  lastScreenContext: null,
  mouseNearPet: false,
  // Filled by init functions
  showBubble: null,
  gainHeart: null,
  isSick: false,
  walkRandomDirection: null,
  voice: function() { return voice(pet); },
};

pet.sprite = new SpriteAnimator(
  pet.canvas,
  '/sprites/' + pet.currentSprite + '.png',
  getSpriteRenderOptions(pet.currentSprite)
);
trackActivity();

// Init modules
var hearts = initHearts(pet);
pet.gainHeart = hearts.gainHeart;
Object.defineProperty(pet, 'isSick', { get: function() { return hearts.isSick; } });

var bubble = initBubble(pet);
pet.showBubble = bubble.showBubble;

var behavior = initBehavior(pet);
pet.walkRandomDirection = behavior.walkRandomDirection;

initInteraction(pet);
initSettings(pet);

// Animation loop
function animationLoop(timestamp) {
  pet.sprite.update(timestamp);
  requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

// Load config and start
loadConfig().then(function(cfg) {
  pet.petName = cfg.pet.name;
  pet.ownerName = cfg.owner.name;
  if (cfg.sprite && cfg.sprite !== pet.currentSprite) {
    pet.currentSprite = cfg.sprite;
    pet.sprite.image.src = '/sprites/' + pet.currentSprite + '.png';
    pet.sprite.edgeClear = getSpriteRenderOptions(pet.currentSprite).edgeClear || 0;
  }
  document.getElementById('chat-input').placeholder = 'Say something to ' + pet.petName + '...';
  hearts.updateTogether();
});

behavior.start();
