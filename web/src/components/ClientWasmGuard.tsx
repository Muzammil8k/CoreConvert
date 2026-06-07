'use client';

import { useEffect, useState } from 'react';
import { isWasmSupported } from '@/src/lib/wasmSupport';
import UnsupportedBrowserBanner from '@/src/components/UnsupportedBrowserBanner';

interface ClientWasmGuardProps {
  children: React.ReactNode;
}

/**
 * Client-side guard that checks for WebAssembly support on mount.
 * Renders UnsupportedBrowserBanner if WebAssembly is unavailable,
 * otherwise renders children normally.
 */
export default function ClientWasmGuard({ children }: ClientWasmGuardProps) {
  // null = not yet checked (avoids SSR mismatch), true/false = result of check
  const [wasmSupported, setWasmSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setWasmSupported(isWasmSupported());
  }, []);

  // On the server and before hydration, render children so the initial HTML
  // matches across SSR and client. The check runs only after hydration.
  if (wasmSupported === null) {
    return <>{children}</>;
  }

  if (!wasmSupported) {
    return <UnsupportedBrowserBanner />;
  }

  return <>{children}</>;
}
