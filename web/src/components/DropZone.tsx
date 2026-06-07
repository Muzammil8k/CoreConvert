'use client';

import React, {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';

import { useConversionQueue } from '@/src/contexts/ConversionQueueContext';
import { useConversionSettings } from '@/src/contexts/ConversionSettingsContext';

const ACCEPTED_TYPES = '.heic,.mov,image/heic,image/heif,video/quicktime';

export default function DropZone() {
  const { enqueue } = useConversionQueue();
  const { settings } = useConversionSettings();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // --- SMART AUTO-ASSIGNMENT LOGIC ---
  const handleFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      // 1. Separate the batch into videos and images
      const videos = files.filter(
        (file) => file.name.toLowerCase().endsWith('.mov') || file.type.includes('video')
      );
      const images = files.filter(
        (file) => !file.name.toLowerCase().endsWith('.mov') && !file.type.includes('video')
      );

      // 2. Send videos to the queue and force them to be MP4s
      if (videos.length > 0) {
        enqueue(videos, { ...settings, targetFormat: 'MP4' });
      }

      // 3. Send images to the queue using the global UI setting
      if (images.length > 0) {
        enqueue(images, settings);
      }
    },
    [enqueue, settings],
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files?.length) {
        handleFiles(Array.from(files));
      }
      event.target.value = '';
    },
    [handleFiles],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragActive(false);

      if (event.dataTransfer.files?.length) {
        handleFiles(Array.from(event.dataTransfer.files));
      }
    },
    [handleFiles],
  );

  const handleDragEnter = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
  }, []);

  return (
    <div className="w-full">
      <label
        htmlFor="dropzone-file-input"
        tabIndex={0}
        aria-label="Upload HEIC or MOV files. Click or drop files to start conversion."
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group relative flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed p-8 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          isDragActive
            ? 'border-blue-400 bg-blue-50/60'
            : 'border-zinc-300 bg-white hover:border-zinc-500 hover:bg-zinc-50'
        }`}
      >
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-zinc-700">
          <span className="rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1">HEIC</span>
          <span className="rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1">MOV</span>
        </div>

        <div className="max-w-xl space-y-2">
          <p className="text-lg font-semibold text-zinc-900">Drop HEIC or MOV files here</p>
          <p className="text-sm leading-6 text-zinc-600">
            Or click to browse. Multiple files are supported.
          </p>
        </div>

        <div className="pointer-events-none mt-2 text-xs text-zinc-500">
          Accepted: .heic, .mov
        </div>
      </label>

      <input
        id="dropzone-file-input"
        ref={inputRef}
        type="file"
        multiple
        aria-label="Choose HEIC or MOV files"
        accept={ACCEPTED_TYPES}
        onChange={handleInputChange}
        className="sr-only"
        data-testid="dropzone-file-input"
      />
    </div>
  );
}