/**
 * Banner displayed when the user's browser does not support WebAssembly.
 * CoreConvert relies on WebAssembly for all media conversion — without it
 * the application cannot function.
 */
export default function UnsupportedBrowserBanner() {
  return (
    <main role="alert" className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="max-w-md rounded-xl border border-red-200 bg-white p-8 text-center shadow-md dark:border-red-900 dark:bg-zinc-900">
        <h1 className="mb-4 text-2xl font-semibold text-red-700 dark:text-red-400">
          Browser Not Supported
        </h1>
        <p className="text-zinc-700 dark:text-zinc-300">
          CoreConvert requires <strong>WebAssembly</strong> to process media
          files locally on your device. Your current browser does not support
          WebAssembly, so CoreConvert cannot run.
        </p>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Please upgrade to a modern browser such as the latest version of
          Chrome, Firefox, Safari, or Edge.
        </p>
      </div>
    </main>
  );
}
