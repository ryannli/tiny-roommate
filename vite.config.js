import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const requestedPort = Number(process.env.TAURI_DEV_PORT || process.env.PORT || 5173);
const hasFixedPort = Boolean(process.env.TAURI_DEV_PORT || process.env.PORT);

export default defineConfig({
  clearScreen: false,
  test: {
    server: {
      deps: {
        inline: ['@tauri-apps/plugin-shell', '@tauri-apps/api'],
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        bubble: resolve(__dirname, 'bubble.html'),
      },
    },
  },
  server: {
    port: requestedPort,
    strictPort: hasFixedPort,
  },
  envPrefix: ['VITE_', 'TAURI_'],
});
