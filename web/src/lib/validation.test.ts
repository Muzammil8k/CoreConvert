import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateFile, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE } from './validation';
import type { ConversionSettings } from '@/src/types/conversion';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal ConversionSettings for HEIC → PNG (passes format-mapping check). */
const heicSettings: ConversionSettings = {
  targetFormat: 'PNG',
  quality: 85,
  autoDownload: true,
};

/** Minimal ConversionSettings for MOV → MP4 (passes format-mapping check). */
const movSettings: ConversionSettings = {
  targetFormat: 'MP4',
  quality: 85,
  autoDownload: true,
};

/**
 * Creates a minimal File-like object that passes all checks except size.
 * The `File` constructor is available in jsdom (vitest environment).
 */
function makeFile(name: string, mime: string, size: number): File {
  // We need a File whose `.size` property equals `size`. The File constructor
  // sets size from the content provided, so we pass a Blob of the right byte
  // count. For large files this would be impractical in a real environment, but
  // in jsdom / fast-check we use a single Uint8Array of the requested length.
  // To keep heap pressure low we create a zero-byte Blob and override `.size`
  // via Object.defineProperty on a cast copy — but the cleanest approach that
  // works with the actual `File` class in jsdom is to build the right Blob.
  //
  // For sizes up to ~10 MB jsdom handles allocation fine; for truly large sizes
  // (> 50 MB) we use a sparse ArrayBuffer trick supported by jsdom's Blob:
  // passing a DataView over a shared zero buffer and setting the length.
  //
  // The simplest reliable approach: subclass File to override the `size` getter.
  class SizedFile extends File {
    private readonly _size: number;
    constructor(name: string, mime: string, sz: number) {
      super([], name, { type: mime });
      this._size = sz;
    }
    override get size(): number {
      return this._size;
    }
  }
  return new SizedFile(name, mime, size);
}

// ── Property 1: File Size Rejection ──────────────────────────────────────────
// Feature: client-side-media-converter, Property 1
// Validates: Requirements 1.3, 1.4

describe('validateFile — Property 1: File Size Rejection', () => {
  it('rejects any HEIC file whose size exceeds MAX_IMAGE_SIZE with FILE_TOO_LARGE', () => {
    // Generate sizes in the range (MAX_IMAGE_SIZE, MAX_IMAGE_SIZE * 3]
    // to keep values bounded while covering all "too large" cases.
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_IMAGE_SIZE + 1, max: MAX_IMAGE_SIZE * 3 }),
        fc.constantFrom('image/heic' as const, 'image/heif' as const),
        fc.constantFrom('.heic' as const, '.heif' as const),
        (size, mime, ext) => {
          const file = makeFile(`photo${ext}`, mime, size);
          const result = validateFile(file, heicSettings);
          expect(result).toMatchObject({ valid: false, errorCode: 'FILE_TOO_LARGE' });
        },
      ),
    );
  });

  it('rejects any MOV file whose size exceeds MAX_VIDEO_SIZE with FILE_TOO_LARGE', () => {
    // Generate sizes in the range (MAX_VIDEO_SIZE, MAX_VIDEO_SIZE + 1 GB].
    const ONE_GB = 1_073_741_824;
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_VIDEO_SIZE + 1, max: MAX_VIDEO_SIZE + ONE_GB }),
        (size) => {
          const file = makeFile('video.mov', 'video/quicktime', size);
          const result = validateFile(file, movSettings);
          expect(result).toMatchObject({ valid: false, errorCode: 'FILE_TOO_LARGE' });
        },
      ),
    );
  });
});

// ── Property 2: Invalid Format Rejection ─────────────────────────────────────
// Feature: client-side-media-converter, Property 2
// Validates: Requirements 1.2

describe('validateFile — Property 2: Invalid Format Rejection', () => {
  it('rejects any MIME type not in Supported_Input_Format with UNSUPPORTED_FORMAT', () => {
    const supportedMimes = new Set(['image/heic', 'image/heif', 'video/quicktime']);
    const settings: ConversionSettings = { targetFormat: 'PNG', quality: 85, autoDownload: true };

    fc.assert(
      fc.property(
        // Generate arbitrary non-empty strings that are not supported MIME types.
        fc.string().filter((s) => s !== '' && !supportedMimes.has(s)),
        (mime) => {
          // Use a .heic extension so only the MIME triggers rejection
          const file = makeFile('photo.heic', mime, 1024);
          const result = validateFile(file, settings);
          expect(result).toMatchObject({ valid: false, errorCode: 'UNSUPPORTED_FORMAT' });
        },
      ),
    );
  });
});

// ── Property 3: Format Mapping Constraint ─────────────────────────────────────
// Feature: client-side-media-converter, Property 3
// Validates: Requirements 2.3

