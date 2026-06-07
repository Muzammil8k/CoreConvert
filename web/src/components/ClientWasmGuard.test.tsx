import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ClientWasmGuard from './ClientWasmGuard';

// We mock wasmSupport so we can control the return value
vi.mock('@/src/lib/wasmSupport', () => ({
  isWasmSupported: vi.fn(),
}));

import { isWasmSupported } from '@/src/lib/wasmSupport';

const mockIsWasmSupported = vi.mocked(isWasmSupported);

afterEach(() => {
  vi.clearAllMocks();
});

describe('ClientWasmGuard', () => {
  it('renders children when WebAssembly is supported', async () => {
    mockIsWasmSupported.mockReturnValue(true);

    await act(async () => {
      render(
        <ClientWasmGuard>
          <div data-testid="app-content">App Content</div>
        </ClientWasmGuard>
      );
    });

    expect(screen.getByTestId('app-content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders UnsupportedBrowserBanner when WebAssembly is not supported', async () => {
    mockIsWasmSupported.mockReturnValue(false);

    await act(async () => {
      render(
        <ClientWasmGuard>
          <div data-testid="app-content">App Content</div>
        </ClientWasmGuard>
      );
    });

    // The banner uses <main role="alert">
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('app-content')).not.toBeInTheDocument();
  });

  it('does not render the banner when WebAssembly is supported', async () => {
    mockIsWasmSupported.mockReturnValue(true);

    await act(async () => {
      render(
        <ClientWasmGuard>
          <span data-testid="child-node">Hello</span>
        </ClientWasmGuard>
      );
    });

    expect(screen.getByTestId('child-node')).toBeInTheDocument();
    // No alert banner should be present
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
