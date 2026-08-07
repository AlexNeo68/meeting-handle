import { parseLanguage, parseProgress } from './progress.parser';

describe('parseProgress', () => {
  it('parses padded progress', () => {
    expect(parseProgress('whisper_print_progress_callback: progress =  45%')).toBe(45);
  });

  it('parses progress at 100%', () => {
    expect(parseProgress('whisper_print_progress_callback: progress = 100%')).toBe(100);
  });

  it('parses progress at 0%', () => {
    expect(parseProgress('whisper_print_progress_callback: progress = 0%')).toBe(0);
  });

  it('returns null when there is no match', () => {
    expect(parseProgress('whisper_print_progress_callback: progress')).toBeNull();
    expect(parseProgress('some unrelated line')).toBeNull();
    expect(parseProgress('')).toBeNull();
  });

  it('clamps values above 100', () => {
    expect(parseProgress('whisper_print_progress_callback: progress = 150%')).toBe(100);
  });
});

describe('parseLanguage', () => {
  it('parses detected language from stderr line', () => {
    expect(parseLanguage('whisper_full_with_state: auto-detected language: ru (p = 0.920000)')).toBe('ru');
  });

  it('parses english detection', () => {
    expect(parseLanguage('whisper_full_with_state: auto-detected language: en (p = 0.9)')).toBe('en');
  });

  it('matches uppercase language codes case-insensitively', () => {
    expect(parseLanguage('whisper_full_with_state: auto-detected language: RU (p = 0.9)')).toBe('ru');
  });

  it('returns null when there is no match', () => {
    expect(parseLanguage('whisper_full_with_state: processing audio')).toBeNull();
    expect(parseLanguage('')).toBeNull();
  });
});
