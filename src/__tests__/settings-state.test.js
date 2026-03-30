import { describe, expect, it } from 'vitest';
import { normalizeSettingsPayload } from '../settings-state.js';

describe('normalizeSettingsPayload', function() {
  it('preserves provided fallback names when a payload omits them', function() {
    expect(normalizeSettingsPayload({}, {
      defaultPetName: 'Phoebe',
      defaultOwnerName: 'Ryan',
      defaultSprite: 'tabby_cat',
      defaultScale: 1.5,
      defaultAiProvider: 'claude',
    })).toMatchObject({
      petName: 'Phoebe',
      ownerName: 'Ryan',
    });
  });

  it('still allows explicitly clearing owner and pet names', function() {
    expect(normalizeSettingsPayload({
      petName: '',
      ownerName: '',
    }, {
      defaultPetName: 'Phoebe',
      defaultOwnerName: 'Ryan',
      defaultSprite: 'tabby_cat',
      defaultScale: 1.5,
      defaultAiProvider: 'claude',
    })).toMatchObject({
      petName: '',
      ownerName: '',
    });
  });
});
