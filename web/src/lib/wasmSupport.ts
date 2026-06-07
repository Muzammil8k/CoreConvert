/**
 * Detects whether the current browser environment supports WebAssembly.
 * Returns true if WebAssembly is available, false otherwise.
 */
export function isWasmSupported(): boolean {
  return typeof WebAssembly === 'object';
}
