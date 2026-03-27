#!/usr/bin/env node

const { spawn } = require('node:child_process');
const { execFileSync } = require('node:child_process');

const DEFAULT_PORT = 5173;
const MAX_PORT_ATTEMPTS = 25;

function parsePort(value) {
  if (!value) return null;
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

function isPortAvailable(port) {
  if (process.platform === 'win32') {
    return true;
  }

  try {
    execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
      stdio: 'ignore',
    });
    return false;
  } catch (error) {
    return error.status === 1;
  }
}

async function findOpenPort(startPort) {
  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
    const port = startPort + offset;
    if (isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No open port found between ${startPort} and ${startPort + MAX_PORT_ATTEMPTS - 1}.`);
}

function runTauri(args, env = process.env) {
  const child = spawn('./node_modules/.bin/tauri', args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] !== 'dev') {
    runTauri(args);
    return;
  }

  const explicitPort = parsePort(process.env.TAURI_DEV_PORT || process.env.PORT);
  const port = explicitPort ?? (await findOpenPort(DEFAULT_PORT));
  const host = process.env.TAURI_DEV_HOST || '127.0.0.1';
  const devUrl = `http://${host}:${port}`;
  const configOverride = JSON.stringify({
    build: {
      devUrl,
      beforeDevCommand: `npm run dev -- --host ${host} --port ${port} --strictPort`,
    },
  });

  if (!explicitPort) {
    console.log(`[tauri] using dev server ${devUrl}`);
  }

  runTauri(['dev', '-c', configOverride, ...args.slice(1)], {
    ...process.env,
    TAURI_DEV_PORT: String(port),
    TAURI_DEV_HOST: host,
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
