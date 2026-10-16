import { describe, expect, it } from 'vitest';
import { applyStatusLayout, STATUS_UI_LAYOUT } from '../status-layout.js';

describe('status UI layout', function() {
  it('keeps the status block inside the outer top-right corner', function() {
    expect(STATUS_UI_LAYOUT).toEqual({
      top: 0,
      right: 0,
      gap: 3,
    });
  });

  it('applies the corner offsets as CSS variables', function() {
    document.documentElement.style.removeProperty('--pet-status-top');
    document.documentElement.style.removeProperty('--pet-status-right');
    document.documentElement.style.removeProperty('--pet-status-gap');

    applyStatusLayout(document);

    expect(document.documentElement.style.getPropertyValue('--pet-status-top')).toBe('0px');
    expect(document.documentElement.style.getPropertyValue('--pet-status-right')).toBe('0px');
    expect(document.documentElement.style.getPropertyValue('--pet-status-gap')).toBe('3px');
  });
});
