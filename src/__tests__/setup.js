// Vitest global setup — mock Tauri APIs that don't exist in jsdom

import { vi } from 'vitest';

// Stub window.__TAURI_INTERNALS__ so Tauri API modules don't crash on import
window.__TAURI_INTERNALS__ = {
  invoke: vi.fn().mockResolvedValue(null),
  transformCallback: vi.fn((cb) => { cb(null); return 0; }),
  metadata: { currentWindow: { label: 'main' } },
};

// Mock @tauri-apps/api/window
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    setSize: vi.fn().mockResolvedValue(undefined),
    setPosition: vi.fn().mockResolvedValue(undefined),
    outerPosition: vi.fn().mockResolvedValue({ x: 800, y: 400 }),
    innerSize: vi.fn().mockResolvedValue({ width: 192, height: 192 }),
    close: vi.fn(),
    hide: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
    setFocus: vi.fn().mockResolvedValue(undefined),
    listen: vi.fn().mockResolvedValue(vi.fn()),
    once: vi.fn(),
    setIgnoreCursorEvents: vi.fn().mockResolvedValue(undefined),
    startDragging: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: vi.fn().mockImplementation(() => ({
    setPosition: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    setFocus: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    once: vi.fn(),
    listen: vi.fn().mockResolvedValue(vi.fn()),
  })),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
  emitTo: vi.fn().mockResolvedValue(undefined),
  emit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: {
    create: vi.fn(() => ({
      execute: vi.fn().mockResolvedValue({ stdout: '', stderr: '', code: 0 }),
    })),
  },
}));

// Canvas mock (jsdom doesn't implement canvas rendering)
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })),
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'high',
  fillRect: vi.fn(),
  clearRect: vi.fn(),
}));
