import { describe, it, expect, beforeEach } from 'vitest';
import { STATES, FRAME_W, FRAME_H, SHEET_FPS, SpriteAnimator, getSpriteRenderOptions } from '../sprite.js';

describe('STATES', () => {
  it('has all expected animation states', () => {
    var required = ['idle', 'walk', 'looking_around', 'sleep', 'work', 'playful', 'happy', 'sad', 'drag'];
    required.forEach(function(state) {
      expect(STATES[state], state + ' missing').toBeDefined();
    });
  });

  it('every state has row, frames, and loop properties', () => {
    Object.entries(STATES).forEach(function([name, state]) {
      expect(typeof state.row, name + '.row').toBe('number');
      expect(typeof state.frames, name + '.frames').toBe('number');
      expect(typeof state.loop, name + '.loop').toBe('boolean');
    });
  });

  it('all rows are within spritesheet bounds (0-8)', () => {
    Object.entries(STATES).forEach(function([name, state]) {
      expect(state.row, name + '.row out of bounds').toBeGreaterThanOrEqual(0);
      expect(state.row, name + '.row out of bounds').toBeLessThanOrEqual(8);
    });
  });

  it('all frame counts are positive and within column limit (<=8)', () => {
    Object.entries(STATES).forEach(function([name, state]) {
      expect(state.frames, name + '.frames').toBeGreaterThan(0);
      expect(state.frames, name + '.frames exceeds cols').toBeLessThanOrEqual(8);
    });
  });

  it('has LLM-compat aliases', () => {
    expect(STATES.talk).toBeDefined();
    expect(STATES.sick).toBeDefined();
    expect(STATES.celebrate).toBeDefined();
  });

  it('aliases point to valid rows', () => {
    expect(STATES.talk.row).toBe(STATES.looking_around.row);
    expect(STATES.sick.row).toBe(STATES.sad.row);
    expect(STATES.celebrate.row).toBe(STATES.happy.row);
  });
});

describe('SpriteAnimator', () => {
  var canvas;

  beforeEach(function() {
    canvas = document.createElement('canvas');
  });

  it('initializes with default scale 1.5', function() {
    var anim = new SpriteAnimator(canvas, '/test.png');
    expect(anim.scale).toBe(1.5);
  });

  it('initializes with custom scale', function() {
    var anim = new SpriteAnimator(canvas, '/test.png', { scale: 2 });
    expect(anim.scale).toBe(2);
  });

  it('sets canvas dimensions based on scale', function() {
    var anim = new SpriteAnimator(canvas, '/test.png', { scale: 1.5 });
    expect(canvas.width).toBe(FRAME_W * 1.5);
    expect(canvas.height).toBe(FRAME_H * 1.5);
  });

  it('setScale updates scale and canvas dimensions', function() {
    var anim = new SpriteAnimator(canvas, '/test.png', { scale: 1 });
    anim.setScale(2);
    expect(anim.scale).toBe(2);
    expect(canvas.width).toBe(FRAME_W * 2);
    expect(canvas.height).toBe(FRAME_H * 2);
  });

  it('getSize returns correct logical dimensions', function() {
    var anim = new SpriteAnimator(canvas, '/test.png', { scale: 1.5 });
    var size = anim.getSize();
    expect(size.width).toBe(FRAME_W * 1.5);
    expect(size.height).toBe(FRAME_H * 1.5);
  });

  it('getSize reflects updated scale after setScale', function() {
    var anim = new SpriteAnimator(canvas, '/test.png', { scale: 1 });
    anim.setScale(2.5);
    var size = anim.getSize();
    expect(size.width).toBe(FRAME_W * 2.5);
    expect(size.height).toBe(FRAME_H * 2.5);
  });

  it('starts in idle state', function() {
    var anim = new SpriteAnimator(canvas, '/test.png');
    expect(anim.state).toBe('idle');
  });

  it('setState changes state', function() {
    var anim = new SpriteAnimator(canvas, '/test.png');
    anim.setState('walk');
    expect(anim.state).toBe('walk');
  });

  it('setState ignores unknown states', function() {
    var anim = new SpriteAnimator(canvas, '/test.png');
    anim.setState('nonexistent');
    expect(anim.state).toBe('idle');
  });

  it('setState with onFinish callback stores it', function() {
    var anim = new SpriteAnimator(canvas, '/test.png');
    var cb = function() {};
    anim.setState('happy', cb);
    expect(anim.onFinish).toBe(cb);
  });

  it('re-setting same looping state is a no-op', function() {
    var anim = new SpriteAnimator(canvas, '/test.png');
    anim.setState('walk');
    anim.frame = 3;
    anim.setState('walk'); // same looping state - should not reset frame
    expect(anim.frame).toBe(3);
  });

  it('edgeClear defaults to 0', function() {
    var anim = new SpriteAnimator(canvas, '/test.png');
    expect(anim.edgeClear).toBe(0);
  });

  it('edgeClear is set from options', function() {
    var anim = new SpriteAnimator(canvas, '/test.png', { edgeClear: 3 });
    expect(anim.edgeClear).toBe(3);
  });
});

describe('getSpriteRenderOptions', () => {
  it('returns empty object for unknown sprite', function() {
    var opts = getSpriteRenderOptions('nonexistent');
    expect(opts).toEqual({});
  });

  it('returns edgeClear for golden_retriever', function() {
    var opts = getSpriteRenderOptions('golden_retriever');
    expect(opts.edgeClear).toBeDefined();
    expect(opts.edgeClear).toBeGreaterThan(0);
  });
});

describe('constants', () => {
  it('FRAME_W and FRAME_H are positive', function() {
    expect(FRAME_W).toBeGreaterThan(0);
    expect(FRAME_H).toBeGreaterThan(0);
  });

  it('SHEET_FPS is reasonable (1-30)', function() {
    expect(SHEET_FPS).toBeGreaterThanOrEqual(1);
    expect(SHEET_FPS).toBeLessThanOrEqual(30);
  });
});
