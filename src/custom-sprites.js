// Custom sprite management — import, process, list, load, delete
// Custom sprites are stored in .pet-data/custom-sprites/

import { Command } from '@tauri-apps/plugin-shell';
import { ensurePetDataPath, PET_DATA_PATH } from './brain.js';
import { CUSTOM_SPRITE_PREFIX, isCustomSpriteKey } from './sprite-keys.js';

function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''" ) + "'";
}

async function runShell(script) {
  return Command.create('bash', ['-lc', script]).execute();
}

async function getCustomDir() {
  var petData = await ensurePetDataPath();
  var dir = petData + '/custom-sprites';
  await runShell('mkdir -p ' + shellQuote(dir));
  return dir;
}

function getProjectRoot() {
  return PET_DATA_PATH.replace(/\/\.pet-data$/, '');
}

// Read manifest.json from custom-sprites directory
export async function listCustomSprites() {
  try {
    var dir = await getCustomDir();
    var result = await runShell('cat ' + shellQuote(dir + '/manifest.json') + ' 2>/dev/null');
    var text = (result.stdout || '').trim();
    if (!text) return [];
    return JSON.parse(text);
  } catch {
    return [];
  }
}

async function saveManifest(sprites) {
  var dir = await getCustomDir();
  var json = JSON.stringify(sprites, null, 2);
  var b64 = btoa(unescape(encodeURIComponent(json)));
  await runShell('echo "' + b64 + '" | base64 -d > ' + shellQuote(dir + '/manifest.json'));
}

// Write binary data to a file by chunking base64 through shell
async function writeBinaryFile(path, arrayBuf) {
  var bytes = new Uint8Array(arrayBuf);
  var binary = '';
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  var b64 = btoa(binary);

  // Write base64 to temp file in chunks (shell ARG_MAX is ~1MB on macOS)
  var b64Path = path + '.b64';
  var CHUNK = 500000; // ~500KB per chunk, safe for shell args
  for (var j = 0; j < b64.length; j += CHUNK) {
    var chunk = b64.slice(j, j + CHUNK);
    var op = j === 0 ? '>' : '>>';
    await runShell('printf "%s" ' + shellQuote(chunk) + ' ' + op + ' ' + shellQuote(b64Path));
  }

  // Decode base64 file to binary
  await runShell('base64 -d < ' + shellQuote(b64Path) + ' > ' + shellQuote(path));
  await runShell('rm -f ' + shellQuote(b64Path));
}

// Import a sprite from a File object
// Returns { key, displayName } on success, throws on error
export async function importCustomSprite(file, displayName) {
  var dir = await getCustomDir();
  var projectRoot = getProjectRoot();
  var key = CUSTOM_SPRITE_PREFIX + Date.now();

  // Write raw file to temp location
  var rawPath = dir + '/' + key + '_raw.png';
  var arrayBuf = await file.arrayBuffer();
  await writeBinaryFile(rawPath, arrayBuf);

  // Run processing V4
  var outputPath = dir + '/' + key + '.png';
  var scriptPath = projectRoot + '/scripts/process-spritesheet-v4.py';

  var processResult = await Command.create('python3', [
    scriptPath,
    rawPath,
    '-o', outputPath,
    '--cols', '8',
    '--rows', '9',
    '--target', '128',
    '--name', displayName || key,
  ]).execute();

  if (processResult.code !== 0) {
    // Clean up raw file
    await runShell('rm -f ' + shellQuote(rawPath));
    var errMsg = (processResult.stderr || '').trim();
    if (errMsg.includes('ModuleNotFoundError') || errMsg.includes('No module named')) {
      throw new Error('Missing Python dependencies. Run: pip3 install pillow numpy');
    }
    throw new Error('Processing failed: ' + (errMsg || 'unknown error'));
  }

  // Clean up raw file
  await runShell('rm -f ' + shellQuote(rawPath));

  // Update manifest
  var sprites = await listCustomSprites();
  sprites.push({
    key: key,
    displayName: displayName || 'Custom Character',
    createdAt: new Date().toISOString(),
  });
  await saveManifest(sprites);

  return { key: key, displayName: displayName || 'Custom Character' };
}

// Load a custom sprite as a data URL for use in img.src / canvas
export async function loadCustomSpriteDataUrl(key) {
  try {
    var dir = await getCustomDir();
    var result = await runShell('base64 < ' + shellQuote(dir + '/' + key + '.png'));
    var b64 = (result.stdout || '').replace(/\s/g, '');
    if (!b64) return null;
    return 'data:image/png;base64,' + b64;
  } catch {
    return null;
  }
}

// Delete a custom sprite
export async function deleteCustomSprite(key) {
  var dir = await getCustomDir();
  await runShell('rm -f ' + shellQuote(dir + '/' + key + '.png') + ' ' + shellQuote(dir + '/' + key + '_raw.png'));

  var sprites = await listCustomSprites();
  sprites = sprites.filter(function(s) { return s.key !== key; });
  await saveManifest(sprites);
}

// Check if a sprite key is a custom sprite
export function isCustomSprite(key) {
  return isCustomSpriteKey(key);
}

// Sprite generation prompt for users to copy
export var SPRITE_PROMPT = [
  'CHARACTER: [describe your character, or attach a few photos of your pet and say "based on this pet"]',
  'STYLE: [e.g. "cute, photo-realistic" or "pixel art" or "chibi anime"]',
  '',
  'Generate a sprite sheet for an animated desktop pet character.',
  '',
  'LAYOUT:',
  '- 8 columns \u00d7 9 rows grid',
  '- Each cell is a square frame (equal width and height)',
  '- Aspect ratio: 8:9',
  '- Recommended output: 4K+ (e.g. 4096\u00d74608, giving 512\u00d7512 per frame)',
  '',
  'BACKGROUND:',
  '- Every pixel outside the character must be pure magenta #FF00FF',
  '- No gradients, no shadows on background, no texture, no noise',
  '- The character itself must not contain magenta or near-magenta colors',
  '- No magenta reflections, outlines, or glow on the character',
  '',
  'ANIMATION:',
  '- Each row is one animation loop; frames progress left to right',
  '- Adjacent frames must transition smoothly \u2014 no sudden jumps',
  '- Character should stay centered in each frame',
  '- Keep consistent size and proportions across all 72 frames',
  '',
  'ROW DEFINITIONS (top to bottom):',
  '- Row 1: Idle \u2014 relaxed, gentle breathing motion, occasional blink. Not static.',
  '- Row 2: Walking \u2014 movement animation suggesting walking forward',
  '- Row 3: Looking Around \u2014 head/body turning left and right, curious',
  '- Row 4: Sleeping \u2014 eyes closed, resting, gentle breathing. No yawning (it loops).',
  '- Row 5: Working \u2014 focused expression, sitting at a tiny keyboard',
  '- Row 6: Playful \u2014 having fun with a small toy, lighthearted energy',
  '- Row 7: Happy \u2014 bright expression, joyful body language, small hearts or sparkles',
  '- Row 8: Sad \u2014 dejected, looking down, low energy, lonely',
  '- Row 9: Being Held \u2014 picked up or carried, limbs dangling, mildly annoyed',
].join('\n');
