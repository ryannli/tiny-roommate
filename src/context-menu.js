// Context menu window — runs inside context-menu.html
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emitTo } from '@tauri-apps/api/event';

var appWindow = getCurrentWindow();

function action(name) {
  emitTo('main', 'contextmenu:action', { action: name });
  appWindow.hide().catch(function() {});
}

// Use mousedown so action fires before blur hides the window
document.getElementById('menu-settings').addEventListener('mousedown', function() { action('settings'); });
document.getElementById('menu-inspect').addEventListener('mousedown', function() { action('inspect'); });
document.getElementById('menu-quit').addEventListener('mousedown', function() { action('quit'); });

// Close when window loses focus (user clicked elsewhere)
window.addEventListener('blur', function() {
  appWindow.hide().catch(function() {});
});
