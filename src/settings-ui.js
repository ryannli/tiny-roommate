// Settings window — runs inside settings.html
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit, emitTo, listen } from '@tauri-apps/api/event';
import { SpriteAnimator, getSpriteRenderOptions } from './sprite.js';
import { getSupportedAiProviders } from './brain.js';
import { CHARACTERS } from './characters.js';
import { getDefaultScale } from './settings.js';
import { normalizeSettingsPayload } from './settings-state.js';
import { listCustomSprites, importCustomSprite, loadCustomSpriteDataUrl, deleteCustomSprite, isCustomSprite, SPRITE_PROMPT } from './custom-sprites.js';
import { buildSpritePreviewPayload } from './sprite-preview.js';

var appWindow = getCurrentWindow();
var settingsHeader = document.querySelector('.settings-header');
var currentSprite = 'tabby_cat';
var currentAiProvider = 'claude';
var isSaving = false;
var hasHydratedSettings = false;
var previewAnimId = null;
var previewAnimators = [];
var customSpriteCache = {}; // key -> dataUrl

// Custom confirm dialog (native confirm() doesn't work in Tauri webviews)
var confirmDeleteModal = document.getElementById('confirm-delete-modal');
var confirmDeleteText = document.getElementById('confirm-delete-text');
var confirmDeleteOk = document.getElementById('confirm-delete-ok');
var confirmDeleteCancel = document.getElementById('confirm-delete-cancel');
var pendingDeleteResolve = null;

function confirmDelete(name) {
  return new Promise(function(resolve) {
    pendingDeleteResolve = resolve;
    confirmDeleteText.textContent = 'Delete "' + name + '"?';
    confirmDeleteModal.classList.add('show');
  });
}

confirmDeleteOk.addEventListener('click', function() {
  confirmDeleteModal.classList.remove('show');
  if (pendingDeleteResolve) { pendingDeleteResolve(true); pendingDeleteResolve = null; }
});
confirmDeleteCancel.addEventListener('click', function() {
  confirmDeleteModal.classList.remove('show');
  if (pendingDeleteResolve) { pendingDeleteResolve(false); pendingDeleteResolve = null; }
});
confirmDeleteModal.addEventListener('click', function(e) {
  if (e.target === confirmDeleteModal) {
    confirmDeleteModal.classList.remove('show');
    if (pendingDeleteResolve) { pendingDeleteResolve(false); pendingDeleteResolve = null; }
  }
});

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

// Build official sprite picker
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

// Add import button at the end of official sprites
var importBtn = document.createElement('button');
importBtn.className = 'import-btn';
importBtn.innerHTML = '<span class="import-icon">+</span><span>Import</span>';
importBtn.addEventListener('click', function() {
  openImportModal();
});
spriteContainer.appendChild(importBtn);

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

  var previewDataUrl = options.dataUrl || customSpriteCache[currentSprite] || null;

  emitTo('main', 'settings:preview-sprite', buildSpritePreviewPayload(currentSprite, previewDataUrl)).catch(function() {});

  if (isCustomSprite(currentSprite) && !previewDataUrl) {
    var requestedSprite = currentSprite;
    loadCustomSpriteDataUrl(requestedSprite).then(function(dataUrl) {
      if (!dataUrl) return;
      customSpriteCache[requestedSprite] = dataUrl;
      if (currentSprite !== requestedSprite) return;
      emitTo('main', 'settings:preview-sprite', buildSpritePreviewPayload(requestedSprite, dataUrl)).catch(function() {});
    }).catch(function() {});
  }
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

// --- Custom sprites section ---
var customSection = document.getElementById('custom-sprites-section');
var customContainer = document.getElementById('custom-sprite-options');

async function refreshCustomSprites() {
  var sprites = await listCustomSprites();
  customContainer.innerHTML = '';

  if (sprites.length === 0) {
    customSection.style.display = 'none';
    return;
  }

  customSection.style.display = '';

  for (var i = 0; i < sprites.length; i++) {
    var sprite = sprites[i];
    await addCustomSpriteButton(sprite);
  }

  updateActiveSprite();
  startPreviewAnimations();
}

async function addCustomSpriteButton(sprite) {
  var dataUrl = customSpriteCache[sprite.key];
  if (!dataUrl) {
    dataUrl = await loadCustomSpriteDataUrl(sprite.key);
    if (dataUrl) customSpriteCache[sprite.key] = dataUrl;
  }
  if (!dataUrl) return;

  var btn = document.createElement('button');
  btn.className = 'sprite-option';
  btn.dataset.sprite = sprite.key;

  var cvs = document.createElement('canvas');
  cvs.className = 'sprite-preview';
  cvs.dataset.src = dataUrl;
  cvs.width = 128;
  cvs.height = 128;

  var span = document.createElement('span');
  span.textContent = sprite.displayName || 'Custom';

  var delBtn = document.createElement('button');
  delBtn.className = 'sprite-delete';
  delBtn.textContent = '\u00d7';
  delBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    confirmDelete(sprite.displayName).then(function(ok) {
      if (!ok) return;
      deleteCustomSprite(sprite.key).then(function() {
        if (currentSprite === sprite.key) {
          setCurrentSprite('tabby_cat');
        }
        delete customSpriteCache[sprite.key];
        refreshCustomSprites();
      }).catch(function(err) {
        console.error('Delete failed:', err);
      });
    });
  });

  btn.appendChild(delBtn);
  btn.appendChild(cvs);
  btn.appendChild(span);
  customContainer.appendChild(btn);

  btn.addEventListener('click', function() {
    setCurrentSprite(sprite.key);
  });
}

