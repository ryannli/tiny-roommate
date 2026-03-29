// Chat input window — runs inside chat.html
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emitTo, listen } from '@tauri-apps/api/event';

var appWindow = getCurrentWindow();
var input = document.getElementById('chat-input');
var hideTimer = null;

function hideWindow() {
  input.value = '';
  appWindow.hide().catch(function() {});
}

// Refresh placeholder and focus when shown
listen('chat:open', function(event) {
  input.placeholder = (event.payload && event.payload.placeholder) || 'Say something...';
  input.value = '';
  input.focus();
});

// Re-focus input when window gets focus (don't clear value — user may have typed)
appWindow.listen('tauri://focus', function() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  input.focus();
});

input.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    var text = input.value.trim();
    input.value = '';
    // Hide after emitTo completes so the event isn't lost
    emitTo('main', 'chat:submit', { text: text }).then(function() {
      appWindow.hide().catch(function() {});
    });
  }
  if (e.key === 'Escape') {
    hideWindow();
  }
});

// Hide when input loses focus (user clicked outside the chat window)
input.addEventListener('blur', function() {
  hideTimer = setTimeout(function() {
    hideTimer = null;
    hideWindow();
  }, 200);
});
