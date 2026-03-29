// Window managers: settings, context menu, chat, provider chooser
import { emitTo } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getSupportedAiProviders, saveConfigField } from './brain.js';

export function getDefaultScale() {
  var w = window.screen.availWidth;
  if (w < 1500) return 1.2;
  return 1.5;
}

export function initProviderChooser(pet) {
  var overlay = document.getElementById('provider-overlay');
  var optionsRoot = document.getElementById('startup-ai-provider-options');
  var selectionResolver = null;

  if (optionsRoot && !optionsRoot.dataset.initialized) {
    optionsRoot.dataset.initialized = 'true';
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
        pet.aiProvider = provider.id;
        syncActiveSelection();
        saveConfigField('ai_provider', provider.id);
        if (selectionResolver) {
          overlay.classList.remove('show');
          var resolve = selectionResolver;
          selectionResolver = null;
          resolve(provider.id);
        }
      });
      optionsRoot.appendChild(btn);
    });
  }

  function syncActiveSelection() {
    if (!optionsRoot) return;
    optionsRoot.querySelectorAll('.provider-option').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.provider === pet.aiProvider);
    });
  }

  return {
    ensureAiProviderSelected: function(currentProvider) {
      pet.aiProvider = currentProvider || '';
      syncActiveSelection();

      if (currentProvider) {
        return Promise.resolve(currentProvider);
      }

      if (!overlay) {
        return Promise.resolve('');
      }

      overlay.classList.add('show');
      return new Promise(function(resolve) {
        selectionResolver = resolve;
      });
    },
    syncAiProvider: function(provider) {
      pet.aiProvider = provider || '';
      syncActiveSelection();
    },
  };
}

// --- Settings window ---
var settingsWin = null;

export async function openSettingsWindow() {
  if (settingsWin) {
    settingsWin.setFocus().catch(function() {});
    return;
  }
  var url = new URL('./settings.html', window.location.href).toString();
  settingsWin = new WebviewWindow('settings', {
    url: url,
    title: 'Settings',
    width: 560,
    height: 700,
    resizable: false,
    decorations: false,
    transparent: false,
    alwaysOnTop: true,
    center: true,
  });
  settingsWin.once('tauri://destroyed', function() { settingsWin = null; });
}

// --- Context menu window ---
var menuWin = null;
var menuWinReady = false;

async function ensureMenuWindow() {
  if (menuWin && menuWinReady) return menuWin;
  var existing = await WebviewWindow.getByLabel('context-menu');
  if (existing) {
    menuWin = existing;
    menuWinReady = true;
    return menuWin;
  }

  var url = new URL('./context-menu.html', window.location.href).toString();
  menuWin = new WebviewWindow('context-menu', {
    url: url,
    title: '',
    width: 180,
    height: 120,
    visible: false,
    decorations: false,
    transparent: true,
    alwaysOnTop: true,
    shadow: false,
    resizable: false,
    skipTaskbar: true,
    focusable: true,
  });
  await new Promise(function(resolve) {
    menuWin.once('tauri://created', resolve);
    setTimeout(resolve, 1000);
  });
  menuWinReady = true;
  menuWin.once('tauri://destroyed', function() {
    menuWin = null;
    menuWinReady = false;
  });
  return menuWin;
}

export async function showContextMenu(screenXLogical, screenYLogical) {
  var menu = await ensureMenuWindow();
  var dpr = window.devicePixelRatio || 1;
  var menuW = 180;
  var menuH = 120;
  var x = Math.min(screenXLogical, window.screen.availWidth - menuW - 10);
  var y = screenYLogical - menuH;
  if (y < 5) y = screenYLogical + 5;
  y = Math.min(y, window.screen.availHeight - menuH - 10);
  await menu.setPosition({ type: 'Physical', x: Math.round(x * dpr), y: Math.round(y * dpr) });
  await menu.show();
  await menu.setFocus();
}

export function hideContextMenu() {
  if (menuWin) menuWin.hide().catch(function() {});
}

// --- Chat window ---
var chatWin = null;
var chatWinReady = false;

async function ensureChatWindow() {
  if (chatWin && chatWinReady) return chatWin;
  var existing = await WebviewWindow.getByLabel('chat');
  if (existing) {
    chatWin = existing;
    chatWinReady = true;
    return chatWin;
  }

  var url = new URL('./chat.html', window.location.href).toString();
  chatWin = new WebviewWindow('chat', {
    url: url,
    title: '',
    width: 260,
    height: 50,
    visible: false,
    decorations: false,
    transparent: true,
    alwaysOnTop: true,
    shadow: false,
    resizable: false,
    skipTaskbar: true,
    focusable: true,
  });
  await new Promise(function(resolve) {
    chatWin.once('tauri://created', resolve);
    setTimeout(resolve, 1000);
  });
  chatWinReady = true;
  chatWin.once('tauri://destroyed', function() {
    chatWin = null;
    chatWinReady = false;
  });
  return chatWin;
}

export async function openChatWindow(pet) {
  var chat = await ensureChatWindow();
  var pos = await pet.appWindow.outerPosition();
  var size = pet.sprite.getSize();
  var dpr = window.devicePixelRatio || 1;
  var chatW = 260;
  var chatH = 50;

  var xLogical = pos.x / dpr + size.width / 2 - chatW / 2;
  var yLogical = pos.y / dpr + size.height + 8;
  xLogical = Math.max(8, Math.min(window.screen.availWidth - chatW - 8, xLogical));
  yLogical = Math.min(window.screen.availHeight - chatH - 8, yLogical);

  await chat.setPosition({ type: 'Physical', x: Math.round(xLogical * dpr), y: Math.round(yLogical * dpr) });
  await chat.show();
  await emitTo('chat', 'chat:open', {
    placeholder: 'Say something to ' + pet.petName + '...',
  });
  await chat.setFocus();
}
