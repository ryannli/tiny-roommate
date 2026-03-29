import { describe, it, expect, vi, beforeEach } from 'vitest';

// signals.js imports brain.js which imports shell plugin — both are mocked in setup.js
const { getTimeSignals, buildContextString, getIdleSeconds } = await import('../signals.js');

describe('getTimeSignals', () => {
  it('returns an object with expected keys', function() {
    var signals = getTimeSignals();
    expect(signals).toHaveProperty('time');
    expect(signals).toHaveProperty('timeOfDay');
    expect(signals).toHaveProperty('dayOfWeek');
    expect(signals).toHaveProperty('isWeekend');
    expect(signals).toHaveProperty('hour');
  });

  it('hour is between 0 and 23', function() {
    var signals = getTimeSignals();
    expect(signals.hour).toBeGreaterThanOrEqual(0);
    expect(signals.hour).toBeLessThanOrEqual(23);
  });

  it('dayOfWeek is a valid day name', function() {
    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var signals = getTimeSignals();
    expect(days).toContain(signals.dayOfWeek);
  });

  it('isWeekend matches Saturday or Sunday', function() {
    var signals = getTimeSignals();
    var day = new Date().getDay();
    expect(signals.isWeekend).toBe(day === 0 || day === 6);
  });

  it('timeOfDay covers all hour ranges', function() {
    var validTimes = ['late night', 'early morning', 'morning', 'lunch time', 'afternoon', 'evening', 'night'];
    var signals = getTimeSignals();
    expect(validTimes).toContain(signals.timeOfDay);
  });
});

describe('buildContextString', () => {
  var fakeSignals = {
    time: '10:00 AM',
    timeOfDay: 'morning',
    dayOfWeek: 'Monday',
    isWeekend: false,
    hour: 10,
  };

  it('includes time info', function() {
    var result = buildContextString(fakeSignals, 0, null);
    expect(result).toContain('10:00 AM');
    expect(result).toContain('morning');
    expect(result).toContain('Monday');
  });

  it('does not include weekend text on weekday', function() {
    var result = buildContextString(fakeSignals, 0, null);
    expect(result).not.toContain('weekend');
  });

  it('includes weekend text on weekend', function() {
    var weekend = { ...fakeSignals, isWeekend: true };
    var result = buildContextString(weekend, 0, null);
    expect(result).toContain('weekend');
  });

  it('includes idle time when over 60 seconds', function() {
    var result = buildContextString(fakeSignals, 120, null);
    expect(result).toContain('idle');
    expect(result).toContain('2 minutes');
  });

  it('does not include idle text when under 60 seconds', function() {
    var result = buildContextString(fakeSignals, 30, null);
    expect(result).not.toContain('idle');
  });

  it('includes screen context when provided', function() {
    var result = buildContextString(fakeSignals, 0, 'editing code in VS Code');
    expect(result).toContain('editing code in VS Code');
  });

  it('omits screen context when null', function() {
    var result = buildContextString(fakeSignals, 0, null);
    expect(result).not.toContain('screen');
  });
});

describe('getIdleSeconds', () => {
  it('returns a non-negative number', function() {
    var idle = getIdleSeconds();
    expect(idle).toBeGreaterThanOrEqual(0);
  });
});
