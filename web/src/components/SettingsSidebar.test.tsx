import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import SettingsSidebar from './SettingsSidebar';
import { ConversionSettingsProvider } from '@/src/contexts/ConversionSettingsContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ConversionSettingsProvider>{children}</ConversionSettingsProvider>
);

describe('SettingsSidebar', () => {
  it('binds format selector changes to settings context', () => {
    render(<SettingsSidebar />, { wrapper });

    const select = screen.getByLabelText(/output format/i) as HTMLSelectElement;
    expect(select.value).toBe('PNG');

    fireEvent.change(select, { target: { value: 'JPG' } });
    expect(select.value).toBe('JPG');
  });

  it('updates quality via the range input', () => {
    render(<SettingsSidebar />, { wrapper });

    const range = screen.getByLabelText(/quality \(85\)/i) as HTMLInputElement;
    expect(range.value).toBe('85');

    fireEvent.change(range, { target: { value: '50' } });
    expect(range.value).toBe('50');
    expect(screen.getByLabelText(/quality \(50\)/i)).toBeInTheDocument();
  });

  it('associates labels with all inputs', () => {
    render(<SettingsSidebar />, { wrapper });

    expect(screen.getByLabelText(/output format/i)).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText(/quality \(85\)/i)).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByLabelText(/automatically download converted files/i)).toBeInstanceOf(HTMLInputElement);
  });
});
