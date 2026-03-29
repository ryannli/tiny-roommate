// Chat input window — runs inside chat.html
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emitTo, listen } from '@tauri-apps/api/event';

var appWindow = getCurrentWindow();
var input = document.getElementById('chat-input');

// Refresh placeholder and focus when shown
listen('chat:open', function(event) {
  input.placeholder = (event.payload && event.payload.placeholder) || 'Say something...';
  input.value = '';
  input.focus();
});

// Also focus on window focus event (covers initial open)
appWindow.listen('tauri://focus', function() {
  input.value = '';
  input.focus();
});

input.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    var text = input.value.trim();
    input.value = '';
    emitTo('main', 'chat:submit', { text: text });
    appWindow.hide().catch(function() {});
  }
  if (e.key === 'Escape') {
    input.value = '';
    appWindow.hide().catch(function() {});
  }
});

input.addEventListener('blur', function() {
  // Small delay so mousedown on other elements fires first
  setTimeout(function() {
    input.value = '';
    appWindow.hide().catch(function() {});
  }, 150);
});
