import { describe, it, expect, afterEach } from 'vitest';
import { isWasmSupported } from './wasmSupport';

describe('isWasmSupported', () => {
  afterEach(() => {
    // Restore WebAssembly on globalThis after each test in case it was deleted
    if (!('WebAssembly' in globalThis)) {
      Object.defineProperty(globalThis, 'WebAssembly', {
        value: { compile: () => {}, instantiate: () => {} },
        writable: true,
        configurable: true,
      });
    }
  });

  it('returns true when WebAssembly is defined', () => {
    // jsdom environment has WebAssembly available
    expect(typeof WebAssembly).toBe('object');
    expect(isWasmSupported()).toBe(true);
  });

  it('returns false when WebAssembly is not defined', () => {
    // Temporarily remove WebAssembly from globalThis to simulate an unsupporting browser
    const original = globalThis.WebAssembly;
    // @ts-expect-error — intentionally deleting to simulate missing WebAssembly
    delete globalThis.WebAssembly;

    expect(isWasmSupported()).toBe(false);

    // Restore
    Object.defineProperty(globalThis, 'WebAssembly', {
      value: original,
      writable: true,
      configurable: true,
    });
  });
});
