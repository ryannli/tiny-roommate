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
import { initSettings, getDefaultScale } from './settings.js';

var WINDOW_PAD_X = 40;   // horizontal padding around sprite
var WINDOW_PAD_BOTTOM = 50; // space below sprite for chat input

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
  resizeWindowToFit: null,
};

pet.sprite = new SpriteAnimator(
  pet.canvas,
  '/sprites/' + pet.currentSprite + '.png',
  getSpriteRenderOptions(pet.currentSprite)
);
trackActivity();

// Resize window to tightly fit the pet sprite
function resizeWindowToFit() {
  var size = pet.sprite.getSize();
  var dpr = window.devicePixelRatio || 1;
  var w = Math.round(Math.max(size.width + WINDOW_PAD_X, 200) * dpr);
  var h = Math.round((size.height + WINDOW_PAD_BOTTOM) * dpr);
  return pet.appWindow.setSize({ type: 'Physical', width: w, height: h });
}
pet.resizeWindowToFit = resizeWindowToFit;

// Click-through: briefly ignore cursor events when mouse is over transparent pixels.
// This lets clicks pass through to windows below while keeping the pet interactive.
(function initClickThrough() {
  var ignoreTimer = null;

  document.addEventListener('mousemove', function(e) {
    // Don't toggle during settings, chat, or context menu
    if (document.getElementById('settings-overlay').classList.contains('show')) return;
    if (document.getElementById('chat-input').classList.contains('show')) return;
    if (document.getElementById('context-menu').classList.contains('show')) return;

    var rect = pet.canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;

    var isOverOpaque = false;
    if (x >= 0 && y >= 0 && x < rect.width && y < rect.height) {
      var cx = Math.floor(x * (pet.canvas.width / rect.width));
      var cy = Math.floor(y * (pet.canvas.height / rect.height));
      try {
        var pixel = pet.sprite.ctx.getImageData(cx, cy, 1, 1).data;
        isOverOpaque = pixel[3] > 10;
      } catch (err) {
        isOverOpaque = true;
      }
    }

    if (!isOverOpaque) {
      // Briefly ignore events so this click/hover passes to windows below,
      // then re-enable so we can detect when mouse returns to opaque area.
      pet.appWindow.setIgnoreCursorEvents(true).catch(function() {});
      clearTimeout(ignoreTimer);
      ignoreTimer = setTimeout(function() {
        pet.appWindow.setIgnoreCursorEvents(false).catch(function() {});
      }, 50);
    } else {
      clearTimeout(ignoreTimer);
      pet.appWindow.setIgnoreCursorEvents(false).catch(function() {});
    }
  });
})();

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
  // Apply saved scale (or screen-aware default)
  var scale = cfg.pet_scale > 0 ? cfg.pet_scale : getDefaultScale();
  pet.sprite.setScale(scale);
  resizeWindowToFit();

  document.getElementById('chat-input').placeholder = 'Say something to ' + pet.petName + '...';
  hearts.updateTogether();
});

behavior.start();
