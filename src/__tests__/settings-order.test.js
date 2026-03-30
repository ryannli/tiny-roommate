import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('settings panel order', function() {
  it('keeps Pet Name and Call me in the same top row', function() {
    var html = readFileSync(resolve(process.cwd(), 'settings.html'), 'utf8');
    var rowIndex = html.indexOf('<div class="settings-section settings-section-row">');
    var nextSectionIndex = html.indexOf('<div class="settings-section">', rowIndex + 1);
    var petNameIndex = html.indexOf('id="setting-pet-name"');
    var ownerNameIndex = html.indexOf('id="setting-owner-name"');

    expect(rowIndex).toBeGreaterThanOrEqual(0);
    expect(nextSectionIndex).toBeGreaterThan(rowIndex);
    expect(petNameIndex).toBeGreaterThan(rowIndex);
    expect(ownerNameIndex).toBeGreaterThan(rowIndex);
    expect(petNameIndex).toBeLessThan(nextSectionIndex);
    expect(ownerNameIndex).toBeLessThan(nextSectionIndex);
  });

  it('places AI Provider before Character selection', function() {
    var html = readFileSync(resolve(process.cwd(), 'settings.html'), 'utf8');
    var providerIndex = html.indexOf('<label>AI Provider</label>');
    var characterIndex = html.indexOf('<label>Character</label>');

    expect(providerIndex).toBeGreaterThanOrEqual(0);
    expect(characterIndex).toBeGreaterThanOrEqual(0);
    expect(providerIndex).toBeLessThan(characterIndex);
  });
});
