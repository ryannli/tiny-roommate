import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('settings panel order', function() {
  it('places AI Provider before Character selection', function() {
    var html = readFileSync(resolve(process.cwd(), 'settings.html'), 'utf8');
    var providerIndex = html.indexOf('<label>AI Provider</label>');
    var characterIndex = html.indexOf('<label>Character</label>');

    expect(providerIndex).toBeGreaterThanOrEqual(0);
    expect(characterIndex).toBeGreaterThanOrEqual(0);
    expect(providerIndex).toBeLessThan(characterIndex);
  });
});
