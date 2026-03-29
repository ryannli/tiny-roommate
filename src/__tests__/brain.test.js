import { describe, it, expect, vi } from 'vitest';

// Mock Tauri shell plugin before importing brain
vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: { create: () => ({ execute: () => Promise.resolve({ stdout: '', code: 0 }) }) },
}));

const { parseResponse, normalizeAiProvider, getSupportedAiProviders } = await import('../brain.js');

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
});
