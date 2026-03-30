import { describe, expect, it } from 'vitest';
import { buildSpritePreviewPayload, resolveImmediateSpriteSource } from '../sprite-preview.js';

describe('buildSpritePreviewPayload', function() {
  it('keeps built-in sprite previews lightweight', function() {
    expect(buildSpritePreviewPayload('tabby_cat', 'data:image/png;base64,abc')).toEqual({
      sprite: 'tabby_cat',
    });
  });

  it('includes cached data for custom sprite previews', function() {
    expect(buildSpritePreviewPayload('custom_123', 'data:image/png;base64,abc')).toEqual({
      sprite: 'custom_123',
      dataUrl: 'data:image/png;base64,abc',
    });
  });
});

describe('resolveImmediateSpriteSource', function() {
  it('returns static asset paths for built-in sprites', function() {
    expect(resolveImmediateSpriteSource('tabby_cat')).toBe('/sprites/tabby_cat.png');
  });

  it('returns cached data URLs for custom sprites', function() {
    expect(resolveImmediateSpriteSource('custom_123', 'data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  it('requires a cached data URL for immediate custom previews', function() {
    expect(resolveImmediateSpriteSource('custom_123')).toBeNull();
  });
});
