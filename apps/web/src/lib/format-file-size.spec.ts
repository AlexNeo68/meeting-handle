import { describe, expect, it } from 'vitest';
import { formatFileSize } from './format-file-size';

describe('formatFileSize', () => {
  it('formats bytes as plain bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatFileSize(5.5 * 1024 * 1024)).toBe('5.5 MB');
  });

  it('formats gigabytes and terabytes', () => {
    expect(formatFileSize(2 * 1024 ** 3)).toBe('2 GB');
    expect(formatFileSize(3 * 1024 ** 4)).toBe('3 TB');
  });

  it('falls back to the largest unit for very large sizes', () => {
    expect(formatFileSize(1024 ** 6)).toMatch(/TB$/);
  });

  it('returns an empty string for invalid input', () => {
    expect(formatFileSize(-1)).toBe('');
    expect(formatFileSize(Number.NaN)).toBe('');
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe('');
  });
});