describe('validateFile — Property 3: Format Mapping Constraint', () => {
  it('allows only valid input→output pairs and rejects invalid ones', () => {
    type Pair = { mime: string; ext: string; target: ConversionSettings['targetFormat']; expectValid: boolean };

    fc.assert(
      fc.property(
        fc.constantFrom<Pair>(
          // Valid pairs
          { mime: 'image/heic', ext: '.heic', target: 'PNG', expectValid: true },
          { mime: 'image/heic', ext: '.heic', target: 'JPG', expectValid: true },
          { mime: 'video/quicktime', ext: '.mov', target: 'MP4', expectValid: true },
          // Invalid pairs
          { mime: 'image/heic', ext: '.heic', target: 'MP4', expectValid: false },
          { mime: 'video/quicktime', ext: '.mov', target: 'PNG', expectValid: false },
          { mime: 'video/quicktime', ext: '.mov', target: 'JPG', expectValid: false },
        ),
        ({ mime, ext, target, expectValid }) => {
          // Use a size well within limits so only the format-mapping check can trigger
          const file = makeFile(`file${ext}`, mime, 1024);
          const settings: ConversionSettings = { targetFormat: target, quality: 85, autoDownload: true };
          const result = validateFile(file, settings);

          if (expectValid) {
            expect(result).toMatchObject({ valid: true });
          } else {
            expect(result).toMatchObject({ valid: false, errorCode: 'UNSUPPORTED_FORMAT' });
          }
        },
      ),
    );
  });
});

// ── Unit tests: validateFile() ────────────────────────────────────────────────
// Validates: Requirements 1.1–1.4, 2.3

describe('validateFile — unit tests', () => {
  // 1. Valid HEIC → PNG
  it('returns { valid: true } for a valid HEIC file converted to PNG', () => {
    const file = makeFile('photo.heic', 'image/heic', 1024);
    expect(validateFile(file, { targetFormat: 'PNG', quality: 85, autoDownload: true })).toEqual({ valid: true });
  });

  // 2. Valid HEIC → JPG
  it('returns { valid: true } for a valid HEIC file converted to JPG', () => {
    const file = makeFile('photo.heic', 'image/heic', 1024);
    expect(validateFile(file, { targetFormat: 'JPG', quality: 85, autoDownload: true })).toEqual({ valid: true });
  });

  // 3. Valid MOV → MP4
  it('returns { valid: true } for a valid MOV file converted to MP4', () => {
    const file = makeFile('video.mov', 'video/quicktime', 1024);
    expect(validateFile(file, { targetFormat: 'MP4', quality: 85, autoDownload: true })).toEqual({ valid: true });
  });

  // 4. Invalid MIME type (image/jpeg with .heic extension) → UNSUPPORTED_FORMAT
  it('returns UNSUPPORTED_FORMAT when MIME type is not supported', () => {
    const file = makeFile('photo.heic', 'image/jpeg', 1024);
    const result = validateFile(file, { targetFormat: 'PNG', quality: 85, autoDownload: true });
    expect(result).toMatchObject({ valid: false, errorCode: 'UNSUPPORTED_FORMAT' });
  });

  // 5. Empty MIME type with uppercase .HEIC extension should be accepted
  it('accepts a .HEIC file with an empty MIME type', () => {
    const file = makeFile('IMG_4905.HEIC', '', 1024);
    expect(validateFile(file, { targetFormat: 'PNG', quality: 85, autoDownload: true })).toEqual({ valid: true });
  });

  // 6. Invalid extension (image/heic MIME but .jpg filename) → UNSUPPORTED_FORMAT
  it('returns UNSUPPORTED_FORMAT when file extension is not supported', () => {
    const file = makeFile('photo.jpg', 'image/heic', 1024);
    const result = validateFile(file, { targetFormat: 'PNG', quality: 85, autoDownload: true });
    expect(result).toMatchObject({ valid: false, errorCode: 'UNSUPPORTED_FORMAT' });
  });

  // 6. HEIC at exactly MAX_IMAGE_SIZE bytes (boundary: exactly at limit is valid)
  it('returns { valid: true } for a HEIC file at exactly MAX_IMAGE_SIZE bytes', () => {
    const file = makeFile('photo.heic', 'image/heic', MAX_IMAGE_SIZE);
    expect(validateFile(file, { targetFormat: 'PNG', quality: 85, autoDownload: true })).toEqual({ valid: true });
  });

  // 7. HEIC at MAX_IMAGE_SIZE + 1 byte → FILE_TOO_LARGE
  it('returns FILE_TOO_LARGE for a HEIC file one byte over MAX_IMAGE_SIZE', () => {
    const file = makeFile('photo.heic', 'image/heic', MAX_IMAGE_SIZE + 1);
    const result = validateFile(file, { targetFormat: 'PNG', quality: 85, autoDownload: true });
    expect(result).toMatchObject({ valid: false, errorCode: 'FILE_TOO_LARGE' });
  });

  // 8. MOV at MAX_VIDEO_SIZE + 1 byte → FILE_TOO_LARGE
  it('returns FILE_TOO_LARGE for a MOV file one byte over MAX_VIDEO_SIZE', () => {
    const file = makeFile('video.mov', 'video/quicktime', MAX_VIDEO_SIZE + 1);
    const result = validateFile(file, { targetFormat: 'MP4', quality: 85, autoDownload: true });
    expect(result).toMatchObject({ valid: false, errorCode: 'FILE_TOO_LARGE' });
  });
});
