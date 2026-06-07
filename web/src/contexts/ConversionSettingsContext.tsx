import { createContext, useContext, useState } from 'react';
import type { ConversionSettings } from '../types/conversion';

interface ConversionSettingsContextValue {
  settings: ConversionSettings;
  updateSettings: (patch: Partial<ConversionSettings>) => void;
}

const DEFAULT_SETTINGS: ConversionSettings = {
  targetFormat: 'PNG',
  imageFormat: 'PNG',       
  videoFormat: 'MP4',       
  videoResolution: '1080p', 
  quality: 85,
  autoDownload: false,
};

const ConversionSettingsContext = createContext<ConversionSettingsContextValue | null>(null);

export function ConversionSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ConversionSettings>(DEFAULT_SETTINGS);

  function updateSettings(patch: Partial<ConversionSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  return (
    <ConversionSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </ConversionSettingsContext.Provider>
  );
}

export function useConversionSettings(): ConversionSettingsContextValue {
  const ctx = useContext(ConversionSettingsContext);
  if (ctx === null) {
    throw new Error('useConversionSettings must be used within a ConversionSettingsProvider');
  }
  return ctx;
}
