// Sprite sheet animator
// Grid: 8 columns x 9 rows, each frame 128x128px
// Sheet: configurable sprite sheet, defaulting to tappy_cat_v2.png

export const FRAME_W = 128;
export const FRAME_H = 128;
const COLS = 8;
const ROWS = 9;
export const SHEET_FPS = 6;
const FRAME_BLEED_PAD = 1;
const DEFAULT_EDGE_CLEAR = 0;

export const SPRITE_RENDER_OVERRIDES = {
  golden_retriever: { edgeClear: 2 },
};

export function getSpriteRenderOptions(spriteName) {
  return SPRITE_RENDER_OVERRIDES[spriteName] || {};
}

// 9-state sprite sheet (8 columns × 9 rows)
export const STATES = {
  idle:           { row: 0, frames: 8, loop: true },
  walk:           { row: 1, frames: 8, loop: true },
  looking_around: { row: 2, frames: 8, loop: true },
  sleep:          { row: 3, frames: 8, loop: true },
  work:           { row: 4, frames: 8, loop: true },
  playful:        { row: 5, frames: 8, loop: false },
  happy:          { row: 6, frames: 8, loop: false },
  sad:            { row: 7, frames: 8, loop: true },
  drag:           { row: 8, frames: 8, loop: true },
  // Aliases for LLM output compat
  talk:           { row: 2, frames: 8, loop: true },
  sick:           { row: 7, frames: 8, loop: true },
  celebrate:      { row: 6, frames: 8, loop: false },
};

export class SpriteAnimator {
  constructor(canvas, imageSrc, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image = new Image();
    this.image.src = imageSrc;
    this.loaded = false;
    this.state = options.initialState || 'idle';
    this.frame = 0;
    this.lastFrameTime = 0;
    this.onFinish = null;
    this.scale = typeof options.scale === 'number' ? options.scale : 1.5;
    this.edgeClear = Math.max(0, Math.floor(
      typeof options.edgeClear === 'number' ? options.edgeClear : DEFAULT_EDGE_CLEAR
    ));
    this.frameCache = [];

    this.canvas.width = FRAME_W * this.scale;
    this.canvas.height = FRAME_H * this.scale;

    this.image.onload = () => {
      this.buildFrameCache();
      this.loaded = true;
    };
  }

  setState(name, onFinish = null) {
    if (!STATES[name]) return;
    if (name === this.state && STATES[name].loop) return;
    this.state = name;
    this.frame = 0;
    this.lastFrameTime = 0;
    this.onFinish = onFinish;
  }

  update(timestamp) {
    if (!this.loaded) return;

    const stateInfo = STATES[this.state];
    if (!stateInfo) return;

    if (timestamp - this.lastFrameTime > 1000 / SHEET_FPS) {
      this.lastFrameTime = timestamp;
      this.frame++;

      if (this.frame >= stateInfo.frames) {
        if (stateInfo.loop) {
          this.frame = 0;
        } else {
          this.frame = stateInfo.frames - 1;
          if (this.onFinish) {
            const cb = this.onFinish;
            this.onFinish = null;
            cb();
          }
        }
      }
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    const frameImage = this.frameCache[stateInfo.row] && this.frameCache[stateInfo.row][this.frame];
    if (!frameImage) return;

    this.ctx.drawImage(
      frameImage,
      FRAME_BLEED_PAD, FRAME_BLEED_PAD, FRAME_W, FRAME_H,
      0, 0, FRAME_W * this.scale, FRAME_H * this.scale
    );
  }

  setScale(newScale) {
    this.scale = newScale;
    this.canvas.width = FRAME_W * this.scale;
    this.canvas.height = FRAME_H * this.scale;
  }

  getSize() {
    return { width: FRAME_W * this.scale, height: FRAME_H * this.scale };
  }

  buildFrameCache() {
    this.frameCache = [];

    for (let row = 0; row < ROWS; row++) {
      const frames = [];
      for (let col = 0; col < COLS; col++) {
        frames.push(this.extractFrame(col, row));
      }
      this.frameCache.push(frames);
    }
  }

  extractFrame(col, row) {
    const sx = col * FRAME_W;
    const sy = row * FRAME_H;
    const canvas = document.createElement('canvas');
    const size = FRAME_W + FRAME_BLEED_PAD * 2;
    canvas.width = size;
    canvas.height = FRAME_H + FRAME_BLEED_PAD * 2;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Center frame.
    ctx.drawImage(
      this.image,
      sx, sy, FRAME_W, FRAME_H,
      FRAME_BLEED_PAD, FRAME_BLEED_PAD, FRAME_W, FRAME_H
    );

    // Extrude edges outward so scaled sampling cannot pull in the neighboring frame.
    ctx.drawImage(
      this.image,
      sx, sy, 1, FRAME_H,
      0, FRAME_BLEED_PAD, FRAME_BLEED_PAD, FRAME_H
    );
    ctx.drawImage(
      this.image,
      sx + FRAME_W - 1, sy, 1, FRAME_H,
      FRAME_BLEED_PAD + FRAME_W, FRAME_BLEED_PAD, FRAME_BLEED_PAD, FRAME_H
    );
    ctx.drawImage(
      this.image,
      sx, sy, FRAME_W, 1,
      FRAME_BLEED_PAD, 0, FRAME_W, FRAME_BLEED_PAD
    );
    ctx.drawImage(
      this.image,
      sx, sy + FRAME_H - 1, FRAME_W, 1,
      FRAME_BLEED_PAD, FRAME_BLEED_PAD + FRAME_H, FRAME_W, FRAME_BLEED_PAD
    );

    // Corners.
    ctx.drawImage(this.image, sx, sy, 1, 1, 0, 0, FRAME_BLEED_PAD, FRAME_BLEED_PAD);
    ctx.drawImage(
      this.image,
      sx + FRAME_W - 1, sy, 1, 1,
      FRAME_BLEED_PAD + FRAME_W, 0, FRAME_BLEED_PAD, FRAME_BLEED_PAD
    );
    ctx.drawImage(
      this.image,
      sx, sy + FRAME_H - 1, 1, 1,
      0, FRAME_BLEED_PAD + FRAME_H, FRAME_BLEED_PAD, FRAME_BLEED_PAD
    );
    ctx.drawImage(
      this.image,
      sx + FRAME_W - 1, sy + FRAME_H - 1, 1, 1,
      FRAME_BLEED_PAD + FRAME_W, FRAME_BLEED_PAD + FRAME_H, FRAME_BLEED_PAD, FRAME_BLEED_PAD
    );

    this.clearFrameEdges(ctx);

    return canvas;
  }

  clearFrameEdges(ctx) {
    if (!this.edgeClear) return;

    const border = Math.min(this.edgeClear, Math.floor(FRAME_W / 2), Math.floor(FRAME_H / 2));
    const x = FRAME_BLEED_PAD;
    const y = FRAME_BLEED_PAD;

    ctx.clearRect(x, y, FRAME_W, border);
    ctx.clearRect(x, y + FRAME_H - border, FRAME_W, border);
    ctx.clearRect(x, y, border, FRAME_H);
    ctx.clearRect(x + FRAME_W - border, y, border, FRAME_H);
  }
}
