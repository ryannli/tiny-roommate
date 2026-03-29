// Settings panel, context menu, sprite selection

import { invoke } from '@tauri-apps/api/core';
import { SpriteAnimator, getSpriteRenderOptions } from './sprite.js';
import { saveConfigField } from './brain.js';
import { CHARACTERS } from './characters.js';

export function getDefaultScale() {
  var w = window.screen.availWidth;
  if (w < 1500) return 1.2;   // laptops
  if (w < 2000) return 1.5;   // medium displays
  return 1.8;                  // large monitors
}

var SETTINGS_SIZE = { width: 560, height: 640 };

var PREVIEW_SEQUENCE = [
  { state: 'idle', duration: 1100 },
  { state: 'looking_around', duration: 1300 },
  { state: 'walk', duration: 1100 },
  { state: 'happy', duration: 1500 },
  { state: 'playful', duration: 1500 },
];

function buildSpritePicker(container) {
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
    container.appendChild(btn);
  });
}

export function initSettings(pet) {
  var contextMenu = document.getElementById('context-menu');
  var settingsOverlay = document.getElementById('settings-overlay');
  var normalSize = null;
  var normalPos = null;
  var previewAnimId = null;
  var previewAnimators = [];

  // Build sprite picker from CHARACTERS data
  buildSpritePicker(document.getElementById('sprite-options'));

  // --- Right-click context menu ---
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    contextMenu.classList.add('show');
    var menuH = contextMenu.offsetHeight;
    var menuW = contextMenu.offsetWidth;
    var winW = window.innerWidth;
    var winH = window.innerHeight;
    var x = Math.min(e.clientX, winW - menuW - 5);
    var y = e.clientY - menuH;
    if (y < 5) y = e.clientY;
    contextMenu.style.left = Math.max(5, x) + 'px';
    contextMenu.style.top = Math.max(5, y) + 'px';
  });

  document.addEventListener('click', function() {
    contextMenu.classList.remove('show');
  });

  // Settings button
  document.getElementById('menu-settings').addEventListener('click', function() {
    contextMenu.classList.remove('show');
    openSettings();
  });

  // Inspect Element
  document.getElementById('menu-inspect').addEventListener('click', function() {
    contextMenu.classList.remove('show');
    invoke('toggle_devtools').catch(function() {});
  });

  // Quit
  document.getElementById('menu-quit').addEventListener('click', function() {
    pet.appWindow.close();
  });

  // --- Settings panel ---
  var scaleSlider = document.getElementById('setting-pet-scale');
  var scaleValueEl = document.getElementById('pet-scale-value');

  scaleSlider.addEventListener('input', function() {
    scaleValueEl.textContent = parseFloat(scaleSlider.value).toFixed(1) + 'x';
  });

  function openSettings() {
    document.getElementById('setting-pet-name').value = pet.petName;
    document.getElementById('setting-owner-name').value = pet.ownerName;

    // Set slider to current scale
    scaleSlider.value = pet.sprite.scale;
    scaleValueEl.textContent = pet.sprite.scale.toFixed(1) + 'x';

    settingsOverlay.querySelectorAll('.sprite-option').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.sprite === pet.currentSprite);
    });

    // Resize window to fit settings panel
    pet.appWindow.outerPosition().then(function(pos) {
      normalPos = pos;
      return pet.appWindow.innerSize();
    }).then(function(sz) {
      normalSize = sz;
      var scale = window.devicePixelRatio || 1;
      return pet.appWindow.setSize({
        type: 'Physical',
        width: Math.round(SETTINGS_SIZE.width * scale),
        height: Math.round(SETTINGS_SIZE.height * scale)
      });
    }).then(function() {
      // Re-center around the old position
      if (normalPos && normalSize) {
        var scale = window.devicePixelRatio || 1;
        var dx = Math.round((SETTINGS_SIZE.width * scale - normalSize.width) / 2);
        var dy = Math.round((SETTINGS_SIZE.height * scale - normalSize.height) / 2);
        pet.appWindow.setPosition({
          type: 'Physical',
          x: Math.max(0, normalPos.x - dx),
          y: Math.max(0, normalPos.y - dy)
        }).catch(function() {});
      }
    }).catch(function() {});

    settingsOverlay.classList.add('show');
    startPreviewAnimations();
  }

  function closeSettings() {
    var newPetName = document.getElementById('setting-pet-name').value.trim();
    var newOwnerName = document.getElementById('setting-owner-name').value.trim();

    if (newPetName && newPetName !== pet.petName) {
      pet.petName = newPetName;
      saveConfigField('pet_name', pet.petName);
      document.getElementById('chat-input').placeholder = 'Say something to ' + pet.petName + '...';
      pet.showBubble('call me ' + pet.petName + ' now!', 3000, true);
    }

    if (newOwnerName !== pet.ownerName) {
      pet.ownerName = newOwnerName;
      saveConfigField('owner_name', pet.ownerName);
    }

    // Apply new scale
    var newScale = parseFloat(scaleSlider.value);
    if (newScale !== pet.sprite.scale) {
      pet.sprite.setScale(newScale);
      saveConfigField('pet_scale', String(newScale));
    }

    settingsOverlay.classList.remove('show');
    stopPreviewAnimations();

    // Resize window to fit new pet size, then restore position
    if (normalPos) {
      pet.resizeWindowToFit().then(function() {
        return pet.appWindow.setPosition({ type: 'Physical', x: normalPos.x, y: normalPos.y });
      }).catch(function() {});
    }
  }

  // Animated idle previews for character selection
  function startPreviewAnimations() {
    stopPreviewAnimations();

    var previews = document.querySelectorAll('.sprite-preview');
    previewAnimators = Array.prototype.map.call(previews, function(cvs, index) {
      var animator = new SpriteAnimator(cvs, cvs.dataset.src, Object.assign(
        { scale: 1 },
        getSpriteRenderOptions(cvs.dataset.src.split('/').pop().replace(/\.png$/, ''))
      ));
      return {
        animator: animator,
        sequenceIndex: index % PREVIEW_SEQUENCE.length,
        nextTransitionAt: 0
      };
    });

    function queueNextPreviewState(entry, ts, force) {
      if (!force && ts < entry.nextTransitionAt) return;

      var step = PREVIEW_SEQUENCE[entry.sequenceIndex];
      entry.animator.setState(step.state);
      entry.nextTransitionAt = ts + step.duration;
      entry.sequenceIndex = (entry.sequenceIndex + 1) % PREVIEW_SEQUENCE.length;
    }

    function animate(ts) {
      if (!settingsOverlay.classList.contains('show')) return;

      previewAnimators.forEach(function(entry, index) {
        if (!entry.nextTransitionAt) {
          queueNextPreviewState(entry, ts + index * 220, true);
        } else {
          queueNextPreviewState(entry, ts, false);
        }
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

  document.getElementById('settings-close').addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', function(e) {
    if (e.target === settingsOverlay) closeSettings();
  });

  // Sprite selection in settings
  settingsOverlay.querySelectorAll('.sprite-option').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var spriteName = btn.dataset.sprite;
      if (spriteName !== pet.currentSprite) {
        pet.currentSprite = spriteName;
        pet.sprite.image.src = '/sprites/' + spriteName + '.png';
        pet.sprite.edgeClear = getSpriteRenderOptions(spriteName).edgeClear || 0;

        // Only suggest default name if user hasn't customized it
        var charInfo = CHARACTERS[spriteName] || CHARACTERS._default;
        var currentInput = document.getElementById('setting-pet-name').value.trim();
        var oldCharInfo = CHARACTERS[pet.currentSprite] || CHARACTERS._default;
        var nameIsDefault = !currentInput || currentInput === oldCharInfo.defaultName;

        saveConfigField('sprite', spriteName);

        if (nameIsDefault) {
          pet.petName = charInfo.defaultName;
          document.getElementById('setting-pet-name').value = charInfo.defaultName;
          document.getElementById('chat-input').placeholder = 'Say something to ' + pet.petName + '...';
          saveConfigField('pet_name', charInfo.defaultName);
          pet.showBubble('call me ' + charInfo.defaultName + '!', 2000, true);
        }
      }
      settingsOverlay.querySelectorAll('.sprite-option').forEach(function(b) {
        b.classList.toggle('active', b.dataset.sprite === pet.currentSprite);
      });
    });
  });

  // Keyboard shortcut for Inspect
  document.addEventListener('keydown', function(e) {
    if (e.metaKey && e.altKey && e.key === 'i') {
      if (window.__TAURI_INTERNALS__) {
        window.__TAURI_INTERNALS__.invoke('plugin:webview|internal_toggle_devtools');
      }
    }
    if (e.key === 'Escape' && settingsOverlay.classList.contains('show')) {
      closeSettings();
    }
  });
}
