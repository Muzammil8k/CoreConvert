/**
 * Worker factory — isolated so that `new URL(..., import.meta.url)` is a
 * top-level static expression that both webpack and Turbopack can analyze.
 *
 * Turbopack requires the URL argument to be statically resolvable at the
 * module level. Placing it inside a React hook callback breaks that analysis.
 */

// Top-level static URL — Turbopack and webpack both handle this correctly.
const WORKER_URL = new URL('./conversionWorker.ts', import.meta.url);

export function createConversionWorker(): Worker {
  return new Worker(WORKER_URL, { type: 'module' });
}
