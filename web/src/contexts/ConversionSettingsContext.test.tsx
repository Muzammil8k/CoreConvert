import { act, renderHook } from '@testing-library/react';
import { ConversionSettingsProvider, useConversionSettings } from './ConversionSettingsContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ConversionSettingsProvider>{children}</ConversionSettingsProvider>
);

describe('useConversionSettings', () => {
  it('returns default settings on first render', () => {
    const { result } = renderHook(() => useConversionSettings(), { wrapper });
    expect(result.current.settings).toEqual({
      targetFormat: 'PNG',
      quality: 85,
      autoDownload: false,
    });
  });

  it('updateSettings({ quality: 50 }) updates quality while other fields remain unchanged', () => {
    const { result } = renderHook(() => useConversionSettings(), { wrapper });

    act(() => {
      result.current.updateSettings({ quality: 50 });
    });

    expect(result.current.settings.quality).toBe(50);
    expect(result.current.settings.targetFormat).toBe('PNG');
    expect(result.current.settings.autoDownload).toBe(false);
  });

  it('updateSettings({ targetFormat: "JPG" }) updates only targetFormat', () => {
    const { result } = renderHook(() => useConversionSettings(), { wrapper });

    act(() => {
      result.current.updateSettings({ targetFormat: 'JPG' });
    });

    expect(result.current.settings.targetFormat).toBe('JPG');
    expect(result.current.settings.quality).toBe(85);
    expect(result.current.settings.autoDownload).toBe(false);
  });

  it('throws when used outside ConversionSettingsProvider', () => {
    // Suppress the expected error output from React
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useConversionSettings())).toThrow(
      'useConversionSettings must be used within a ConversionSettingsProvider'
    );
    spy.mockRestore();
  });
});
