#!/usr/bin/env node

const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DEFAULT_PORT = 5173;
const MAX_PORT_ATTEMPTS = 25;
const DEFAULT_HOST = '127.0.0.1';

function parsePort(value) {
  if (!value) return null;
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

function isPortAvailable(port, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.unref();
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
        resolve(false);
        return;
      }
      reject(error);
    });

    server.listen({ port, host }, () => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(true);
      });
    });
  });
}

async function findOpenPort(startPort, host, options = {}) {
  const maxAttempts = options.maxAttempts || MAX_PORT_ATTEMPTS;
  const probePort = options.probePort || isPortAvailable;

  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = startPort + offset;
    if (await probePort(port, host)) {
      return port;
    }
  }

  throw new Error(`No open port found between ${startPort} and ${startPort + maxAttempts - 1}.`);
}

function createDevConfig(host, port) {
  return {
    devUrl: `http://${host}:${port}`,
    beforeDevCommand: `npm run dev -- --host ${host} --port ${port} --strictPort`,
  };
}

function runTauri(args, env = process.env) {
  const cliPath = path.join(__dirname, '..', 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
  const child = spawn(process.execPath, [cliPath, ...args], {
    stdio: 'inherit',
    env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

async function main(args = process.argv.slice(2), env = process.env) {
  if (args[0] !== 'dev') {
    runTauri(args, env);
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    runTauri(args, env);
    return;
  }

  const explicitPort = parsePort(env.TAURI_DEV_PORT || env.PORT);
  const host = env.TAURI_DEV_HOST || DEFAULT_HOST;
  const port = explicitPort ?? (await findOpenPort(DEFAULT_PORT, host));
  const build = createDevConfig(host, port);
  const configOverride = JSON.stringify({
    build,
  });

  if (!explicitPort) {
    console.log(`[tauri] using dev server ${build.devUrl}`);
  }

  runTauri(['dev', '-c', configOverride, ...args.slice(1)], {
    ...env,
    TAURI_DEV_PORT: String(port),
    TAURI_DEV_HOST: host,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_HOST,
  DEFAULT_PORT,
  MAX_PORT_ATTEMPTS,
  createDevConfig,
  findOpenPort,
  isPortAvailable,
  main,
  parsePort,
};
