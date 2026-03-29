// Autonomous behavior — perception, decision (LLM), animation

import { Command } from '@tauri-apps/plugin-shell';
import { STATES } from './sprite.js';
import { getTimeSignals, getIdleSeconds, captureScreenContext, buildContextString, isScreenRecordingDenied } from './signals.js';
import { think, getActivityLog, generateDailyDigest, loadConfig, ensurePetDataPath, checkAiCli, getAiProviderInfo, summarizePerceptionsForTimeline } from './brain.js';

var WALK_SPEED = 50;
var SCREEN_MARGIN = 30;
var SCREEN_CAPTURE_INTERVAL = 2 * 60 * 1000;   // perception: every 2 min
var DECISION_INTERVAL = [2 * 60 * 1000, 3 * 60 * 1000]; // brain: every 2-3 min
var FIDGET_INTERVAL = [12000, 30000];            // small animations between decisions
var INTERACTION_COOLDOWN = 30000;                 // don't auto-act 30s after interaction

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
function shellQuote(value) { return "'" + String(value).replace(/'/g, `'\\''`) + "'"; }

export function initBehavior(pet) {

  // =========================================================================
  // PERCEPTION LAYER — persisted to .pet-data/owner-perceptions.md
  // =========================================================================
  var lastPerceptionDate = null; // track date for daily rollover
  var screenPermissionNudged = false;

  async function captureLoop() {
    try {
      await maybeRolloverDay();
      var context = await captureScreenContext();
      if (context) {
        var time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        await appendToFile('owner-perceptions.md', '- [' + time + '] ' + context);
        console.log('📸 Perception:', context);
      }
      // Nudge once if screen recording is denied
      if (!screenPermissionNudged && isScreenRecordingDenied()) {
        screenPermissionNudged = true;
        pet.showBubble("i can't see your screen yet! enable Screen Recording in System Settings for me? 🥺", 8000, true);
      }
    } catch (err) {
      console.error('📸 Capture error:', err);
    }
    setTimeout(captureLoop, SCREEN_CAPTURE_INTERVAL);
  }

  async function appendToFile(relPath, line) {
    try {
      var petDataPath = await ensurePetDataPath();
      var result = await Command.create('bash', ['-c',
        'cat ' + shellQuote(petDataPath + '/' + relPath) + ' 2>/dev/null'
      ]).execute();
      var existing = (result.stdout || '').trim();
      var content = existing ? existing + '\n' + line + '\n' : line + '\n';
      var b64 = btoa(unescape(encodeURIComponent(content)));
      await Command.create('bash', ['-c',
        'echo "' + b64 + '" | base64 -d > ' + shellQuote(petDataPath + '/' + relPath)
      ]).execute();
    } catch (err) {
      console.error('Failed to write ' + relPath + ':', err);
    }
  }

  // --- Daily rollover: summarize yesterday's perceptions into timeline ---
  async function maybeRolloverDay() {
    var today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (lastPerceptionDate === null) {
      // First run — check what date the current perceptions are from
      lastPerceptionDate = today;
      return;
    }
    if (lastPerceptionDate === today) return;

    // New day — summarize yesterday's perceptions into timeline
    console.log('📅 New day detected, rolling over perceptions...');
    var yesterday = lastPerceptionDate;
    lastPerceptionDate = today;

    try {
      var petDataPath = await ensurePetDataPath();
      var raw = await Command.create('bash', ['-c',
        'cat ' + shellQuote(petDataPath + '/owner-perceptions.md') + ' 2>/dev/null'
      ]).execute();
      var perceptions = (raw.stdout || '').trim();
      if (!perceptions) return;

      var summary = await summarizePerceptionsForTimeline(yesterday, perceptions);
      if (summary) {
        await appendToFile('owner-timeline.md', '\n' + summary);
        console.log('📅 Timeline updated for', yesterday);
      }

      // Clear perceptions for the new day
      var b64 = btoa(unescape(encodeURIComponent('')));
      await Command.create('bash', ['-c',
        'echo "' + b64 + '" | base64 -d > ' + shellQuote(petDataPath + '/owner-perceptions.md')
      ]).execute();
    } catch (err) {
      console.error('📅 Rollover error:', err);
    }
  }

  // =========================================================================
  // BASE STATE — what the pet defaults to between actions
  // =========================================================================
  var baseState = 'idle';

  function updateBaseState() {
    var idle = getIdleSeconds();

    if (pet.isSick) {
      baseState = 'sleep';
    } else if (idle > 300) {
      baseState = 'sleep';
    } else if (idle > 120) {
      baseState = 'idle';
    } else {
      baseState = 'work';
    }
  }

  function returnToBase() {
    updateBaseState();
    pet.sprite.setState(baseState);
  }

  // =========================================================================
  // DECISION LAYER — LLM-based, periodic
  // =========================================================================
  function scheduleDecision() {
    var min = DECISION_INTERVAL[0];
    var max = DECISION_INTERVAL[1];
    var delay = min + Math.random() * (max - min);
    setTimeout(function() {
      makeDecision();
      scheduleDecision();
    }, delay);
  }

  async function makeDecision() {
    if (pet.isWalking || pet.llmBusy) return;
    if (pet.isSick) { pet.sprite.setState('sleep'); return; }
    if (Date.now() - pet.lastInteractionTime < INTERACTION_COOLDOWN) return;

    updateBaseState();
    pet.llmBusy = true;

    // Minimal context — LLM reads files (config.md, owner-perceptions.md, owner-memory.md) itself
    var timeSignals = getTimeSignals();
    var idleSeconds = getIdleSeconds();

    var situation = "It's " + timeSignals.time + " (" + timeSignals.timeOfDay + ", " + timeSignals.dayOfWeek + "). ";

    if (idleSeconds > 300) {
      situation += "Your owner has been away for " + Math.floor(idleSeconds / 60) + " minutes. ";
    } else if (idleSeconds > 60) {
      situation += "Your owner seems idle. ";
    } else {
      situation += "Your owner is actively working. ";
    }

    situation += "\nRead owner-perceptions.md for what you've seen on their screen recently. Read config.md for your owner's instructions. Decide what to do.";

    var result = await think(situation);

    if (result) {
      if (result.text) {
        pet.showBubble(result.text, Math.max(8000, result.text.length * 300), true, result.reactions);
      }
      if (result.state && STATES[result.state]) {
        pet.sprite.setState(result.state, STATES[result.state].loop ? null : function() { returnToBase(); });
      }
    }

    pet.llmBusy = false;
    pet.lastInteractionTime = Date.now();
  }

  // =========================================================================
  // FIDGET LAYER — small animations between LLM decisions
  // =========================================================================
  function scheduleFidget() {
    var min = FIDGET_INTERVAL[0];
    var max = FIDGET_INTERVAL[1];
    var delay = min + Math.random() * (max - min);
    setTimeout(function() {
      doFidget();
      scheduleFidget();
    }, delay);
  }

  function doFidget() {
    if (pet.isWalking || pet.llmBusy || pet.isSick) return;
    if (Date.now() - pet.lastInteractionTime < INTERACTION_COOLDOWN) return;

    updateBaseState();

    // Mostly stay in base state; occasional small movements
    var behaviors = [
      { weight: 55, fn: function() { returnToBase(); } },
      { weight: 15, fn: function() { walkRandomDirection(); } },
      { weight: 10, fn: function() { pet.sprite.setState('looking_around', function() { returnToBase(); }); } },
      { weight: 10, fn: function() { pet.sprite.setState('happy', function() { returnToBase(); }); } },
      { weight: 10, fn: function() {
        var emotes = ['~♪', '...', '✨', '💤', '☕'];
        pet.showBubble(emotes[Math.floor(Math.random() * emotes.length)]);
      }},
    ];

    var total = behaviors.reduce(function(s, b) { return s + b.weight; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < behaviors.length; i++) {
      r -= behaviors[i].weight;
      if (r <= 0) { behaviors[i].fn(); return; }
    }
  }

  // =========================================================================
  // WALKING
  // =========================================================================
  async function walkRandomDirection() {
    if (pet.isWalking) return;
    pet.isWalking = true;
    pet.sprite.setState('walk');

    var pos = await pet.appWindow.outerPosition();
    var screen = { width: window.screen.availWidth, height: window.screen.availHeight };
    var size = pet.sprite.getSize();

    var dist = 80 + Math.random() * 150;
    var angle = Math.random() * Math.PI * 2;
    var dx = Math.cos(angle) * dist;
    var dy = Math.sin(angle) * dist;

    var targetX = Math.max(SCREEN_MARGIN, Math.min(screen.width - size.width - SCREEN_MARGIN, pos.x + dx));
    var targetY = Math.max(SCREEN_MARGIN, Math.min(screen.height - size.height - SCREEN_MARGIN, pos.y + dy));
    var actualDx = targetX - pos.x;
    var actualDy = targetY - pos.y;
    var actualDist = Math.sqrt(actualDx * actualDx + actualDy * actualDy);

    if (actualDist < 10) { pet.isWalking = false; returnToBase(); return; }

    pet.canvas.style.transform = actualDx < 0 ? 'scaleX(-1)' : 'scaleX(1)';

    var duration = actualDist / WALK_SPEED;
    var startTime = performance.now();

    function step() {
      if (!pet.isWalking) return;
      var elapsed = (performance.now() - startTime) / 1000;
      var progress = Math.min(elapsed / duration, 1);
      var ease = 1 - Math.pow(1 - progress, 2);
      var x = Math.round(pos.x + actualDx * ease);
      var y = Math.round(pos.y + actualDy * ease);
      pet.appWindow.setPosition({ type: 'Physical', x: x, y: y }).catch(function() {});
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        pet.isWalking = false;
        pet.canvas.style.transform = 'scaleX(1)';
        returnToBase();
      }
    }
    step();
  }

  // =========================================================================
  // ONBOARDING
  // =========================================================================
  async function onboarding() {
    var cfg = await loadConfig();
    pet.petName = cfg.pet.name;
    pet.ownerName = cfg.owner.name;
    pet.aiProvider = cfg.aiProvider;
    if (cfg.sprite && cfg.sprite !== pet.currentSprite) {
      pet.currentSprite = cfg.sprite;
      pet.sprite.image.src = '/sprites/' + pet.currentSprite + '.png';
    }

    if (typeof pet.ensureAiProviderSelected === 'function') {
      pet.aiProvider = await pet.ensureAiProviderSelected(cfg.aiProvider);
    }

    var providerInfo = getAiProviderInfo(pet.aiProvider) || {
      displayName: 'the selected AI CLI',
      installHint: 'your preferred AI CLI',
    };
    var hasAiCli = await checkAiCli(pet.aiProvider);

    pet.sprite.setState('happy');
    pet.showBubble('hey! i\'m ' + pet.petName + ' ' + pet.voice().greet, 3000);
    await sleep(3500);

    if (!hasAiCli) {
      pet.sprite.setState('sad');
      pet.showBubble('i can\'t find ' + providerInfo.displayName + ' on this machine... i\'ll hang out but i can\'t think or see your screen without it 🥺', 8000);
      await sleep(8500);
      pet.showBubble('install ' + providerInfo.installHint + ' and restart me to unlock my full brain!', 6000);
      await sleep(6500);
      returnToBase();
      // Offline mode: only fidget animations, no LLM/perception
      scheduleFidget();
      return;
    }

    pet.sprite.setState('looking_around');
    pet.showBubble('*looks around*...', 2000);
    await sleep(2500);

    // First LLM call with screen context
    pet.llmBusy = true;
    var screenContext = await captureScreenContext();
    if (screenContext) {
      var time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      await appendToFile('owner-perceptions.md', '- [' + time + '] ' + screenContext);
    }

    var timeSignals = getTimeSignals();
    var context = buildContextString(timeSignals, 0, screenContext);
    var result = await think(
      "You just appeared on your owner's desktop for the very first time. Look around and comment on what you see. This is your first impression. Be cute and observant.\n\nEnvironment:\n" + context
    );

    if (result) {
      pet.showBubble(result.text, Math.max(8000, result.text.length * 300), true, result.reactions);
      if (result.state && STATES[result.state]) {
        pet.sprite.setState(result.state, STATES[result.state].loop ? null : function() { returnToBase(); });
      }
    } else {
      pet.showBubble('ooh nice desktop!', 4000);
    }

    pet.llmBusy = false;
    pet.lastInteractionTime = Date.now();

    // Start all three loops
    captureLoop();
    scheduleDecision();
    scheduleFidget();
  }

  // =========================================================================
  // DAILY DIGEST
  // =========================================================================
  setInterval(async function() {
    var hour = new Date().getHours();
    if (hour === 20 && getActivityLog().length >= 5) {
      var digest = await generateDailyDigest();
      if (digest) {
        pet.sprite.setState('happy');
        pet.showBubble(digest, 8000);
        setTimeout(function() { returnToBase(); }, 8000);
      }
    }
  }, 60 * 60 * 1000);

  // =========================================================================
  // MOUSE PROXIMITY
  // =========================================================================
  document.addEventListener('mousemove', function(e) {
    var rect = pet.canvas.getBoundingClientRect();
    var dx = Math.max(0, Math.max(rect.left - e.clientX, e.clientX - rect.right));
    var dy = Math.max(0, Math.max(rect.top - e.clientY, e.clientY - rect.bottom));
    pet.mouseNearPet = (dx * dx + dy * dy) < 100 * 100;
  });

  return {
    walkRandomDirection: walkRandomDirection,
    start: function() { onboarding(); },
  };
}
