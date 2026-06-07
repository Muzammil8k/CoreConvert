/**
 * conversionEngine.ts
 *
 * Loads @ffmpeg/ffmpeg and @ffmpeg/core-mt via toBlobURL from CDN.
 * classWorkerURL is also converted to a blob URL so COEP does not block it.
 * Runs FFmpeg on the main thread (async — does not block UI).
 */


import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { ConversionSettings } from '@/src/types/conversion';
import { ErrorCode } from '@/src/types/conversion';
import { deriveOutputFilename } from '@/src/lib/filename';


const BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

// ---------------------------------------------------------------------------
// FFmpeg command builder
// ---------------------------------------------------------------------------

export function buildFFmpegCommand(
  inputFilename: string,
  outputFilename: string,
  settings: ConversionSettings,
): string[] {
  const args = ['-i', inputFilename];

  switch (settings.targetFormat) {
    case 'PNG':
      args.push(outputFilename);
      break;

    case 'JPG': {
      // FFmpeg JPEG quality scale is 2-31 (lower number = better quality).
      // Mapping the UI's 1-100 scale to FFmpeg's 31-2 scale.
      const qv = Math.round(31 - (settings.quality / 100) * 30);
      // Clamp values safely between 2 and 31
      const safeQv = Math.max(2, Math.min(31, qv));
      
      args.push('-q:v', String(safeQv), '-map_metadata', '0', outputFilename);
      break;
    }

    case 'MP4':
    default: {
      // --- VIDEO RESOLUTION LOGIC ---
      if (settings.videoResolution === '1080p') {
        // Re-encodes the video, scaling height to 1080px and auto-calculating width
        args.push('-vf', 'scale=-2:1080', outputFilename);
      } else if (settings.videoResolution === '720p') {
        // Re-encodes the video, scaling height to 720px and auto-calculating width
        args.push('-vf', 'scale=-2:720', outputFilename);
      } else {
        // "Original" Resolution: Bypasses re-encoding entirely for lightning-fast conversions
        args.push('-c', 'copy', outputFilename);
      }
      break;
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

export function mapErrorToCode(err: unknown): { code: ErrorCode; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes('out of memory') || lower.includes('oom'))
    return { code: ErrorCode.OUT_OF_MEMORY, message };
  if (lower.includes('storage') || lower.includes('quota') || lower.includes('disk'))
    return { code: ErrorCode.INSUFFICIENT_STORAGE, message };
  if (lower.includes('invalid data') || lower.includes('corrupt') || lower.includes('moov atom'))
    return { code: ErrorCode.CORRUPT_INPUT, message };
  if (lower.includes('codec') || lower.includes('decoder not found') || lower.includes('encoder not found'))
    return { code: ErrorCode.UNSUPPORTED_CODEC, message };
  return { code: ErrorCode.UNKNOWN, message };
}

// ---------------------------------------------------------------------------
// Conversion result
// ---------------------------------------------------------------------------

export type ConversionResult =
  | { success: true; output: Uint8Array; outputFilename: string }
  | { success: false; code: ErrorCode; message: string };

// ---------------------------------------------------------------------------
// convertFile
// ---------------------------------------------------------------------------

export async function convertFile(
  file: ArrayBuffer,
  filename: string,
  settings: ConversionSettings,
  onProgress: (percent: number) => void,
  cancelSignal: { cancelled: boolean },
): Promise<ConversionResult> {
  if (cancelSignal.cancelled)
    return { success: false, code: ErrorCode.CANCELLED_BY_USER, message: 'Cancelled' };

const outputFilename = deriveOutputFilename(filename, settings.targetFormat || 'MP4');

  // ==========================================
  // ENGINE 1: HEIC Image Processing
  // ==========================================
// ==========================================
  // ENGINE 1: HEIC Image Processing
  // ==========================================
  if (filename.toLowerCase().endsWith('.heic')) {
    try {
      console.log('[convertFile] Routing to heic2any engine...');
      onProgress(10); 

      // 1. Dynamically import heic2any ONLY in the browser when needed
      const heic2any = (await import('heic2any')).default;

      const inputBlob = new Blob([file], { type: 'image/heic' });
      const targetMime = settings.targetFormat === 'PNG' ? 'image/png' : 'image/jpeg';
      
      const convertedBlob = await heic2any({
        blob: inputBlob,
        toType: targetMime,
        quality: settings.quality / 100, 
      });

      onProgress(100); 

      const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      const arrayBuffer = await finalBlob.arrayBuffer();
      const output = new Uint8Array(arrayBuffer);

      console.log('[convertFile] HEIC success, bytes:', output.length);
      return { success: true, output, outputFilename };

    } catch (err: unknown) {
      console.error('[convertFile] HEIC error:', err);
      return { success: false, code: ErrorCode.UNKNOWN, message: 'Failed to parse HEIC image.' };
    }
  }

  // ==========================================
  // ENGINE 2: Video Processing (FFmpeg)
  // ==========================================
  const ffmpeg = new FFmpeg();

  const progressHandler = ({ progress }: { progress: number }) =>
    onProgress(Math.round(progress * 100));
  ffmpeg.on('progress', progressHandler);

  try {
    console.log('[convertFile] Routing to FFmpeg engine...');
    console.log('[convertFile] Fetching core blobs...');

    // Convert CDN URLs to blob URLs to satisfy browser security
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${BASE}/ffmpeg-core.js`, 'text/javascript'),
      toBlobURL(`${BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    ]);

    console.log('[convertFile] Loading FFmpeg...');
    await ffmpeg.load({ coreURL, wasmURL });
    console.log('[convertFile] Loaded, converting', filename);

    if (cancelSignal.cancelled)
      return { success: false, code: ErrorCode.CANCELLED_BY_USER, message: 'Cancelled' };

    await ffmpeg.writeFile(filename, await fetchFile(new Blob([file])));
    const args = buildFFmpegCommand(filename, outputFilename, settings);
    console.log('[convertFile] exec:', args.join(' '));
    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile(outputFilename);
    await ffmpeg.deleteFile(filename).catch(() => {});
    await ffmpeg.deleteFile(outputFilename).catch(() => {});

    const output = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
    console.log('[convertFile] success, bytes:', output.length);
    return { success: true, output, outputFilename };

  } catch (err: unknown) {
    console.error('[convertFile] error:', err);
    const { code, message } = mapErrorToCode(err);
    try { await ffmpeg.deleteFile(filename); } catch { /* ignore */ }
    try { await ffmpeg.deleteFile(outputFilename); } catch { /* ignore */ }
    return { success: false, code, message };
  } finally {
    ffmpeg.off('progress', progressHandler);
    try { ffmpeg.terminate(); } catch { /* ignore */ }
  }
}

