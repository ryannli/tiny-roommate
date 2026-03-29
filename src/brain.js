// LLM Brain — pet's intelligence powered by Claude Code or Gemini CLI

import { Command } from '@tauri-apps/plugin-shell';

export let PET_DATA_PATH = '';
let petDataReady = false;
const GEMINI_FILE_TOOLS = ['read_file', 'read_many_files', 'list_directory', 'glob'];
const GEMINI_EDIT_TOOLS = GEMINI_FILE_TOOLS.concat(['write_file', 'replace']);

export const AI_PROVIDERS = {
  claude: {
    id: 'claude',
    displayName: 'Claude Code',
    command: 'claude',
    contextFile: 'CLAUDE.md',
    installHint: 'Claude Code (claude.ai/claude-code)',
  },
  gemini: {
    id: 'gemini',
    displayName: 'Gemini CLI',
    command: 'gemini',
    contextFile: 'GEMINI.md',
    installHint: 'Gemini CLI (github.com/google-gemini/gemini-cli)',
  },
};

function normalizeAiProvider(value) {
  if (!value) return '';
  var normalized = String(value).trim().toLowerCase();
  return AI_PROVIDERS[normalized] ? normalized : '';
}

export { normalizeAiProvider };

export function getSupportedAiProviders() {
  return Object.keys(AI_PROVIDERS).map(function(key) {
    return { ...AI_PROVIDERS[key] };
  });
}

export function getAiProvider() {
  return normalizeAiProvider(config.aiProvider);
}

export function getAiProviderInfo(provider) {
  var normalized = normalizeAiProvider(provider || getAiProvider());
  return normalized ? { ...AI_PROVIDERS[normalized] } : null;
}

function buildGeminiArgs(prompt, options) {
  var args = ['-p', prompt, '--output-format', 'text'];
  if (options && Array.isArray(options.allowedTools) && options.allowedTools.length) {
    args.push('--allowed-tools', options.allowedTools.join(','));
  }
  return args;
}

function buildClaudeArgs(prompt, options) {
  var args = ['--print', '--output-format', 'text', '--model', 'haiku'];
  if (options && Array.isArray(options.claudeTools) && options.claudeTools.length) {
    args.push('--tools', options.claudeTools.join(','));
  }
  if (options && options.skipPermissions) {
    args.push('--dangerously-skip-permissions');
  }
  args.push('-p', prompt);
  return args;
}

function summarizeOutput(text) {
  var normalized = String(text || '').trim();
  if (!normalized) return '';
  return normalized.length > 400 ? normalized.slice(0, 400) + '…' : normalized;
}

function logAiCommandFailure(providerInfo, result) {
  console.error('🐱 AI command failed:', {
    provider: providerInfo.id,
    command: providerInfo.command,
    code: result.code,
    stderr: summarizeOutput(result.stderr),
    stdout: summarizeOutput(result.stdout),
  });
}

function logAiCommandError(providerInfo, err) {
  console.error('🐱 AI command error:', {
    provider: providerInfo.id,
    command: providerInfo.command,
    message: err && err.message ? err.message : String(err),
    stderr: summarizeOutput(err && err.stderr),
    stdout: summarizeOutput(err && err.stdout),
  });
}

