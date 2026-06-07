/**
 * conversion-worker.js — module worker served from /public/ffmpeg/
 *
 * Uses @ffmpeg/ffmpeg + @ffmpeg/util from CDN via toBlobURL so that
 * webpack never intercepts the dynamic imports inside @ffmpeg/ffmpeg.
 * Loaded as a module worker via classWorkerURL so import() works.
 */

import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.2/dist/esm/index.js';

const BASE_URL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';

let ffmpegInstance = null;

async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;

  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL:   await toBlobURL(`${BASE_URL}/ffmpeg-core.js`,        'text/javascript'),
    wasmURL:   await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`,      'application/wasm'),
    workerURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.worker.js`, 'text/javascript'),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

function deriveOutputFilename(inputFilename, targetFormat) {
  const lastDot = inputFilename.lastIndexOf('.');
  const stem = lastDot >= 0 ? inputFilename.slice(0, lastDot) : inputFilename;
  return `${stem}.${targetFormat.toLowerCase()}`;
}

function buildCommand(inputFilename, outputFilename, settings) {
  switch (settings.targetFormat) {
    case 'PNG':
      return ['-i', inputFilename, outputFilename];
    case 'JPG': {
      const qv = Math.round(31 - (settings.quality / 100) * 30);
      return ['-i', inputFilename, '-q:v', String(qv), '-map_metadata', '0', outputFilename];
    }
    case 'MP4':
    default:
      return ['-i', inputFilename, '-c', 'copy', outputFilename];
  }
}

function mapError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('out of memory') || lower.includes('oom'))
    return { code: 'OUT_OF_MEMORY', message: msg };
  if (lower.includes('storage') || lower.includes('quota') || lower.includes('disk'))
    return { code: 'INSUFFICIENT_STORAGE', message: msg };
  if (lower.includes('corrupt') || lower.includes('invalid data') || lower.includes('moov atom'))
    return { code: 'CORRUPT_INPUT', message: msg };
  if (lower.includes('codec') || lower.includes('decoder not found'))
    return { code: 'UNSUPPORTED_CODEC', message: msg };
  return { code: 'UNKNOWN', message: msg };
}

const cancelFlags = new Map();

async function processConvert(jobId, fileBuffer, filename, settings) {
  if (cancelFlags.get(jobId)) {
    cancelFlags.delete(jobId);
    self.postMessage({ type: 'CANCELLED', jobId });
    return;
  }

  const outputFilename = deriveOutputFilename(filename, settings.targetFormat);

  try {
    const ffmpeg = await getFFmpeg();

    if (cancelFlags.get(jobId)) {
      cancelFlags.delete(jobId);
      self.postMessage({ type: 'CANCELLED', jobId });
      return;
    }

    const progressHandler = ({ progress }) => {
      self.postMessage({ type: 'PROGRESS', jobId, percent: Math.round(progress * 100) });
    };
    ffmpeg.on('progress', progressHandler);

    await ffmpeg.writeFile(filename, await fetchFile(new Blob([fileBuffer])));

    const args = buildCommand(filename, outputFilename, settings);
    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile(outputFilename);
    try { await ffmpeg.deleteFile(filename); } catch {}
    try { await ffmpeg.deleteFile(outputFilename); } catch {}

    ffmpeg.off('progress', progressHandler);

    const output = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
    self.postMessage({ type: 'COMPLETE', jobId, output, outputFilename });

  } catch (err) {
    const { code, message } = mapError(err);
    self.postMessage({ type: 'ERROR', jobId, code, message });
  }
}

self.onmessage = ({ data }) => {
  if (data.type === 'CONVERT') {
    processConvert(data.jobId, data.file, data.filename, data.settings)
      .catch(err => {
        const { code, message } = mapError(err);
        self.postMessage({ type: 'ERROR', jobId: data.jobId, code, message });
      });
  } else if (data.type === 'CANCEL') {
    cancelFlags.set(data.jobId, true);
  }
};
