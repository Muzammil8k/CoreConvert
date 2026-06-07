/**
 * ConversionWorker — runs FFmpeg.wasm off the main thread.
 *
 * Communication protocol:
 *   Main → Worker : WorkerCommand  (CONVERT | CANCEL)
 *   Worker → Main : WorkerEvent   (PROGRESS | COMPLETE | ERROR | CANCELLED)
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { ConversionSettings, ErrorCode, WorkerCommand, WorkerEvent } from '@/src/types/conversion';
import { ErrorCode as EC } from '@/src/types/conversion';
import { deriveOutputFilename } from '../lib/filename';

// ---------------------------------------------------------------------------
// FFmpeg instance factory — a fresh instance is created per job to avoid
// FS state corruption between conversions after terminate().
// ---------------------------------------------------------------------------
let currentFFmpeg: FFmpeg | null = null;

// Use the full ffmpeg-core-mt build which includes HEIC/HEIF decoders and all codecs.
// Files are served from /public/ffmpeg/ (copied there from node_modules at setup time).
const FFMPEG_BASE = '/ffmpeg';

async function getFFmpeg(): Promise<FFmpeg> {
  // Always start fresh — terminate any lingering instance first
  if (currentFFmpeg) {
    try { currentFFmpeg.terminate(); } catch { /* ignore */ }
    currentFFmpeg = null;
  }
  const instance = new FFmpeg();
  await instance.load({
    coreURL: `${FFMPEG_BASE}/ffmpeg-core.js`,
    wasmURL: `${FFMPEG_BASE}/ffmpeg-core.wasm`,
    workerURL: `${FFMPEG_BASE}/ffmpeg-core.worker.js`,
  });
  currentFFmpeg = instance;
  return instance;
}

// ---------------------------------------------------------------------------
// Per-job cancellation flags
// ---------------------------------------------------------------------------
const cancelFlags = new Map<string, boolean>();

// ---------------------------------------------------------------------------
// FFmpeg command builder (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Builds the FFmpeg argument array for a conversion job.
 *
 * - HEIC → PNG : simple decode
 * - HEIC → JPG : decode with quality mapping (FFmpeg -q:v 1–31, inverted)
 * - MOV  → MP4 : remux with stream copy (default; transcode would require codec probing)
 */
export function buildFFmpegCommand(
  inputFilename: string,
  outputFilename: string,
  settings: ConversionSettings,
): string[] {
  switch (settings.targetFormat) {
    case 'PNG':
      return ['-i', inputFilename, outputFilename];

    case 'JPG': {
      // Map quality 1–100 → FFmpeg JPEG q:v 31–1 (inverted: higher quality = lower number)
      const qv = Math.round(31 - (settings.quality / 100) * 30);
      return ['-i', inputFilename, '-q:v', String(qv), '-map_metadata', '0', outputFilename];
    }

    case 'MP4':
    default:
      // Default: remux with stream copy (no transcode); works for H.264 / H.265 sources.
      // Transcode fallback (other codecs) would require runtime codec detection which is
      // not available at command-build time without probing.
      return ['-i', inputFilename, '-c', 'copy', outputFilename];
  }
}

// ---------------------------------------------------------------------------
// Error mapping helper
// ---------------------------------------------------------------------------

function mapErrorToCode(err: unknown): { code: ErrorCode; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes('out of memory') || lower.includes('oom') || lower.includes('wasm')) {
    return { code: EC.OUT_OF_MEMORY, message };
  }
  if (lower.includes('storage') || lower.includes('quota') || lower.includes('disk')) {
    return { code: EC.INSUFFICIENT_STORAGE, message };
  }
  if (lower.includes('invalid data') || lower.includes('corrupt') || lower.includes('moov atom')) {
    return { code: EC.CORRUPT_INPUT, message };
  }
  if (lower.includes('codec') || lower.includes('decoder not found') || lower.includes('encoder not found')) {
    return { code: EC.UNSUPPORTED_CODEC, message };
  }
  return { code: EC.UNKNOWN, message };
}

// ---------------------------------------------------------------------------
// Post helpers (typed, no `any`)
// ---------------------------------------------------------------------------

function post(event: WorkerEvent): void {
  self.postMessage(event);
}

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

async function processConvert(command: Extract<WorkerCommand, { type: 'CONVERT' }>): Promise<void> {
  const { jobId, file, filename, settings } = command;

  // Check cancellation before starting
  if (cancelFlags.get(jobId)) {
    cancelFlags.delete(jobId);
    post({ type: 'CANCELLED', jobId });
    return;
  }

  const outputFilename = deriveOutputFilename(filename, settings.targetFormat!);

  // Get a fresh FFmpeg instance for this job
  let ffmpeg: FFmpeg;
  try {
    ffmpeg = await getFFmpeg();
  } catch (err: unknown) {
    const { code, message } = mapErrorToCode(err);
    post({ type: 'ERROR', jobId, code, message });
    return;
  }

  // Register progress listener for this job
  const progressHandler = ({ progress }: { progress: number }): void => {
    post({ type: 'PROGRESS', jobId, percent: Math.round(progress * 100) });
  };
  ffmpeg.on('progress', progressHandler);

  try {
    // Write input file into WASM virtual FS
    await ffmpeg.writeFile(filename, await fetchFile(new Blob([file])));

    // Build and execute command
    const args = buildFFmpegCommand(filename, outputFilename, settings);
    await ffmpeg.exec(args);

    // Read output
    const data = await ffmpeg.readFile(outputFilename);

    // Clean up virtual FS entries
    await ffmpeg.deleteFile(filename);
    await ffmpeg.deleteFile(outputFilename);

    // Convert FileData to Uint8Array (readFile returns Uint8Array | string)
    const output = data instanceof Uint8Array ? data : new TextEncoder().encode(data);

    post({ type: 'COMPLETE', jobId, output, outputFilename });
  } catch (err: unknown) {
    const { code, message } = mapErrorToCode(err);
    // Best-effort cleanup
    try { await ffmpeg.deleteFile(filename); } catch { /* ignore */ }
    try { await ffmpeg.deleteFile(outputFilename); } catch { /* ignore */ }
    post({ type: 'ERROR', jobId, code, message });
  } finally {
    ffmpeg.off('progress', progressHandler);
    // Terminate the instance — next job will create a fresh one
    try { ffmpeg.terminate(); } catch { /* ignore */ }
    if (currentFFmpeg === ffmpeg) currentFFmpeg = null;
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = (event: MessageEvent<WorkerCommand>): void => {
  const command = event.data;

  switch (command.type) {
    case 'CONVERT':
      processConvert(command).catch((err: unknown) => {
        // Unhandled rejection guard — should not normally be reached
        const { code, message } = mapErrorToCode(err);
        post({ type: 'ERROR', jobId: command.jobId, code, message });
      });
      break;

    case 'CANCEL':
      cancelFlags.set(command.jobId, true);
      break;

    default: {
      // Exhaustiveness check — TypeScript will error if a variant is unhandled
      const _exhaustive: never = command;
      void _exhaustive;
      break;
    }
  }
};
