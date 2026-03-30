import { isCustomSpriteKey } from './sprite-keys.js';

export function buildSpritePreviewPayload(spriteKey, dataUrl) {
  var payload = { sprite: spriteKey };
  if (isCustomSpriteKey(spriteKey) && dataUrl) {
    payload.dataUrl = dataUrl;
  }
  return payload;
}

export function resolveImmediateSpriteSource(spriteKey, dataUrl) {
  if (!spriteKey) return null;
  if (isCustomSpriteKey(spriteKey)) {
    return dataUrl || null;
  }
  return '/sprites/' + spriteKey + '.png';
}
