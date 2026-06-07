'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';

import { queueReducer } from '@/src/hooks/queueReducer';
import { validateFile } from '@/src/lib/validation';
import { deriveOutputFilename } from '@/src/lib/filename';
import { convertFile, mapErrorToCode } from '@/src/lib/conversionEngine';
import type {
  ConversionJob,
  ConversionSettings,
  InputFormat,
} from '@/src/types/conversion';
import { ErrorCode } from '@/src/types/conversion';

// ---------------------------------------------------------------------------
// MIME / extension → InputFormat mapping
// ---------------------------------------------------------------------------

function mimeToInputFormat(mime: string): InputFormat | null {
  if (mime === 'image/heic' || mime === 'image/heif') return 'HEIC';
  if (mime === 'video/quicktime') return 'MOV';
  return null;
}

function fileToInputFormat(file: File): InputFormat {
  const mimeFormat = mimeToInputFormat(file.type);
  if (mimeFormat) return mimeFormat;
  const nameLower = file.name.toLowerCase();
  if (nameLower.endsWith('.heic') || nameLower.endsWith('.heif')) return 'HEIC';
  if (nameLower.endsWith('.mov')) return 'MOV';
  return 'HEIC';
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface ConversionQueueContextValue {
  jobs: ConversionJob[];
  enqueue(files: File[], settings: ConversionSettings): void;
  cancel(jobId: string): void;
  clearQueue(): void;
  downloadAll(): void;
}

const ConversionQueueContext = createContext<ConversionQueueContextValue | null>(null);

function generateId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ConversionQueueProvider({ children }: { children: ReactNode }) {
  const [jobs, dispatch] = useReducer(queueReducer, []);

  // Per-job cancellation signals
  const cancelSignals = useRef<Map<string, { cancelled: boolean }>>(new Map());

  // Keep a ref to the latest jobs for downloadAll
  const jobsRef = useRef<ConversionJob[]>(jobs);
  React.useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  // ---------------------------------------------------------------------------
  // enqueue — validates files, creates jobs, runs conversion sequentially
  // ---------------------------------------------------------------------------

  const enqueue = useCallback(
    (files: File[], settings: ConversionSettings) => {
      const validFiles: { file: File; job: ConversionJob }[] = [];

      for (const file of files) {
        const validation = validateFile(file, settings);

        if (!validation.valid) {
          const errorJobId = generateId();
          const errorJob: ConversionJob = {
            id: errorJobId,
            inputFilename: file.name,
            inputSize: file.size,
            inputFormat: fileToInputFormat(file),
            outputFormat: settings.targetFormat!,
            status: 'error',
            progress: 0,
            errorCode: validation.errorCode,
            errorMessage: validation.message,
            outputBlob: null,
            outputFilename: null,
          };
          dispatch({ type: 'ENQUEUE', jobs: [errorJob] });
          dispatch({ type: 'ERROR', jobId: errorJobId, code: validation.errorCode, message: validation.message });
          continue;
        }

        const job: ConversionJob = {
          id: generateId(),
          inputFilename: file.name,
          inputSize: file.size,
          inputFormat: fileToInputFormat(file),
          outputFormat: settings.targetFormat!,
          status: 'queued',
          progress: 0,
          errorCode: null,
          errorMessage: null,
          outputBlob: null,
          outputFilename: deriveOutputFilename(file.name, settings.targetFormat!),
        };
        validFiles.push({ file, job });
      }

      if (validFiles.length === 0) return;

      dispatch({ type: 'ENQUEUE', jobs: validFiles.map((f) => f.job) });

      // Process sequentially (one at a time) using an async IIFE
      void (async () => {
        for (const { file, job } of validFiles) {
          const cancelSignal = { cancelled: false };
          cancelSignals.current.set(job.id, cancelSignal);

          // Mark as processing immediately
          dispatch({ type: 'PROGRESS', jobId: job.id, percent: 0 });

          let buffer: ArrayBuffer;
          try {
            buffer = await file.arrayBuffer();
          } catch (err: unknown) {
            const { code, message } = mapErrorToCode(err);
            dispatch({ type: 'ERROR', jobId: job.id, code, message });
            cancelSignals.current.delete(job.id);
            continue;
          }

          let result;
          try {
            result = await convertFile(
              buffer,
              file.name,
              settings,
              (percent) => {
                dispatch({ type: 'PROGRESS', jobId: job.id, percent });
              },
              cancelSignal,
            );
          } catch (err: unknown) {
            const { code, message } = mapErrorToCode(err);
            dispatch({ type: 'ERROR', jobId: job.id, code, message });
            cancelSignals.current.delete(job.id);
            continue;
          }

          cancelSignals.current.delete(job.id);

          if (result.success) {
            const blob = new Blob([result.output as BlobPart]);
            dispatch({
              type: 'COMPLETE',
              jobId: job.id,
              blob,
              outputFilename: result.outputFilename,
            });

            if (settings.autoDownload) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = result.outputFilename;
              a.style.display = 'none';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }
          } else {
            if (result.code === ErrorCode.CANCELLED_BY_USER) {
              dispatch({ type: 'CANCEL', jobId: job.id });
            } else {
              dispatch({ type: 'ERROR', jobId: job.id, code: result.code, message: result.message });
            }
          }
        }
      })();
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // cancel
  // ---------------------------------------------------------------------------

  const cancel = useCallback((jobId: string) => {
    const signal = cancelSignals.current.get(jobId);
    if (signal) signal.cancelled = true;
    dispatch({ type: 'CANCEL', jobId });
  }, []);

  // ---------------------------------------------------------------------------
  // clearQueue
  // ---------------------------------------------------------------------------

  const clearQueue = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  // ---------------------------------------------------------------------------
  // downloadAll
  // ---------------------------------------------------------------------------

  const downloadAll = useCallback(() => {
    for (const job of jobsRef.current) {
      if (job.status === 'done' && job.outputBlob) {
        const url = URL.createObjectURL(job.outputBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = job.outputFilename ?? job.inputFilename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
  }, []);

  const value: ConversionQueueContextValue = {
    jobs,
    enqueue,
    cancel,
    clearQueue,
    downloadAll,
  };

  return (
    <ConversionQueueContext.Provider value={value}>
      {children}
    </ConversionQueueContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConversionQueue(): ConversionQueueContextValue {
  const ctx = useContext(ConversionQueueContext);
  if (ctx === null) {
    throw new Error('useConversionQueue must be used within a ConversionQueueProvider');
  }
  return ctx;
}