async function executeAiCommand(prompt, options) {
  var providerInfo = getAiProviderInfo();
  if (!providerInfo) return null;

  var commandOptions = {};
  if (options && options.cwd) commandOptions.cwd = options.cwd;

  var args = providerInfo.id === 'gemini'
    ? buildGeminiArgs(prompt, options || {})
    : buildClaudeArgs(prompt, options || {});

  try {
    var result = await Command.create(providerInfo.command, args, commandOptions).execute();
    if (typeof result.code === 'number' && result.code !== 0) {
      logAiCommandFailure(providerInfo, result);
      throw new Error(providerInfo.displayName + ' exited with code ' + result.code);
    }
    return result;
  } catch (err) {
    logAiCommandError(providerInfo, err);
    throw err;
  }
}

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
  pet: { name: 'Phoebe', born: '' },
  owner: { name: '' },
  sprite: 'tabby_cat',
  pet_scale: 0,
  aiProvider: '',
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
  var now = new Date();
  var timestamp = now.toISOString();
  // If .pet-data doesn't exist, copy from template and stamp born date
  await runShell(
    '[ -d ' + dataPath + ' ] || { cp -R ' + templatePath + ' ' + dataPath +
    ' && perl -i -pe ' + shellQuote('s/^born:.*/born: ' + timestamp + '/') + ' ' + dataPath + '/config.md; }'
  );
  await runShell(
    '[ -f ' + dataPath + '/GEMINI.md ] || cp ' + dataPath + '/CLAUDE.md ' + dataPath + '/GEMINI.md'
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

  config.pet_scale = 0;
  config.aiProvider = '';
  if (configRaw) {
    const { fields } = parseFrontmatter(configRaw);
    if (fields.pet_name) config.pet.name = fields.pet_name;
    if (fields.born) config.pet.born = fields.born;
    if (fields.owner_name) config.owner.name = fields.owner_name;
    if (fields.sprite) config.sprite = fields.sprite;
    if (fields.pet_scale) config.pet_scale = parseFloat(fields.pet_scale) || 0;
    config.aiProvider = normalizeAiProvider(fields.ai_provider);
  }

  return {
    ...config,
    pet: { ...config.pet },
    owner: { ...config.owner },
    pet_scale: config.pet_scale,
    aiProvider: config.aiProvider,
  };
}

var configWriteQueue = Promise.resolve();

export function saveConfigField(key, value) {
  // Update in-memory config immediately
  if (key === 'pet_name') config.pet.name = value;
  if (key === 'born') config.pet.born = value;
  if (key === 'owner_name') config.owner.name = value;
  if (key === 'sprite') config.sprite = value;
  if (key === 'pet_scale') config.pet_scale = parseFloat(value) || 0;
  if (key === 'ai_provider') config.aiProvider = normalizeAiProvider(value);

  // Queue file writes so concurrent calls don't clobber each other
  configWriteQueue = configWriteQueue.then(async function() {
    const raw = await readPetFile('config.md');
    const { fields, body } = parseFrontmatter(raw);
    fields[key] = key === 'ai_provider' ? normalizeAiProvider(value) : value;
    await writePetFile('config.md', serializeFrontmatter(fields, body));
  }).catch(function(err) {
    console.error('Failed to save config field ' + key + ':', err);
  });

  return configWriteQueue;
}

export function getConfig() {
  return {
    ...config,
    pet: { ...config.pet },
    owner: { ...config.owner },
    pet_scale: config.pet_scale,
    aiProvider: config.aiProvider,
  };
}

// --- System prompt ---

