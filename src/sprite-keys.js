export var CUSTOM_SPRITE_PREFIX = 'custom_';

export function isCustomSpriteKey(key) {
  return !!key && key.indexOf(CUSTOM_SPRITE_PREFIX) === 0;
}
