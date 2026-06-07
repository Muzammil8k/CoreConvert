/**
 * Unit tests for ConversionQueueContext / useConversionQueue
 *
 * conversionEngine is mocked so no actual FFmpeg processing occurs.
 * Validates: Requirements 7.1–7.3, 8.2–8.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as fc from 'fast-check';

import { ConversionQueueProvider, useConversionQueue } from './ConversionQueueContext';
import type { ConversionSettings } from '@/src/types/conversion';
import { ErrorCode } from '@/src/types/conversion';
import type { ConversionResult } from '@/src/lib/conversionEngine';

// ---------------------------------------------------------------------------
// Mock conversionEngine
// ---------------------------------------------------------------------------

const mockConvertFile = vi.fn<Parameters<typeof import('@/src/lib/conversionEngine').convertFile>, Promise<ConversionResult>>();

vi.mock('@/src/lib/conversionEngine', () => ({
  convertFile: (...args: unknown[]) => mockConvertFile(...(args as Parameters<typeof mockConvertFile>)),
  mapErrorToCode: (err: unknown) => ({
    code: ErrorCode.UNKNOWN,
    message: err instanceof Error ? err.message : String(err),
  }),
}));

beforeEach(() => {
  mockConvertFile.mockReset();
  // Default: hang forever (simulates in-progress conversion)
  mockConvertFile.mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultSettings: ConversionSettings = {
  targetFormat: 'PNG',
  quality: 85,
  autoDownload: false,
};

function makeHeicFile(name = 'photo.heic', size = 1024): File {
  class SizedFile extends File {
    private _sz: number;
    constructor(n: string, sz: number) {
      super([], n, { type: 'image/heic' });
      this._sz = sz;
    }
    override get size() { return this._sz; }
  }
  return new SizedFile(name, size);
}

function makeInvalidFile(name = 'invalid.txt'): File {
  return new File([], name, { type: 'text/plain' });
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <ConversionQueueProvider>{children}</ConversionQueueProvider>
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useConversionQueue — hook access', () => {
  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useConversionQueue());
    }).toThrow('useConversionQueue must be used within a ConversionQueueProvider');
  });

  it('returns empty jobs array initially', () => {
    const { result } = renderHook(() => useConversionQueue(), { wrapper });
    expect(result.current.jobs).toEqual([]);
  });
});

describe('useConversionQueue — enqueue', () => {
  it('enqueuing valid files grows the jobs array', async () => {
    const { result } = renderHook(() => useConversionQueue(), { wrapper });

    await act(async () => {
      result.current.enqueue(
        [makeHeicFile('a.heic'), makeHeicFile('b.heic')],
        defaultSettings,
      );
    });

    expect(result.current.jobs).toHaveLength(2);
    expect(result.current.jobs[0].status).toBe('processing');
    expect(result.current.jobs[1].status).toBe('queued');
  });

  it('sends CONVERT message to worker for each valid file', async () => {
    mockConvertFile.mockResolvedValue({
      success: true,
      output: new Uint8Array([1]),
      outputFilename: 'photo.png',
    });

    const { result } = renderHook(() => useConversionQueue(), { wrapper });

    await act(async () => {
      result.current.enqueue([makeHeicFile('photo.heic')], defaultSettings);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockConvertFile).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      'photo.heic',
      defaultSettings,
      expect.any(Function),
      expect.objectContaining({ cancelled: false }),
    );
  });

  it('invalid files are added as error jobs without calling convertFile', async () => {
    const { result } = renderHook(() => useConversionQueue(), { wrapper });

    await act(async () => {
      result.current.enqueue([makeInvalidFile()], defaultSettings);
    });

    const errorJobs = result.current.jobs.filter((j) => j.status === 'error');
    expect(errorJobs.length).toBeGreaterThanOrEqual(1);
    expect(mockConvertFile).not.toHaveBeenCalled();
  });

  it('mixes valid and invalid files correctly', async () => {
    const { result } = renderHook(() => useConversionQueue(), { wrapper });

    await act(async () => {
      result.current.enqueue(
        [makeInvalidFile(), makeHeicFile('ok.heic'), makeInvalidFile()],
        defaultSettings,
      );
    });

    const queuedJobs = result.current.jobs.filter((j) => j.status === 'queued' || j.status === 'processing');
    const errorJobs = result.current.jobs.filter((j) => j.status === 'error');
    expect(queuedJobs).toHaveLength(1);
    expect(errorJobs).toHaveLength(2);
  });
});

describe('useConversionQueue — cancel', () => {
  it('posts CANCEL message to worker', async () => {
    const { result } = renderHook(() => useConversionQueue(), { wrapper });

    await act(async () => {
      result.current.enqueue([makeHeicFile()], defaultSettings);
    });

    const jobId = result.current.jobs[0].id;

    act(() => {
      result.current.cancel(jobId);
    });

    expect(result.current.jobs.find((j) => j.id === jobId)?.status).toBe('cancelled');
  });

  it('transitions job status to cancelled immediately', async () => {
    const { result } = renderHook(() => useConversionQueue(), { wrapper });

    await act(async () => {
      result.current.enqueue([makeHeicFile()], defaultSettings);
    });

    const jobId = result.current.jobs[0].id;

    act(() => {
      result.current.cancel(jobId);
    });

    expect(result.current.jobs.find((j) => j.id === jobId)?.status).toBe('cancelled');
  });
});

describe('useConversionQueue — COMPLETE result', () => {
  it('transitions job to done with outputBlob', async () => {
    mockConvertFile.mockResolvedValue({
      success: true,
      output: new Uint8Array([1, 2, 3]),
      outputFilename: 'img.png',
    });

    const { result } = renderHook(() => useConversionQueue(), { wrapper });

    await act(async () => {
      result.current.enqueue([makeHeicFile('img.heic')], defaultSettings);
      await new Promise((r) => setTimeout(r, 20));
    });

    const job = result.current.jobs.find((j) => j.outputFilename === 'img.png');
    expect(job?.status).toBe('done');
    expect(job?.outputBlob).toBeInstanceOf(Blob);
    expect(job?.outputFilename).toBe('img.png');
    expect(job?.progress).toBe(100);
  });
});

describe('useConversionQueue — ERROR result', () => {
  it('transitions job to error state', async () => {
    mockConvertFile.mockResolvedValue({
      success: false,
      code: ErrorCode.CORRUPT_INPUT,
      message: 'corrupt file',
    });

    const { result } = renderHook(() => useConversionQueue(), { wrapper });

    await act(async () => {
      result.current.enqueue([makeHeicFile('img.heic')], defaultSettings);
      await new Promise((r) => setTimeout(r, 20));
    });

    const job = result.current.jobs[0];
    expect(job?.status).toBe('error');
    expect(job?.errorCode).toBe(ErrorCode.CORRUPT_INPUT);
    expect(job?.errorMessage).toBe('corrupt file');
  });
});

describe('useConversionQueue — PROGRESS callback', () => {
  it('updates job progress', async () => {
    let progressCb: ((p: number) => void) | null = null;
    mockConvertFile.mockImplementation((_buf, _name, _settings, onProgress) => {
      progressCb = onProgress;
      return new Promise(() => {});
    });

    const { result } = renderHook(() => useConversionQueue(), { wrapper });

    await act(async () => {
      result.current.enqueue([makeHeicFile()], defaultSettings);
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      progressCb?.(42);
    });

    expect(result.current.jobs[0]?.progress).toBe(42);
  });
});

describe('useConversionQueue — clearQueue', () => {
  it('removes all jobs', async () => {
    const { result } = renderHook(() => useConversionQueue(), { wrapper });

    await act(async () => {
      result.current.enqueue([makeHeicFile(), makeHeicFile()], defaultSettings);
    });
    expect(result.current.jobs).toHaveLength(2);

    act(() => {
      result.current.clearQueue();
    });

    expect(result.current.jobs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Property 5: Sequential Processing Order
// Feature: client-side-media-converter, Property 5
// Validates: Requirements 7.2
// ---------------------------------------------------------------------------

describe('Property 5: Sequential Processing Order', () => {
  it('CONVERT messages are sent in the same order as ENQUEUE for 2–20 valid jobs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 }).map((s) => `file_${s}.heic`),
          { minLength: 2, maxLength: 20 },
        ).map((names) => [...new Set(names)]).filter((names) => names.length >= 2),
        async (names) => {
          const order: string[] = [];
          mockConvertFile.mockImplementation((_buf, filename) => {
            order.push(filename as string);
            return Promise.resolve({ success: true, output: new Uint8Array([1]), outputFilename: (filename as string).replace('.heic', '.png') });
          });

          const { result, unmount } = renderHook(() => useConversionQueue(), { wrapper });
          const files = names.map((name) => makeHeicFile(name));

          await act(async () => {
            result.current.enqueue(files, defaultSettings);
            await new Promise((r) => setTimeout(r, 50));
          });

          expect(order).toHaveLength(files.length);
          expect(order).toEqual(names);

          unmount();
          order.length = 0;
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Error Isolation
// Feature: client-side-media-converter, Property 6
// Validates: Requirements 7.3
// ---------------------------------------------------------------------------

describe('Property 6: Error Isolation', () => {
  it('an ERROR on job K does not prevent jobs K+1..N from reaching terminal state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 6 }),
        fc.integer({ min: 0, max: 5 }),
        async (n, k) => {
          const errorJobIndex = k % n;

          let callCount = 0;
          mockConvertFile.mockImplementation(() => {
            const i = callCount++;
            if (i === errorJobIndex) {
              return Promise.resolve({ success: false, code: ErrorCode.CORRUPT_INPUT, message: 'err' });
            }
            return Promise.resolve({ success: true, output: new Uint8Array([i]), outputFilename: `job_${i}.png` });
          });

          const { result, unmount } = renderHook(() => useConversionQueue(), { wrapper });
          const files = Array.from({ length: n }, (_, i) => makeHeicFile(`job_${i}.heic`));

          await act(async () => {
            result.current.enqueue(files, defaultSettings);
            await new Promise((r) => setTimeout(r, n * 30));
          });

          const terminalStatuses = new Set(['done', 'error', 'cancelled']);
          for (const job of result.current.jobs) {
            expect(terminalStatuses.has(job.status)).toBe(true);
          }

          unmount();
          callCount = 0;
        },
      ),
      { numRuns: 20 },
    );
  });
});
