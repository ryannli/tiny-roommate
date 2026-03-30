import { readFile } from 'node:fs/promises';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tauri shell plugin before importing brain
var createMock = vi.fn();
vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: { create: createMock },
}));

createMock.mockImplementation(function() {
  return {
    execute: function() {
      return Promise.resolve({ stdout: '', code: 0 });
    },
  };
});

const {
  parseResponse,
  normalizeAiProvider,
  getSupportedAiProviders,
  saveConfigField,
  think,
} = await import('../brain.js');

beforeEach(() => {
  createMock.mockClear();
  createMock.mockImplementation(function(command, args) {
    return {
      execute: function() {
        if (command === 'bash') {
          var script = Array.isArray(args) ? args[1] : '';
          if (script && script.indexOf('while [ ! -f "$dir/package.json" ]') >= 0) {
            return Promise.resolve({ stdout: '/tmp/tinyroommate-pr7-followup\n', code: 0 });
          }
          return Promise.resolve({ stdout: '', code: 0 });
        }
        return Promise.resolve({ stdout: '', code: 0 });
      },
    };
  });
});

describe('parseResponse', () => {
  it('extracts text, state, reactions from clean JSON', () => {
    var result = parseResponse('{"text":"嗨 Boss!","state":"happy","r":["👋","😊"]}');
    expect(result.text).toBe('嗨 Boss!');
    expect(result.state).toBe('happy');
    expect(result.reactions).toEqual(['👋', '😊']);
  });

  it('handles quiet response (no text)', () => {
    var result = parseResponse('{"state":"idle"}');
    expect(result.text).toBe('');
    expect(result.state).toBe('idle');
  });

  it('ignores reasoning leaked before JSON', () => {
    var raw = '根据配置，我应该用中文回应。这是一个互动时刻。\n{"text":"嗨 Boss! 在呢!","state":"happy"}';
    var result = parseResponse(raw);
    expect(result.text).toBe('嗨 Boss! 在呢!');
    expect(result.text).not.toContain('根据');
  });

  it('ignores English reasoning leaked before JSON', () => {
    var raw = 'I should respond playfully here. Let me think about what to say.\n{"text":"Hey! What\'s up?","state":"happy"}';
    var result = parseResponse(raw);
    expect(result.text).toBe("Hey! What's up?");
    expect(result.text).not.toContain('should');
  });

  it('strips markdown from text field', () => {
    var result = parseResponse('{"text":"**they are in flow**","state":"idle"}');
    expect(result.text).toBe('they are in flow');
  });

  it('defaults to idle when no JSON found', () => {
    var result = parseResponse('just some random text');
    expect(result.state).toBe('idle');
    expect(result.text).toBe('');
  });

  it('handles empty input', () => {
    var result = parseResponse('');
    expect(result.state).toBe('idle');
    expect(result.text).toBe('');
  });

  it('limits reactions to 2', () => {
    var result = parseResponse('{"state":"happy","text":"hi","r":["a","b","c","d"]}');
    expect(result.reactions).toHaveLength(2);
  });

  it('picks last valid JSON when multiple present', () => {
    var raw = '{"foo":"bar"}\nsome reasoning\n{"text":"yo!","state":"walk"}';
    var result = parseResponse(raw);
    expect(result.text).toBe('yo!');
    expect(result.state).toBe('walk');
  });

  it('truncates long text to first sentence', () => {
    var result = parseResponse('{"text":"This is a really long sentence that goes on and on and on and on and keeps going forever and ever more. And another.","state":"idle"}');
    expect(result.text.length).toBeLessThanOrEqual(120);
  });
});

describe('AI provider helpers', () => {
  it('normalizes supported providers and rejects unknown values', () => {
    expect(normalizeAiProvider('Claude')).toBe('claude');
    expect(normalizeAiProvider(' gemini ')).toBe('gemini');
    expect(normalizeAiProvider('openai')).toBe('');
    expect(normalizeAiProvider('')).toBe('');
  });

  it('exposes both supported AI providers', () => {
    var providers = getSupportedAiProviders().map(function(provider) { return provider.id; });
    expect(providers).toContain('claude');
    expect(providers).toContain('gemini');
  });

  it('uses the newly selected provider without requiring a restart', async () => {
    saveConfigField('ai_provider', 'claude');
    saveConfigField('ai_provider', 'gemini');

    createMock.mockImplementation(function(command, args) {
      return {
        execute: function() {
          if (command === 'bash') {
            var script = Array.isArray(args) ? args[1] : '';
            if (script && script.indexOf('while [ ! -f "$dir/package.json" ]') >= 0) {
              return Promise.resolve({ stdout: '/tmp/tinyroommate-pr7-followup\n', code: 0 });
            }
            return Promise.resolve({ stdout: '', code: 0 });
          }
          if (command === 'gemini' && Array.isArray(args) && args[0] === '--version') {
            return Promise.resolve({ stdout: '1.0.0\n', code: 0 });
          }
          if (command === 'gemini' && Array.isArray(args) && args[0] === '-p') {
            return Promise.resolve({ stdout: '{"text":"hi from gemini","state":"happy"}', code: 0 });
          }
          throw new Error('Unexpected command: ' + command + ' ' + JSON.stringify(args || []));
        },
      };
    });

    var result = await think('say hi');

    expect(result).toEqual({
      text: 'hi from gemini',
      state: 'happy',
      reactions: [],
    });
    expect(createMock).toHaveBeenCalledWith('gemini', ['--version']);
    expect(
      createMock.mock.calls.some(function(call) {
        return call[0] === 'gemini' && Array.isArray(call[1]) && call[1][0] === '-p';
      })
    ).toBe(true);
  });
});

describe('template config defaults', () => {
  it('does not hard-code a default pet scale in the template', async () => {
    var text = await readFile(process.cwd() + '/.pet-data-template/config.md', 'utf8');
    expect(text).not.toContain('pet_scale: 1.5');
  });
});
