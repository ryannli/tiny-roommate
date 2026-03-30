// Chat input window — runs inside chat.html
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit, listen } from '@tauri-apps/api/event';

var appWindow = getCurrentWindow();
var input = document.getElementById('chat-input');
var hideTimer = null;
var blurEnabled = false;

function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function hideWindow() {
  clearHideTimer();
  input.value = '';
  appWindow.hide().catch(function() {});
}

// Refresh placeholder and focus when shown
listen('chat:open', function(event) {
  clearHideTimer();
  blurEnabled = false;
  input.placeholder = (event.payload && event.payload.placeholder) || 'Say something...';
  input.value = '';
  input.focus();
});

// Re-focus input when window gets focus (don't clear value — user may have typed)
appWindow.listen('tauri://focus', function() {
  clearHideTimer();
  blurEnabled = false;
  setTimeout(function() { blurEnabled = true; }, 250);
  input.focus();
});

input.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    var text = input.value.trim();
    input.value = '';
    // Hide after emitTo completes so the event isn't lost
    emit('chat:submit', { text: text }).then(function() {
      appWindow.hide().catch(function() {});
    });
  }
  if (e.key === 'Escape') {
    hideWindow();
  }
});

// Hide when the chat window itself loses focus.
window.addEventListener('blur', function() {
  if (!blurEnabled) return;
  clearHideTimer();
  hideTimer = setTimeout(function() {
    hideTimer = null;
    hideWindow();
  }, 200);
});
