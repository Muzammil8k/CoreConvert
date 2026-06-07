import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import DropZone from './DropZone';
import { ConversionQueueProvider, useConversionQueue } from '@/src/contexts/ConversionQueueContext';
import { ConversionSettingsProvider } from '@/src/contexts/ConversionSettingsContext';
import { ErrorCode } from '@/src/types/conversion';

// Mock conversionEngine so FFmpeg is never instantiated in tests
vi.mock('@/src/lib/conversionEngine', () => ({
  convertFile: vi.fn(() => new Promise(() => {})), // hangs — simulates in-progress
  mapErrorToCode: (err: unknown) => ({
    code: ErrorCode.UNKNOWN,
    message: err instanceof Error ? err.message : String(err),
  }),
}));

function makeHeicFile(name = 'photo.heic'): File {
  return new File(['dummy'], name, { type: 'image/heic' });
}

function makeInvalidFile(name = 'invalid.txt'): File {
  return new File(['dummy'], name, { type: 'text/plain' });
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <ConversionSettingsProvider>
    <ConversionQueueProvider>{children}</ConversionQueueProvider>
  </ConversionSettingsProvider>
);

function TestPage() {
  const { jobs } = useConversionQueue();

  return (
    <>
      <DropZone />
      <div data-testid="job-statuses">{jobs.map((job) => job.status).join(',')}</div>
      <div data-testid="job-count">{jobs.length}</div>
    </>
  );
}

describe('DropZone', () => {
  it('renders as an accessible dropzone with drag-and-drop instructions', () => {
    render(<DropZone />, { wrapper });

    const dropZone = screen.getByLabelText(/upload heic or mov files/i);

    expect(dropZone).toBeInTheDocument();
  });

  it('forwards accepted HEIC files to the queue via file input change', async () => {
    render(<TestPage />, { wrapper });

    const fileInput = screen.getByTestId('dropzone-file-input') as HTMLInputElement;
    const file = makeHeicFile();

    await fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    expect(screen.getByTestId('job-count').textContent).toBe('1');
    expect(screen.getByTestId('job-statuses').textContent).toBe('processing');
  });

  it('adds an error job when a dropped file is unsupported', () => {
    render(<TestPage />, { wrapper });

    const dropZone = screen.getByLabelText(/upload heic or mov files/i);
    const dataTransfer = {
      files: [makeInvalidFile()],
    } as DataTransfer;

    fireEvent.drop(dropZone, { dataTransfer });

    expect(screen.getByTestId('job-count').textContent).toBe('1');
    expect(screen.getByTestId('job-statuses').textContent).toBe('error');
  });

  it('associates the dropzone with the hidden file input', () => {
    render(<DropZone />, { wrapper });

    const dropZone = screen.getByLabelText(/upload heic or mov files/i);
    const fileInput = screen.getByTestId('dropzone-file-input') as HTMLInputElement;

    expect(dropZone).toHaveAttribute('for', fileInput.id);
  });
});
