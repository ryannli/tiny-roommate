// LLM Brain — pet's intelligence powered by Claude CLI (Haiku)

import { Command } from '@tauri-apps/plugin-shell';

export let PET_DATA_PATH = '';
let petDataReady = false;

async function resolvePetDataPaths() {
  // Tauri binary runs from src-tauri/, so walk up to find project root (where package.json lives)
  const result = await Command.create('bash', ['-lc',
    'dir=$(pwd); while [ ! -f "$dir/package.json" ] && [ "$dir" != "/" ]; do dir=$(dirname "$dir"); done; echo "$dir"'
  ]).execute();
  const projectRoot = (result.stdout || '').trim();
  const dataPath = projectRoot + '/.pet-data';
  return { dataPath, projectRoot };
}

// Structured config loaded from frontmatter
let config = {
  pet: { name: 'Mochi', species: 'Cat', born: '' },
  owner: { name: '' },
  sprite: 'tabby_cat',
};

function shellQuote(value) {
  return "'" + String(value).replace(/'/g, `'\\''`) + "'";
}

async function runShell(script) {
  return Command.create('bash', ['-lc', script]).execute();
}

async function seedPetDataIfNeeded(projectRoot) {
  var dataPath = shellQuote(projectRoot + '/.pet-data');
  var templatePath = shellQuote(projectRoot + '/.pet-data-template');
  var today = new Date().toISOString().slice(0, 10);
  // If .pet-data doesn't exist, copy from template and stamp born date
  await runShell(
    '[ -d ' + dataPath + ' ] || { cp -R ' + templatePath + ' ' + dataPath +
    ' && sed -i "" "s/^born:.*/born: ' + today + '/" ' + dataPath + '/config.md; }'
  );
}

export async function ensurePetDataPath() {
  if (petDataReady && PET_DATA_PATH) return PET_DATA_PATH;
  const { dataPath, projectRoot } = await resolvePetDataPaths();
  await seedPetDataIfNeeded(projectRoot);
  PET_DATA_PATH = dataPath;
  petDataReady = true;
  return PET_DATA_PATH;
}

// --- Frontmatter parsing ---

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { fields: {}, body: text };
  const fields = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return { fields, body: text.slice(match[0].length).trim() };
}

function serializeFrontmatter(fields, body) {
  const lines = Object.entries(fields).map(([k, v]) => k + ': ' + v);
  return '---\n' + lines.join('\n') + '\n---\n\n' + body + '\n';
}

// --- File I/O via shell ---

async function readPetFile(filename) {
  try {
    const petDataPath = await ensurePetDataPath();
    const result = await runShell('cat ' + shellQuote(petDataPath + '/' + filename));
    return (result.stdout || '').trim();
  } catch {
    return '';
  }
}

async function writePetFile(filename, content) {
  try {
    const petDataPath = await ensurePetDataPath();
    // Use base64 to avoid shell escaping issues
    const b64 = btoa(unescape(encodeURIComponent(content)));
    await runShell('mkdir -p ' + shellQuote((petDataPath + '/' + filename).split('/').slice(0, -1).join('/')) + ' && echo "' + b64 + '" | base64 -d > ' + shellQuote(petDataPath + '/' + filename));
  } catch (err) {
    console.error('Failed to write ' + filename + ':', err);
  }
}

// --- Config loading/saving ---

export async function loadConfig() {
  const configRaw = await readPetFile('config.md');

  if (configRaw) {
    const { fields } = parseFrontmatter(configRaw);
    if (fields.pet_name) config.pet.name = fields.pet_name;
    if (fields.species) config.pet.species = fields.species;
    if (fields.born) config.pet.born = fields.born;
    if (fields.owner_name) config.owner.name = fields.owner_name;
    if (fields.sprite) config.sprite = fields.sprite;
  }

  return { ...config, pet: { ...config.pet }, owner: { ...config.owner } };
}

export async function saveConfigField(key, value) {
  const raw = await readPetFile('config.md');
  const { fields, body } = parseFrontmatter(raw);
  fields[key] = value;
  await writePetFile('config.md', serializeFrontmatter(fields, body));

  // Update in-memory config
  if (key === 'pet_name') config.pet.name = value;
  if (key === 'species') config.pet.species = value;
  if (key === 'born') config.pet.born = value;
  if (key === 'owner_name') config.owner.name = value;
  if (key === 'sprite') config.sprite = value;
}

export function getConfig() {
  return { ...config, pet: { ...config.pet }, owner: { ...config.owner } };
}

// --- System prompt ---

function buildSystemPrompt() {
  let prompt = 'Read the CLAUDE.md in your working directory for instructions.';
  if (config.pet.name) {
    prompt += ' Your name is ' + config.pet.name + '.';
  }
  if (config.owner.name) {
    prompt += ' Call your owner "' + config.owner.name + '".';
  }
  prompt += ' Then respond to the situation below.';
  return prompt;
}

// --- Activity log ---

let activityLog = [];

export function logActivity(entry) {
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  activityLog.push({ time, ...entry });
  if (activityLog.length > 50) activityLog.shift();

  const description = entry.description || entry.type || '';
  if (description) {
    claudeInPetDir([
      '--print', '--output-format', 'text', '--model', 'haiku',
      '--tools', 'Write,Edit', '--dangerously-skip-permissions',
      '-p', 'Append this line to me-journal.md (do NOT overwrite existing content, use Edit to add at the end): "- [' + time + '] ' + description.replace(/"/g, '\\"') + '"',
    ]).catch(err => console.error('Failed to write journal:', err));
  }
}

export function getActivityLog() {
  return [...activityLog];
}

// --- LLM response parsing ---

function parseResponse(raw) {
  const lines = raw.split('\n');
  let text = '';
  let state = 'idle';
  let reactions = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '```json' || trimmed === '```') continue;

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.state) state = parsed.state;
        if (parsed.r && Array.isArray(parsed.r)) reactions = parsed.r.slice(0, 2);
        continue;
      } catch {}
    }

    if (trimmed) text += (text ? ' ' : '') + trimmed;
  }

  return { text, state, reactions };
}

// --- Claude CLI ---

function claudeInPetDir(args) {
  return ensurePetDataPath().then(function(petDataPath) {
    return Command.create('claude', args, { cwd: petDataPath }).execute();
  });
}

export async function think(context) {
  const recentActivity = activityLog.length > 0
    ? '\nRecent activity log:\n' + activityLog.slice(-5).map(a => '- ' + a.time + ': ' + (a.description || a.type)).join('\n')
    : '';

  const systemPrompt = buildSystemPrompt();
  const fullPrompt = systemPrompt + recentActivity + '\n\nCurrent situation: ' + context + '\n\nRespond:';

  try {
    const result = await claudeInPetDir([
      '--print',
      '--output-format', 'text',
      '--model', 'haiku',
      '--tools', 'Read,Edit,Write',
      '--dangerously-skip-permissions',
      '-p', fullPrompt,
    ]);

    const output = (result.stdout || '').trim();
    console.log('🐱 Raw LLM:', output);

    if (output) {
      return parseResponse(output);
    }
  } catch (err) {
    console.error('🐱 LLM error:', err);
  }

  return null;
}

// --- Daily digest ---

export async function generateDailyDigest() {
  if (activityLog.length < 3) return null;

  const logText = activityLog.map(a => `${a.time}: ${a.description || a.type}`).join('\n');
  const petName = config.pet.name || 'Mochi';

  try {
    const result = await Command.create('claude', [
      '--print',
      '--output-format', 'text',
      '--model', 'haiku',
      '-p', `You are ${petName} the cat. Summarize your owner's day in 2-3 short sentences based on this activity log. Be casual and cute, like a cat observing its human.\n\nActivity log:\n${logText}\n\nDaily summary:`,
    ]).execute();

    return (result.stdout || '').trim();
  } catch {
    return null;
  }
}
