import { describe, it, expect } from 'vitest';
import { deriveOutputFilename } from './filename';

describe('deriveOutputFilename', () => {
  // Basic extension replacement
  it('replaces .heic with .png', () => {
    expect(deriveOutputFilename('photo.heic', 'PNG')).toBe('photo.png');
  });

  it('replaces .heic with .jpg', () => {
    expect(deriveOutputFilename('photo.heic', 'JPG')).toBe('photo.jpg');
  });

  it('replaces .mov with .mp4', () => {
    expect(deriveOutputFilename('video.mov', 'MP4')).toBe('video.mp4');
  });

  // Only the last extension segment is replaced
  it('strips only the last extension for multi-dot filenames', () => {
    expect(deriveOutputFilename('my.photo.heic', 'PNG')).toBe('my.photo.png');
  });

  it('handles multiple dots, replacing only the last segment', () => {
    expect(deriveOutputFilename('a.b.c.mov', 'MP4')).toBe('a.b.c.mp4');
  });

  // No extension — append the new one
  it('appends extension when filename has no dot', () => {
    expect(deriveOutputFilename('photo', 'PNG')).toBe('photo.png');
  });

  it('appends extension for a bare name with MP4 target', () => {
    expect(deriveOutputFilename('myvideo', 'MP4')).toBe('myvideo.mp4');
  });

  // Extension casing — output is always lowercase
  it('produces lowercase extension regardless of input casing', () => {
    expect(deriveOutputFilename('IMG.HEIC', 'JPG')).toBe('IMG.jpg');
  });
});