function buildSystemPrompt() {
  var providerInfo = getAiProviderInfo();
  let prompt = 'Read the ' + ((providerInfo && providerInfo.contextFile) || 'CLAUDE.md') + ' in your working directory for instructions.';
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
  if (description && isAiAvailable()) {
    runInPetDir(
      'Append this line to me-journal.md (do NOT overwrite existing content, use Edit or Replace to add at the end): "- [' + time + '] ' + description.replace(/"/g, '\\"') + '"',
      {
        claudeTools: ['Write', 'Edit'],
        allowedTools: GEMINI_EDIT_TOOLS,
        skipPermissions: true,
      }
    ).catch(function(err) {
      console.error('Failed to write journal:', err);
    });
  }
}

export function getActivityLog() {
  return [...activityLog];
}

// --- LLM response parsing ---

export function parseResponse(raw) {
  var text = '';
  var state = 'idle';
  var reactions = [];

  // Find the last JSON object in the output (skip any reasoning the LLM leaked)
  var jsonMatch = raw.match(/\{[\s\S]*?\}/g);
  if (jsonMatch) {
    for (var i = jsonMatch.length - 1; i >= 0; i--) {
      try {
        var parsed = JSON.parse(jsonMatch[i]);
        if (parsed.state) {
          state = parsed.state;
          if (parsed.text) text = parsed.text;
          if (parsed.r && Array.isArray(parsed.r)) reactions = parsed.r.slice(0, 2);
          // Fall back to text appearing before the JSON block
          if (!text) {
            var beforeJson = raw.slice(0, raw.indexOf(jsonMatch[i])).trim();
            if (beforeJson) text = beforeJson.replace(/^["']|["']$/g, '').trim();
          }
          break;
        }
      } catch {}
    }
  }

  // Clean up: strip markdown, code blocks, tool artifacts, reasoning
  if (text) {
    text = text
      .replace(/```[\s\S]*?```/g, '')           // code blocks
      .replace(/```\w*/g, '')                    // unclosed code fences
      .replace(/\*\*([^*]+)\*\*/g, '$1')        // **bold**
      .replace(/\*([^*]+)\*/g, '$1')            // *italic*
      .replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '') // XML tags
      .replace(/^---[\s\S]*?---/gm, '')         // frontmatter blocks
      .replace(/^#+ .*/gm, '')                  // headings
      .replace(/^- .*/gm, '')                   // list items
      .trim();

    // Take only the last meaningful line (likely the actual dialogue)
    var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    if (lines.length > 1) text = lines[lines.length - 1];

    if (text.length > 80) {
      var firstSentence = text.match(/^[^.!?。！？]+[.!?。！？]/);
      if (firstSentence) text = firstSentence[0].trim();
    }
  }

  return { text, state, reactions };
}

// --- AI provider execution ---

var providerAvailability = Object.create(null);

export async function checkAiCli(provider) {
  var providerInfo = getAiProviderInfo(provider);
  if (!providerInfo) return false;
  if (providerAvailability[providerInfo.id] !== undefined) {
    return providerAvailability[providerInfo.id];
  }
  try {
    var result = await Command.create(providerInfo.command, ['--version']).execute();
    providerAvailability[providerInfo.id] = result.code === 0;
  } catch {
    providerAvailability[providerInfo.id] = false;
  }
  return providerAvailability[providerInfo.id];
}

export function isAiAvailable(provider) {
  var providerInfo = getAiProviderInfo(provider);
  return !!(providerInfo && providerAvailability[providerInfo.id] === true);
}

export async function checkClaudeCli() {
  return checkAiCli('claude');
}

export function isClaudeAvailable() {
  return isAiAvailable('claude');
}

function runInPetDir(prompt, options) {
  return ensurePetDataPath().then(function(petDataPath) {
    return executeAiCommand(prompt, { ...(options || {}), cwd: petDataPath });
  });
}

export async function think(context) {
  if (!isAiAvailable()) return null;

  const recentActivity = activityLog.length > 0
    ? '\nRecent activity log:\n' + activityLog.slice(-5).map(a => '- ' + a.time + ': ' + (a.description || a.type)).join('\n')
    : '';

  const systemPrompt = buildSystemPrompt();
  const fullPrompt = systemPrompt + recentActivity + '\n\nCurrent situation: ' + context + '\n\nRespond:';

  try {
    const result = await runInPetDir(fullPrompt, {
      claudeTools: ['Read', 'Write', 'Edit'],
      allowedTools: GEMINI_EDIT_TOOLS,
      skipPermissions: true,
    });

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
  if (!isAiAvailable() || activityLog.length < 3) return null;

  const logText = activityLog.map(a => `${a.time}: ${a.description || a.type}`).join('\n');
  const petName = config.pet.name || 'Phoebe';

  try {
    const result = await executeAiCommand(
      `You are ${petName} the cat. Summarize your owner's day in 2-3 short sentences based on this activity log. Be casual and cute, like a cat observing its human.\n\nActivity log:\n${logText}\n\nDaily summary:`
    );

    return (result.stdout || '').trim();
  } catch {
    return null;
  }
}

export async function summarizePerceptionsForTimeline(date, perceptions) {
  if (!isAiAvailable()) return null;

  try {
    const result = await executeAiCommand(
      'Summarize these screen observations into a timeline for ' + date + '. Merge activities into coarse blocks of at least 15-20 minutes each - do NOT create short blocks for every minor change. Round times to the nearest 5 minutes. Format:\n\n## ' + date + '\n- HH:MM-HH:MM - Activity description\n- HH:MM-HH:MM - Activity description\n\nBe concise. Output ONLY the formatted timeline, nothing else.\n\nObservations:\n' + perceptions
    );
    return (result.stdout || '').trim() || null;
  } catch {
    return null;
  }
}

export async function describeScreenImage(imagePath) {
  if (!isAiAvailable()) return null;

  var prompt = 'Read the file at ' + imagePath + '. Describe in 1-2 SHORT sentences what the user is doing. Focus on: what app, what content. Output ONLY the description.';

  try {
    var result = await runInPetDir(prompt, {
      claudeTools: ['Read'],
      allowedTools: GEMINI_FILE_TOOLS,
      skipPermissions: true,
    });
    return (result.stdout || '').trim() || null;
  } catch {
    return null;
  }
}
