import { describe, expect, it } from 'vitest';
import {
  ACCEPT_ATTR,
  ALLOWED_MIME_TYPES,
  ALLOWED_MIME_PREFIXES,
  getFileKind,
  isAllowedMime,
  MAX_FILE_SIZE,
  MAX_AVATAR_SIZE,
  ALLOWED_AVATAR_MIME_TYPES,
  AVATAR_ACCEPT_ATTR,
} from './index';

describe('isAllowedMime', () => {
  it.each(ALLOWED_MIME_TYPES)('allows the exact mime type %s', (mime) => {
    expect(isAllowedMime(mime)).toBe(true);
  });

  it('allows mime types matching an allowed prefix', () => {
    expect(isAllowedMime('audio/mpeg')).toBe(true);
    expect(isAllowedMime('audio/wav')).toBe(true);
    expect(isAllowedMime('video/mp4')).toBe(true);
    expect(
      isAllowedMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).toBe(true);
    expect(
      isAllowedMime('application/vnd.openxmlformats-officedocument.presentationml.presentation'),
    ).toBe(true);
  });

  it('rejects unknown mime types', () => {
    expect(isAllowedMime('application/octet-stream')).toBe(false);
    expect(isAllowedMime('image/png')).toBe(false);
    expect(isAllowedMime('')).toBe(false);
  });

  it('rejects prefixes that only partially match', () => {
    expect(isAllowedMime('video')).toBe(false);
    expect(isAllowedMime('audio/')).toBe(true);
    expect(isAllowedMime('application/vnd.openxmlformats-')).toBe(false);
  });
});

describe('getFileKind', () => {
  it('classifies audio mime types', () => {
    expect(getFileKind('audio/mpeg')).toBe('audio');
    expect(getFileKind('audio/wav')).toBe('audio');
  });

  it('classifies video mime types', () => {
    expect(getFileKind('video/mp4')).toBe('video');
    expect(getFileKind('video/webm')).toBe('video');
  });

  it('classifies pdf exactly', () => {
    expect(getFileKind('application/pdf')).toBe('pdf');
  });

  it('classifies word docs and openxml office documents', () => {
    expect(getFileKind('application/msword')).toBe('doc');
    expect(
      getFileKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).toBe('doc');
    expect(getFileKind('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(
      'doc',
    );
  });

  it('falls back to other for unknown mime types', () => {
    expect(getFileKind('application/octet-stream')).toBe('other');
    expect(getFileKind('')).toBe('other');
  });

  it('prefers the audio prefix over generic classification', () => {
    expect(getFileKind('audio/vnd.openxmlformats-officedocument')).toBe('audio');
  });
});

describe('shared constants', () => {
  it('defines the expected file limits', () => {
    expect(MAX_FILE_SIZE).toBe(100 * 1024 * 1024);
    expect(MAX_AVATAR_SIZE).toBe(5 * 1024 * 1024);
  });

  it('accepts attribute covers all allowed types and prefixes', () => {
    expect(ACCEPT_ATTR).toContain('application/pdf');
    expect(ACCEPT_ATTR).toContain('application/msword');
    expect(ACCEPT_ATTR).toContain('audio/*');
    expect(ACCEPT_ATTR).toContain('video/*');
    expect(ACCEPT_ATTR).toContain('application/vnd.openxmlformats-officedocument.*');
  });

  it('allows only jpeg, png and webp avatars', () => {
    expect(ALLOWED_AVATAR_MIME_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect(AVATAR_ACCEPT_ATTR).toBe('image/jpeg,image/png,image/webp');
  });

  it('prefix list matches audio, video and openxml', () => {
    expect(ALLOWED_MIME_PREFIXES).toEqual([
      'audio/',
      'video/',
      'application/vnd.openxmlformats-officedocument.',
    ]);
  });
});
