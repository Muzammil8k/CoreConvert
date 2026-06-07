'use client';

import React from 'react';
import { useConversionSettings } from '@/src/contexts/ConversionSettingsContext';

export default function SettingsSidebar() {
  const { settings, updateSettings } = useConversionSettings();

  // Reduced text to text-xs to comfortably fit side-by-side columns
  const getPillStyle = (isActive: boolean) =>
    `flex-1 rounded-xl py-2 text-xs font-medium transition-all min-w-[60px] cursor-pointer ${
      isActive
        ? 'bg-blue-600 text-white shadow-md'
        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
    }`;

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      
      {/* HEADER */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Conversion Settings</h2>
        <p className="text-sm text-zinc-500 mt-1">Configure your default outputs</p>
      </div>

      {/* --- SIDE-BY-SIDE GRID --- */}
      <div className="grid grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: IMAGE SETTINGS */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Image
          </h3>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">Format</label>
            <div className="flex w-full gap-2">
              {['PNG', 'JPG'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => updateSettings({ imageFormat: fmt as 'PNG' | 'JPG' })}
                  className={getPillStyle(settings.imageFormat === fmt)}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <div className={`space-y-2 transition-opacity ${settings.imageFormat === 'PNG' ? 'opacity-50' : 'opacity-100'}`}>
            <div className="flex justify-between">
              <label className="text-sm font-medium text-zinc-700">Quality</label>
              <span className="text-xs text-zinc-500">{settings.quality}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={settings.quality}
              disabled={settings.imageFormat === 'PNG'}
              onChange={(e) => updateSettings({ quality: Number(e.target.value) })}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-blue-600"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: VIDEO SETTINGS */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Video
          </h3>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">Format</label>
            <div className="flex w-full gap-2">
              {['MP4'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => updateSettings({ videoFormat: fmt as 'MP4' })}
                  className={getPillStyle(settings.videoFormat === fmt)}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">Resolution</label>
            {/* Added flex-wrap so the 3 buttons flow nicely if space is tight */}
            <div className="flex flex-wrap w-full gap-2">
              {['Original', '1080p', '720p'].map((res) => (
                <button
                  key={res}
                  onClick={() => updateSettings({ videoResolution: res as 'Original' | '1080p' | '720p' })}
                  className={getPillStyle(settings.videoResolution === res)}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      <hr className="border-zinc-100" />

      {/* --- GLOBAL SETTINGS --- */}
      <div className="space-y-4">
        <label className="flex cursor-pointer items-center gap-3">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              checked={settings.autoDownload}
              onChange={(e) => updateSettings({ autoDownload: e.target.checked })}
              className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-zinc-300 transition-all checked:border-blue-600 checked:bg-blue-600 hover:border-blue-400"
            />
            <svg
              className="pointer-events-none absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className="text-sm font-medium text-zinc-700">Auto-download files</span>
        </label>
      </div>

    </div>
  );
}