'use client';

import React, { useMemo, useCallback } from 'react';
import { useConversionQueue } from '@/src/contexts/ConversionQueueContext';
import type { ConversionJob } from '@/src/types/conversion';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'] as const;
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatStatus(status: ConversionJob['status']) {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'processing':
      return 'Processing';
    case 'done':
      return 'Done';
    case 'error':
      return 'Error';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export default function QueueTable() {
  const { jobs, cancel, downloadAll } = useConversionQueue();

  const completedCount = useMemo(
    () => jobs.filter((job) => job.status === 'done').length,
    [jobs],
  );

  const handleDownloadAll = useCallback(() => {
    downloadAll();
  }, [downloadAll]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-zinc-700">
          {completedCount} of {jobs.length} completed
        </p>
        <button
          type="button"
          onClick={handleDownloadAll}
          disabled={completedCount === 0}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          Download All
        </button>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-700">
            <tr>
              <th className="px-4 py-3 font-medium">File</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-zinc-500">
                  Waiting for files...
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <React.Fragment key={job.id}>
                  <tr>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-2">
                        <div className="font-medium text-zinc-900">{job.inputFilename}</div>
                        <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
                          {job.inputFormat} → {job.outputFormat}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-600">{formatBytes(job.inputSize)}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-2">
                        <div className="font-semibold text-zinc-900">{formatStatus(job.status)}</div>
                        <div
                          role="progressbar"
                          aria-valuenow={job.progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="h-2 overflow-hidden rounded-full bg-zinc-200"
                        >
                          <div
                            className="h-full rounded-full bg-blue-600 transition-all duration-200"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top space-y-2">
                      {job.status === 'done' ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!job.outputBlob) return;
                            const url = URL.createObjectURL(job.outputBlob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = job.outputFilename ?? job.inputFilename;
                            a.style.display = 'none';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                        >
                          Download
                        </button>
                      ) : null}

                      {(job.status === 'queued' || job.status === 'processing') && (
                        <button
                          type="button"
                          onClick={() => cancel(job.id)}
                          className="rounded-full bg-rose-600 px-3 py-2 text-xs font-semibold text-white"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                  {job.status === 'error' ? (
                    <tr>
                      <td colSpan={4} className="bg-rose-50 px-4 py-3 text-sm text-rose-700" aria-live="assertive">
                        <span className="font-semibold">Error:</span> {job.errorMessage ?? 'Conversion failed.'}
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
