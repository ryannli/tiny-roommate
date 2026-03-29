import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createDevConfig, findOpenPort, parsePort } = require('../../scripts/run-tauri.cjs');

describe('run-tauri helpers', () => {
  it('accepts only valid integer ports', () => {
    expect(parsePort('5173')).toBe(5173);
    expect(parsePort('0')).toBeNull();
    expect(parsePort('abc')).toBeNull();
    expect(parsePort('65536')).toBeNull();
  });

  it('keeps Vite and Tauri on the same host and port', () => {
    expect(createDevConfig('127.0.0.1', 5180)).toEqual({
      devUrl: 'http://127.0.0.1:5180',
      beforeDevCommand: 'npm run dev -- --host 127.0.0.1 --port 5180 --strictPort',
    });
  });

  it('advances until a free port is found', async () => {
    const seen = [];
    const port = await findOpenPort(5173, '127.0.0.1', {
      maxAttempts: 4,
      probePort: async (candidate) => {
        seen.push(candidate);
        return candidate === 5175;
      },
    });

    expect(port).toBe(5175);
    expect(seen).toEqual([5173, 5174, 5175]);
  });

  it('throws when no free port is found', async () => {
    await expect(findOpenPort(5173, '127.0.0.1', {
      maxAttempts: 2,
      probePort: async () => false,
    })).rejects.toThrow('No open port found between 5173 and 5174.');
  });
});
