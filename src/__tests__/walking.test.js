import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initBehavior } from '../behavior.js';
import { monitorFromPoint } from '@tauri-apps/api/window';

vi.mock('@tauri-apps/api/window', function() {
  return { monitorFromPoint: vi.fn() };
});

describe('walking across monitor work areas', function() {
  var frames;
  var now;

  beforeEach(function() {
    frames = [];
    now = 0;
    vi.stubGlobal('requestAnimationFrame', function(frame) { frames.push(frame); });
    vi.spyOn(performance, 'now').mockImplementation(function() { return now; });
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(function() {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function walk(position, scale, workArea) {
    monitorFromPoint.mockResolvedValue({ scaleFactor: scale, workArea: workArea });
    var pet = {
      canvas: { style: {} },
      appWindow: {
        outerPosition: vi.fn().mockResolvedValue(position),
        scaleFactor: vi.fn().mockResolvedValue(scale),
        setPosition: vi.fn().mockResolvedValue(undefined),
      },
      sprite: {
        getSize: function() { return { width: 128, height: 128 }; },
        setState: vi.fn(),
      },
      isWalking: false,
      isSick: false,
      lastInteractionTime: Date.now(),
    };
    await initBehavior(pet).walkRandomDirection();
    for (var i = 0; frames.length && i < 20; i++) {
      now += 1000;
      frames.shift()();
    }
    return pet;
  }

  it('does not double the starting position at DPR 2', async function() {
    var area = { position: { x: 0, y: 0 }, size: { width: 2880, height: 1800 } };
    var pet = await walk({ x: 1000, y: 600 }, 2, area);
    expect(monitorFromPoint).toHaveBeenCalledWith(1128, 728);
    expect(pet.appWindow.setPosition.mock.calls[0][0]).toEqual({ type: 'Physical', x: 1000, y: 600 });
    expect(pet.appWindow.setPosition.mock.lastCall[0]).toEqual({ type: 'Physical', x: 1160, y: 600 });
    expect(pet.isWalking).toBe(false);
  });

  it.each([
    [{ x: -600, y: 300 }, { position: { x: -1920, y: 40 }, size: { width: 1920, height: 1040 } }],
    [{ x: 2600, y: 500 }, { position: { x: 2560, y: 0 }, size: { width: 1920, height: 1080 } }],
    [{ x: 500, y: 2400 }, { position: { x: 0, y: 2160 }, size: { width: 1920, height: 1080 } }],
  ])('keeps every frame on an offset monitor', async function(position, area) {
    var pet = await walk(position, 1, area);
    pet.appWindow.setPosition.mock.calls.forEach(function(args) {
      var frame = args[0];
      expect(frame.type).toBe('Physical');
      expect(frame.x).toBeGreaterThanOrEqual(area.position.x);
      expect(frame.y).toBeGreaterThanOrEqual(area.position.y);
      expect(frame.x + 128).toBeLessThanOrEqual(area.position.x + area.size.width);
      expect(frame.y + 128).toBeLessThanOrEqual(area.position.y + area.size.height);
    });
  });

  it('clamps against the taskbar work area instead of the full display', async function() {
    var area = { position: { x: 0, y: 40 }, size: { width: 1920, height: 1000 } };
    var pet = await walk({ x: 1740, y: 880 }, 1, area);
    var last = pet.appWindow.setPosition.mock.lastCall[0];
    expect(last.x + 128).toBeLessThanOrEqual(1890);
    expect(last.y + 128).toBeLessThanOrEqual(1010);
  });

  it('keeps normal-DPI walking distance unchanged', async function() {
    var area = { position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 } };
    var pet = await walk({ x: 500, y: 300 }, 1, area);
    expect(pet.appWindow.setPosition.mock.lastCall[0]).toEqual({ type: 'Physical', x: 580, y: 300 });
  });
});
