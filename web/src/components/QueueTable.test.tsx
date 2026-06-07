import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useConversionQueue, ConversionQueueProvider } from '@/src/contexts/ConversionQueueContext';
import { ConversionSettingsProvider } from '@/src/contexts/ConversionSettingsContext';
import QueueTable from './QueueTable';
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
  // Default: hang (in-progress)
  mockConvertFile.mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
  vi.clearAllMocks();
});

const defaultSettings: ConversionSettings = {
  targetFormat: 'PNG',
  quality: 85,
  autoDownload: false,
};

function makeHeicFile(name = 'photo.heic'): File {
  return new File(['dummy'], name, { type: 'image/heic' });
}

function makeInvalidFile(name = 'invalid.txt'): File {
  return new File(['dummy'], name, { type: 'text/plain' });
}

type QueueRef = { current: ReturnType<typeof useConversionQueue> | null };

function TestHost({ queueRef }: { queueRef: QueueRef }) {
  const queue = useConversionQueue();
  queueRef.current = queue;
  return <QueueTable />;
}

function renderWithProviders(queueRef: QueueRef) {
  return render(
    <ConversionSettingsProvider>
      <ConversionQueueProvider>
        <TestHost queueRef={queueRef} />
      </ConversionQueueProvider>
    </ConversionSettingsProvider>,
  );
}

describe('QueueTable', () => {
  it('renders progressbar with aria-valuenow equal to job progress', async () => {
    let progressCb: ((p: number) => void) | null = null;
    mockConvertFile.mockImplementation((_buf, _name, _settings, onProgress) => {
      progressCb = onProgress;
      return new Promise(() => {});
    });

    const queueRef: QueueRef = { current: null };
    renderWithProviders(queueRef);

    await waitFor(() => expect(queueRef.current).not.toBeNull());

    await act(async () => {
      queueRef.current?.enqueue([makeHeicFile('test.heic')], defaultSettings);
      await new Promise((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(queueRef.current?.jobs.length).toBe(1));

    await act(async () => {
      progressCb?.(42);
    });

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
  });

  it('shows Download button only for done jobs', async () => {
    mockConvertFile.mockResolvedValue({
      success: true,
      output: new Uint8Array([1, 2, 3]),
      outputFilename: 'done.png',
    });

    const queueRef: QueueRef = { current: null };
    renderWithProviders(queueRef);

    await waitFor(() => expect(queueRef.current).not.toBeNull());

    await act(async () => {
      queueRef.current?.enqueue([makeHeicFile('done.heic')], defaultSettings);
      await new Promise((r) => setTimeout(r, 20));
    });

    await waitFor(() =>
      expect(queueRef.current?.jobs[0]?.status).toBe('done'),
    );

    expect(screen.getByRole('button', { name: /^Download$/i })).toBeInTheDocument();
  });

  it('renders error message text in the DOM for error jobs', async () => {
    const queueRef: QueueRef = { current: null };
    renderWithProviders(queueRef);

    await waitFor(() => expect(queueRef.current).not.toBeNull());

    await act(async () => {
      queueRef.current?.enqueue([makeInvalidFile()], defaultSettings);
    });

    expect(screen.getByText(/Error:/i)).toBeInTheDocument();
    expect(screen.getByText(/not a supported format/i)).toBeInTheDocument();
  });

  it('does not render a Cancel button for terminal jobs', async () => {
    mockConvertFile.mockResolvedValue({
      success: true,
      output: new Uint8Array([1, 2, 3]),
      outputFilename: 'done.png',
    });

    const queueRef: QueueRef = { current: null };
    renderWithProviders(queueRef);

    await waitFor(() => expect(queueRef.current).not.toBeNull());

    await act(async () => {
      queueRef.current?.enqueue([makeHeicFile('done.heic')], defaultSettings);
      await new Promise((r) => setTimeout(r, 20));
    });

    await waitFor(() =>
      expect(queueRef.current?.jobs[0]?.status).toBe('done'),
    );

    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });
});
