// Settings window — runs inside settings.html
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emitTo } from '@tauri-apps/api/event';
import { SpriteAnimator, getSpriteRenderOptions } from './sprite.js';
import { getSupportedAiProviders, loadConfig, saveConfigField } from './brain.js';
import { CHARACTERS } from './characters.js';

var appWindow = getCurrentWindow();
var currentSprite = 'tabby_cat';
var currentAiProvider = '';
var previewAnimId = null;
var previewAnimators = [];

var PREVIEW_SEQUENCE = [
  { state: 'idle', duration: 1100 },
  { state: 'looking_around', duration: 1300 },
  { state: 'walk', duration: 1100 },
  { state: 'happy', duration: 1500 },
  { state: 'playful', duration: 1500 },
];

// Build sprite picker
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
  cvs.width = 128; cvs.height = 128;
  var span = document.createElement('span');
  span.textContent = char.displayName || key;
  btn.appendChild(cvs);
  btn.appendChild(span);
  spriteContainer.appendChild(btn);
  btn.addEventListener('click', function() {
    currentSprite = key;
    updateActiveSprite();
  });
});

function updateActiveSprite() {
  document.querySelectorAll('.sprite-option').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.sprite === currentSprite);
  });
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

// Slider
var scaleSlider = document.getElementById('setting-pet-scale');
var scaleValueEl = document.getElementById('pet-scale-value');
scaleSlider.addEventListener('input', function() {
  scaleValueEl.textContent = parseFloat(scaleSlider.value).toFixed(1) + 'x';
});

// Load config and populate
loadConfig().then(function(cfg) {
  document.getElementById('setting-pet-name').value = cfg.pet.name;
  document.getElementById('setting-owner-name').value = cfg.owner.name;
  currentSprite = cfg.sprite || 'tabby_cat';
  currentAiProvider = cfg.aiProvider || 'claude';
  var scale = cfg.pet_scale > 0 ? cfg.pet_scale : 1.5;
  scaleSlider.value = scale;
  scaleValueEl.textContent = scale.toFixed(1) + 'x';
  updateActiveSprite();
  updateActiveProvider();
  startPreviewAnimations();
});

function saveAndClose() {
  var newPetName = document.getElementById('setting-pet-name').value.trim();
  var newOwnerName = document.getElementById('setting-owner-name').value.trim();
  var newScale = parseFloat(scaleSlider.value);

  saveConfigField('pet_name', newPetName);
  saveConfigField('owner_name', newOwnerName);
  saveConfigField('sprite', currentSprite);
  saveConfigField('pet_scale', String(newScale));
  saveConfigField('ai_provider', currentAiProvider);

  emitTo('main', 'settings:saved', {
    petName: newPetName,
    ownerName: newOwnerName,
    sprite: currentSprite,
    scale: newScale,
    aiProvider: currentAiProvider,
  });

  stopPreviewAnimations();
  appWindow.close();
}

document.getElementById('settings-close').addEventListener('click', saveAndClose);
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') saveAndClose();
});

// Preview animations
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
  if (previewAnimId) { cancelAnimationFrame(previewAnimId); previewAnimId = null; }
  previewAnimators = [];
}
