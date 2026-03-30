export function resolveSettingsScale(scale, fallbackScale) {
  var parsedScale = parseFloat(scale);
  if (Number.isFinite(parsedScale) && parsedScale > 0) {
    return parsedScale;
  }

  var parsedFallback = parseFloat(fallbackScale);
  if (Number.isFinite(parsedFallback) && parsedFallback > 0) {
    return parsedFallback;
  }

  return 1.5;
}

export function resolveAiProvider(provider, fallbackProvider) {
  var normalized = String(provider || '').trim().toLowerCase();
  if (normalized === 'claude' || normalized === 'gemini') {
    return normalized;
  }

  var fallback = String(fallbackProvider || '').trim().toLowerCase();
  if (fallback === 'claude' || fallback === 'gemini') {
    return fallback;
  }

  return 'claude';
}

export function normalizeSettingsPayload(payload, options) {
  payload = payload || {};
  options = options || {};

  return {
    petName: payload.petName !== undefined ? payload.petName : (options.defaultPetName || ''),
    ownerName: payload.ownerName !== undefined ? payload.ownerName : (options.defaultOwnerName || ''),
    sprite: payload.sprite || options.defaultSprite || 'tabby_cat',
    scale: resolveSettingsScale(payload.scale, options.defaultScale),
    aiProvider: resolveAiProvider(payload.aiProvider, options.defaultAiProvider),
  };
}

export function buildSettingsSaveFields(update, current, defaultScale) {
  var currentState = normalizeSettingsPayload(current, {
    defaultScale: defaultScale,
  });
  var nextState = normalizeSettingsPayload({
    petName: update && update.petName !== undefined ? update.petName : currentState.petName,
    ownerName: update && update.ownerName !== undefined ? update.ownerName : currentState.ownerName,
    sprite: update && update.sprite ? update.sprite : currentState.sprite,
    scale: update && update.scale !== undefined ? update.scale : currentState.scale,
    aiProvider: update && update.aiProvider ? update.aiProvider : currentState.aiProvider,
  }, {
    defaultScale: currentState.scale,
    defaultSprite: currentState.sprite,
    defaultAiProvider: currentState.aiProvider,
  });

  return {
    pet_name: nextState.petName,
    owner_name: nextState.ownerName,
    sprite: nextState.sprite,
    pet_scale: String(nextState.scale),
    ai_provider: nextState.aiProvider,
  };
}
