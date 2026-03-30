// Settings window — runs inside settings.html
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit, emitTo, listen } from '@tauri-apps/api/event';
import { SpriteAnimator, getSpriteRenderOptions } from './sprite.js';
import { getSupportedAiProviders } from './brain.js';
import { CHARACTERS } from './characters.js';

var appWindow = getCurrentWindow();
var settingsHeader = document.querySelector('.settings-header');
var currentSprite = 'tabby_cat';
var currentAiProvider = 'claude';
var isSaving = false;
var previewAnimId = null;
var previewAnimators = [];

var PREVIEW_SEQUENCE = [
  { state: 'idle', duration: 1100 },
  { state: 'looking_around', duration: 1300 },
  { state: 'walk', duration: 1100 },
  { state: 'happy', duration: 1500 },
  { state: 'playful', duration: 1500 },
];

settingsHeader.addEventListener('mousedown', function(e) {
  if (e.button !== 0) return;
  if (e.target && e.target.closest && e.target.closest('#settings-close')) return;
  appWindow.startDragging().catch(function() {});
});

var spriteContainer = document.getElementById('sprite-options');
Object.keys(CHARACTERS).forEach(function(key) {
  if (key === '_default') return;
  var char = CHARACTERS[key];
  var btn = document.createElement('button');
  btn.className = 'sprite-option';
  btn.dataset.sprite = key;
  var cvs = document.createElement('canvas');
  cvs.className = 'sprite-preview';
  cvs.dataset.src = '/sprites/' + key + '.png';
  cvs.width = 128;
  cvs.height = 128;
  var span = document.createElement('span');
  span.textContent = char.displayName || key;
  btn.appendChild(cvs);
  btn.appendChild(span);
  spriteContainer.appendChild(btn);
  btn.addEventListener('click', function() {
    setCurrentSprite(key);
  });
});

function updateActiveSprite() {
  document.querySelectorAll('.sprite-option').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.sprite === currentSprite);
  });
}

function setCurrentSprite(sprite, options) {
  options = options || {};
  currentSprite = sprite || 'tabby_cat';
  updateActiveSprite();

  if (options.preview === false) return;

  emitTo('main', 'settings:preview-sprite', {
    sprite: currentSprite,
  }).catch(function() {});
}

var providerContainer = document.getElementById('settings-ai-provider-options');
getSupportedAiProviders().forEach(function(provider) {
  var btn = document.createElement('button');
  btn.className = 'provider-option';
  btn.dataset.provider = provider.id;

  var title = document.createElement('strong');
  title.textContent = provider.displayName;

  var description = document.createElement('span');
  description.textContent = provider.id === 'claude'
    ? 'Uses Claude Code as the pet brain.'
    : 'Uses Gemini CLI as the pet brain.';

  btn.appendChild(title);
  btn.appendChild(description);
  btn.addEventListener('click', function() {
    currentAiProvider = provider.id;
    updateActiveProvider();
  });
  providerContainer.appendChild(btn);
});

function updateActiveProvider() {
  document.querySelectorAll('.provider-option').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.provider === currentAiProvider);
  });
}

var scaleSlider = document.getElementById('setting-pet-scale');
var scaleValueEl = document.getElementById('pet-scale-value');
scaleSlider.addEventListener('input', function() {
  var scale = parseFloat(scaleSlider.value);
  scaleValueEl.textContent = scale.toFixed(1) + 'x';
  emitTo('main', 'settings:preview-scale', { scale: scale }).catch(function() {});
});

function applySettingsPayload(cfg) {
  cfg = cfg || {};
  document.getElementById('setting-pet-name').value = cfg.petName || 'Phoebe';
  document.getElementById('setting-owner-name').value = cfg.ownerName || '';
  setCurrentSprite(cfg.sprite || 'tabby_cat', { preview: false });
  currentAiProvider = cfg.aiProvider || 'claude';
  var scale = cfg.scale > 0 ? cfg.scale : 1.5;
  scaleSlider.value = scale;
  scaleValueEl.textContent = scale.toFixed(1) + 'x';
  updateActiveProvider();
  startPreviewAnimations();
  isSaving = false;
}

listen('settings:open', function(event) {
  applySettingsPayload(event.payload || {});
});

function saveAndClose() {
  if (isSaving) return;
  isSaving = true;
  var newPetName = document.getElementById('setting-pet-name').value.trim();
  var newOwnerName = document.getElementById('setting-owner-name').value.trim();
  var newScale = parseFloat(scaleSlider.value);

  emitTo('main', 'settings:apply', {
    petName: newPetName,
    ownerName: newOwnerName,
    sprite: currentSprite,
    scale: newScale,
    aiProvider: currentAiProvider,
  }).catch(function() {});

  stopPreviewAnimations();
  appWindow.hide().catch(function() {});
  isSaving = false;
}

document.getElementById('settings-close').addEventListener('click', saveAndClose);
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') saveAndClose();
});

function startPreviewAnimations() {
  stopPreviewAnimations();
  var previews = document.querySelectorAll('.sprite-preview');
  previewAnimators = Array.prototype.map.call(previews, function(cvs, index) {
    var animator = new SpriteAnimator(cvs, cvs.dataset.src, Object.assign(
      { scale: 1 },
      getSpriteRenderOptions(cvs.dataset.src.split('/').pop().replace(/\.png$/, ''))
    ));
    return { animator: animator, sequenceIndex: index % PREVIEW_SEQUENCE.length, nextTransitionAt: 0 };
  });

  function queueNext(entry, ts, force) {
    if (!force && ts < entry.nextTransitionAt) return;
    var step = PREVIEW_SEQUENCE[entry.sequenceIndex];
    entry.animator.setState(step.state);
    entry.nextTransitionAt = ts + step.duration;
    entry.sequenceIndex = (entry.sequenceIndex + 1) % PREVIEW_SEQUENCE.length;
  }

  function animate(ts) {
    previewAnimators.forEach(function(entry, index) {
      queueNext(entry, entry.nextTransitionAt ? ts : ts + index * 220, !entry.nextTransitionAt);
      entry.animator.update(ts);
    });
    previewAnimId = requestAnimationFrame(animate);
  }
  previewAnimId = requestAnimationFrame(animate);
}

function stopPreviewAnimations() {
  if (previewAnimId) {
    cancelAnimationFrame(previewAnimId);
    previewAnimId = null;
  }
  previewAnimators = [];
}

emit('settings:ready', { label: 'settings' }).catch(function() {});
