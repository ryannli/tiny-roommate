// Window managers: settings, context menu, chat
import { emitTo } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export function getDefaultScale() {
  var w = window.screen.availWidth;
  if (w < 1500) return 1.2;
  return 1.5;
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
    height: 640,
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
  if (existing) { menuWin = existing; menuWinReady = true; return menuWin; }

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
  menuWin.once('tauri://destroyed', function() { menuWin = null; menuWinReady = false; });
  return menuWin;
}

export async function showContextMenu(screenXLogical, screenYLogical) {
  var menu = await ensureMenuWindow();
  var dpr = window.devicePixelRatio || 1;
  var menuW = 180, menuH = 120;
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
  if (existing) { chatWin = existing; chatWinReady = true; return chatWin; }

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
  chatWin.once('tauri://destroyed', function() { chatWin = null; chatWinReady = false; });
  return chatWin;
}

export async function openChatWindow(pet) {
  var chat = await ensureChatWindow();
  var pos = await pet.appWindow.outerPosition();
  var size = pet.sprite.getSize();
  var dpr = window.devicePixelRatio || 1;
  var chatW = 260, chatH = 50;

  // Center below pet
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
