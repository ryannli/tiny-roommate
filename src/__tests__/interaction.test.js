import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initInteraction } from '../interaction.js';

describe('interaction rules', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    document.body.innerHTML = '<img id="pet-hand" />';
  });

  afterEach(function() {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('stops autonomous walking on a single click', async function() {
    var canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    var pet = {
      canvas: canvas,
      appWindow: {
        startDragging: vi.fn().mockResolvedValue(undefined),
      },
      sprite: {
        setState: vi.fn(),
      },
      showBubble: vi.fn(),
      voice: function() {
        return {
          petHold: 'hold',
          petLines: ['pet'],
          petFallback: 'pet fallback',
          tapLines: ['tap'],
          tapFallback: 'tap fallback',
        };
      },
      gainHeart: vi.fn(),
      lastScreenContext: null,
      llmBusy: false,
      isWalking: true,
      dragStarted: false,
      lastInteractionTime: 0,
    };

    initInteraction(pet);

    canvas.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      screenX: 10,
      screenY: 10,
      clientX: 10,
      clientY: 10,
    }));
    canvas.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      button: 0,
      screenX: 10,
      screenY: 10,
      clientX: 10,
      clientY: 10,
    }));

    await vi.advanceTimersByTimeAsync(301);

    expect(pet.isWalking).toBe(false);
    expect(pet.sprite.setState).toHaveBeenCalledWith('idle');
  });
});
