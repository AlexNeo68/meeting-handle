import { describe, expect, it, vi } from 'vitest';
import { formatDate } from './format-date';

describe('formatDate', () => {
  it('formats an ISO date as dd.mm.yyyy in ru-RU locale', () => {
    expect(formatDate('2026-08-05T12:00:00.000Z')).toBe('05.08.2026');
  });

  it('zero-pads single-digit day and month', () => {
    expect(formatDate('2026-03-04T12:00:00.000Z')).toBe('04.03.2026');
  });

  it('handles a date-only string', () => {
    expect(formatDate('2026-12-31')).toBe('31.12.2026');
  });

  it('handles an invalid date string without throwing', () => {
    const result = formatDate('not-a-date');
    expect(Number.isNaN(Date.parse('not-a-date'))).toBe(true);
    expect(typeof result).toBe('string');
  });

  it('localizes the format via ru-RU locale', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString');
    formatDate('2026-08-05T12:00:00.000Z');
    expect(spy).toHaveBeenCalledWith('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    spy.mockRestore();
  });
});