// --- Import modal ---
var importModal = document.getElementById('import-modal');
var promptText = document.getElementById('prompt-text');
var copyBtn = document.getElementById('copy-prompt-btn');
var importNameInput = document.getElementById('import-name');
var importFileBtn = document.getElementById('import-file-btn');
var importFileInput = document.getElementById('import-file-input');
var importStatus = document.getElementById('import-status');

promptText.textContent = SPRITE_PROMPT;

function openImportModal() {
  importModal.classList.add('show');
  importNameInput.value = '';
  importStatus.textContent = '';
  importStatus.className = 'import-status';
  importFileBtn.disabled = false;
}

function closeImportModal() {
  importModal.classList.remove('show');
}

document.getElementById('import-modal-close').addEventListener('click', closeImportModal);
importModal.addEventListener('click', function(e) {
  if (e.target === importModal) closeImportModal();
});

copyBtn.addEventListener('click', function() {
  navigator.clipboard.writeText(SPRITE_PROMPT).then(function() {
    copyBtn.textContent = 'Copied!';
    copyBtn.classList.add('copied');
    setTimeout(function() {
      copyBtn.textContent = 'Copy';
      copyBtn.classList.remove('copied');
    }, 2000);
  });
});

importFileBtn.addEventListener('click', function() {
  importFileInput.click();
});

importFileInput.addEventListener('change', async function() {
  var file = importFileInput.files[0];
  if (!file) return;

  var displayName = importNameInput.value.trim() || 'Custom Character';
  importFileBtn.disabled = true;
  importStatus.textContent = 'Processing sprite sheet\u2026 this may take a moment';
  importStatus.className = 'import-status processing';

  try {
    var result = await importCustomSprite(file, displayName);
    importStatus.textContent = 'Done! "' + result.displayName + '" is ready.';
    importStatus.className = 'import-status success';

    // Pre-load the data URL before selecting so the first preview is instant.
    var dataUrl = await loadCustomSpriteDataUrl(result.key);
    if (dataUrl) customSpriteCache[result.key] = dataUrl;
    setCurrentSprite(result.key, { dataUrl: dataUrl });

    await refreshCustomSprites();
    updateActiveSprite();

    setTimeout(closeImportModal, 1500);
  } catch (err) {
    console.error('Import error:', err);
    importStatus.textContent = (err && err.message) || String(err) || 'Import failed';
    importStatus.className = 'import-status error';
    importFileBtn.disabled = false;
  }

  // Reset file input so the same file can be selected again
  importFileInput.value = '';
});

// --- Slider ---
var scaleSlider = document.getElementById('setting-pet-scale');
var scaleValueEl = document.getElementById('pet-scale-value');
scaleSlider.addEventListener('input', function() {
  var scale = parseFloat(scaleSlider.value);
  scaleValueEl.textContent = scale.toFixed(1) + 'x';
  emitTo('main', 'settings:preview-scale', { scale: scale }).catch(function() {});
});

function applySettingsPayload(cfg) {
  var petNameInput = document.getElementById('setting-pet-name');
  var ownerNameInput = document.getElementById('setting-owner-name');
  var normalized = normalizeSettingsPayload(cfg, {
    defaultPetName: petNameInput ? petNameInput.value : '',
    defaultOwnerName: ownerNameInput ? ownerNameInput.value : '',
    defaultSprite: currentSprite,
    defaultScale: getDefaultScale(),
    defaultAiProvider: currentAiProvider || 'claude',
  });
  petNameInput.value = normalized.petName;
  ownerNameInput.value = normalized.ownerName;
  setCurrentSprite(normalized.sprite, { preview: false });
  currentAiProvider = normalized.aiProvider;
  var scale = normalized.scale;
  scaleSlider.value = scale;
  scaleValueEl.textContent = scale.toFixed(1) + 'x';
  updateActiveProvider();
  refreshCustomSprites();
  startPreviewAnimations();
  hasHydratedSettings = true;
  isSaving = false;
}

listen('settings:open', function(event) {
  applySettingsPayload(event.payload || {});
});

function saveAndClose() {
  if (isSaving) return;
  if (!hasHydratedSettings) {
    appWindow.hide().catch(function() {});
    return;
  }
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
  if (e.key === 'Escape') {
    if (importModal.classList.contains('show')) {
      closeImportModal();
    } else {
      saveAndClose();
    }
  }
});

// --- Preview animations ---
function startPreviewAnimations() {
  stopPreviewAnimations();
  var previews = document.querySelectorAll('.sprite-preview');
  previewAnimators = Array.prototype.map.call(previews, function(cvs, index) {
    var src = cvs.dataset.src;
    var spriteName = src.startsWith('data:') ? '' : src.split('/').pop().replace(/\.png$/, '');
    var animator = new SpriteAnimator(cvs, src, Object.assign(
      { scale: 1 },
      spriteName ? getSpriteRenderOptions(spriteName) : {}
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
emitTo('main', 'settings:request-state', { label: 'settings' }).catch(function() {});
