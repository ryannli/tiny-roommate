import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const envPort = Number(process.env.TAURI_DEV_PORT || process.env.PORT);
const hasFixedPort = Number.isInteger(envPort) && envPort > 0 && envPort < 65536;
const requestedPort = hasFixedPort ? envPort : 5173;

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
        settings: resolve(__dirname, 'settings.html'),
        chat: resolve(__dirname, 'chat.html'),
        'context-menu': resolve(__dirname, 'context-menu.html'),
      },
    },
  },
  server: {
    port: requestedPort,
    strictPort: hasFixedPort,
  },
  envPrefix: ['VITE_', 'TAURI_'],
});
