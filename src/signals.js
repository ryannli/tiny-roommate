// Passive signal collection — what the pet can "see"

import { Command } from '@tauri-apps/plugin-shell';
import { ensurePetDataPath } from './brain.js';

export function getTimeSignals() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let timeOfDay;
  if (hour < 6) timeOfDay = 'late night';
  else if (hour < 9) timeOfDay = 'early morning';
  else if (hour < 12) timeOfDay = 'morning';
  else if (hour < 14) timeOfDay = 'lunch time';
  else if (hour < 17) timeOfDay = 'afternoon';
  else if (hour < 20) timeOfDay = 'evening';
  else if (hour < 23) timeOfDay = 'night';
  else timeOfDay = 'late night';

  const isWeekend = day === 0 || day === 6;

  return {
    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    timeOfDay,
    dayOfWeek: dayNames[day],
    isWeekend,
    hour,
  };
}

// User idle tracking
let lastActivity = Date.now();

export function trackActivity() {
  const reset = () => { lastActivity = Date.now(); };
  document.addEventListener('mousemove', reset);
  document.addEventListener('keydown', reset);
}

export function getIdleSeconds() {
  return Math.floor((Date.now() - lastActivity) / 1000);
}

// Screenshot — capture the screen with the mouse cursor (active display)
// macOS screencapture: -x = no sound, -C = capture cursor (tells us which display)
// -D flag not available, but screencapture without -m captures the main display
// We capture all displays and let Claude figure out what's on screen
const SCREENSHOT_PATH = '/tmp/tinyroommate-screenshot.png';
var screenRecordingDenied = false;

export async function captureScreenContext() {
  try {
    var petDataPath = await ensurePetDataPath();
    // Step 1: Detect which display the mouse is on
    var displayNum = '1';
    try {
      var pyResult = await Command.create('python3', [
        'scripts/mouse-display.py'
      ]).execute();
      var detected = (pyResult.stdout || '').trim();
      if (detected === '1' || detected === '2') displayNum = detected;
      console.log('📸 Mouse on display:', displayNum);
    } catch (e) {
      console.log('📸 Could not detect display, using main');
    }

    // Step 2: Capture that display
    var captureResult = await Command.create('screencapture', ['-x', '-D', displayNum, SCREENSHOT_PATH]).execute();
    console.log('📸 screencapture exit:', captureResult.code);

    if (captureResult.code !== 0) {
      screenRecordingDenied = true;
      return null;
    }
    screenRecordingDenied = false;

    // Step 3: Ask Claude to describe it
    var result = await Command.create('claude', [
      '--print',
      '--tools', 'Read',
      '--output-format', 'text',
      '--dangerously-skip-permissions',
      '--model', 'haiku',
      '-p', 'Use the Read tool to look at ' + SCREENSHOT_PATH + '. Describe in 1-2 SHORT sentences what the user is doing. Focus on: what app, what content. Output ONLY the description.',
    ], { cwd: petDataPath }).execute();

    // Step 4: Clean up
    Command.create('rm', [SCREENSHOT_PATH]).execute().catch(function() {});

    const description = (result.stdout || '').trim();
    console.log('📸 Screen context:', description);
    return description || null;
  } catch (err) {
    console.error('📸 Screenshot error:', err);
    // Clean up on error
    Command.create('rm', [SCREENSHOT_PATH]).execute().catch(() => {});
    return null;
  }
}

export function isScreenRecordingDenied() {
  return screenRecordingDenied;
}

// Get active app name — TODO: implement with Tauri native plugin
export async function getActiveApp() {
  return null;
}

// Build context string for LLM
export function buildContextString(timeSignals, idleSeconds, screenContext, activeApp) {
  const parts = [];
  parts.push('Time: ' + timeSignals.time + ' (' + timeSignals.timeOfDay + ', ' + timeSignals.dayOfWeek + ')');
  if (timeSignals.isWeekend) parts.push('It is the weekend.');
  if (idleSeconds > 60) parts.push('User has been idle for ' + Math.floor(idleSeconds / 60) + ' minutes.');
  if (activeApp) parts.push('Active app: ' + activeApp);
  if (screenContext) parts.push('What I see on screen: ' + screenContext);
  return parts.join('\n');
}
