export const STATUS_UI_LAYOUT = Object.freeze({
  top: -4,
  right: 0,
  gap: 3,
});

export function applyStatusLayout(doc) {
  var root = (doc || document).documentElement;
  root.style.setProperty('--pet-status-top', STATUS_UI_LAYOUT.top + 'px');
  root.style.setProperty('--pet-status-right', STATUS_UI_LAYOUT.right + 'px');
  root.style.setProperty('--pet-status-gap', STATUS_UI_LAYOUT.gap + 'px');
}
