import { ErrorCode } from '@/src/types/conversion';
import type { ConversionSettings } from '@/src/types/conversion';

// ── Exported constants ────────────────────────────────────────────────────────

export const MAX_IMAGE_SIZE = 50 * 1024 * 1024;        // 50 MB
export const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024;  // 2 GB

export const SUPPORTED_MIME_TYPES = [
  'image/heic',
  'image/heif',
  'video/quicktime',
] as const;

export const SUPPORTED_EXTENSIONS = ['.heic', '.heif', '.mov'] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type ValidationResult =
  | { valid: true }
  | { valid: false; errorCode: ErrorCode; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true when the MIME type belongs to an image input (HEIC/HEIF). */
function isImageMime(mime: string): boolean {
  return mime === 'image/heic' || mime === 'image/heif';
}

/** Returns true when the MIME type belongs to a video input (MOV). */
function isVideoMime(mime: string): boolean {
  return mime === 'video/quicktime';
}

// ── validateFile ──────────────────────────────────────────────────────────────

/**
 * Validates a `File` against the accepted MIME types, file extensions, size
 * limits, and the permitted input→output format mapping.
 *
 * Checks are applied in this order:
 *   1. MIME type
 *   2. File extension (secondary guard, case-insensitive)
 *   3. File size
 *   4. Format mapping (input vs. requested output format)
 *
 * Returns `{ valid: true }` when all checks pass, or
 * `{ valid: false, errorCode, message }` on the first failing check.
 */
export function validateFile(
  file: File,
  settings: ConversionSettings,
): ValidationResult {
  const mime = file.type;
  const nameLower = file.name.toLowerCase();

  // 1. MIME type and extension check ─────────────────────────────────────────────
  const mimeOk = (SUPPORTED_MIME_TYPES as readonly string[]).includes(mime);
  const extOk = (SUPPORTED_EXTENSIONS as readonly string[]).some((ext) =>
    nameLower.endsWith(ext),
  );

  if (!mimeOk && mime !== '') {
    return {
      valid: false,
      errorCode: ErrorCode.UNSUPPORTED_FORMAT,
      message: `"${file.name}" is not a supported format. Accepted formats: HEIC, MOV.`,
    };
  }

  if (!extOk) {
    return {
      valid: false,
      errorCode: ErrorCode.UNSUPPORTED_FORMAT,
      message: `"${file.name}" has an unsupported file extension. Accepted extensions: .heic, .heif, .mov.`,
    };
  }

  const isImage = isImageMime(mime) || nameLower.endsWith('.heic') || nameLower.endsWith('.heif');
  const isVideo = isVideoMime(mime) || nameLower.endsWith('.mov');

  // 2. Size check ──────────────────────────────────────────────────────────────
  if (isImage) {
    if (file.size > MAX_IMAGE_SIZE) {
      return {
        valid: false,
        errorCode: ErrorCode.FILE_TOO_LARGE,
        message: `"${file.name}" exceeds the 50 MB image limit. Please select a smaller file.`,
      };
    }
  } else if (isVideo) {
    if (file.size > MAX_VIDEO_SIZE) {
      return {
        valid: false,
        errorCode: ErrorCode.FILE_TOO_LARGE,
        message: `"${file.name}" exceeds the 2 GB video limit. Please select a smaller file.`,
      };
    }
  }

  // 3. Format mapping check ────────────────────────────────────────────────────
  const target = settings.targetFormat;

  if (isImage) {
    // HEIC/HEIF may only target PNG or JPG
    if (target !== 'PNG' && target !== 'JPG') {
      return {
        valid: false,
        errorCode: ErrorCode.UNSUPPORTED_FORMAT,
        message: `HEIC/HEIF files can only be converted to PNG or JPG, not ${target}.`,
      };
    }
  } else if (isVideo) {
    // MOV may only target MP4
    if (target !== 'MP4') {
      return {
        valid: false,
        errorCode: ErrorCode.UNSUPPORTED_FORMAT,
        message: `MOV files can only be converted to MP4, not ${target}.`,
      };
    }
  }

  // All checks passed ──────────────────────────────────────────────────────────
  return { valid: true };
}
