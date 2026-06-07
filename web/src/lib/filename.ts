import type { OutputFormat } from '@/src/types/conversion';

const EXT_MAP: Record<OutputFormat, string> = {
  PNG: 'png',
  JPG: 'jpg',
  MP4: 'mp4',
};

/**
 * Derives the output filename by replacing the last dot-delimited extension
 * with the lowercase extension for the given target format.
 *
 * Examples:
 *   deriveOutputFilename('photo.heic', 'PNG')      → 'photo.png'
 *   deriveOutputFilename('my.photo.heic', 'PNG')   → 'my.photo.png'
 *   deriveOutputFilename('photo', 'PNG')            → 'photo.png'
 */
export function deriveOutputFilename(
  inputFilename: string,
  targetFormat: OutputFormat,
): string {
  const ext = EXT_MAP[targetFormat];
  const dotIndex = inputFilename.lastIndexOf('.');

  const stem = dotIndex === -1 ? inputFilename : inputFilename.slice(0, dotIndex);
  return `${stem}.${ext}`;
}
