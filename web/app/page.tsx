'use client';

import { ConversionQueueProvider, useConversionQueue } from '@/src/contexts/ConversionQueueContext';
import { ConversionSettingsProvider } from '@/src/contexts/ConversionSettingsContext';
import DropZone from '@/src/components/DropZone';
import QueueTable from '@/src/components/QueueTable';
import SettingsSidebar from '@/src/components/SettingsSidebar';

function PageContent() {
  const { jobs } = useConversionQueue();
  const completedCount = jobs.filter((job) => job.status === 'done').length;

  return (
    <main className="min-h-screen bg-zinc-50 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 sm:px-6 lg:px-8">
        <header className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">CoreConvert</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
                Local media conversion.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
                Seamlessly convert files entirely within your browser. Fast, private, and serverless.
              </p>
            </div>
            <div className="rounded-3xl bg-zinc-100 p-5 text-sm text-zinc-700 shadow-sm">
              
              <p className="mt-2 text-lg font-semibold">
                {completedCount} of {jobs.length} completed
              </p>
            </div>
          </div>
        </header>

<div className="flex flex-col gap-6">
          {/* Top Section: Full Width Drop Zone */}
          <section>
            <DropZone />
          </section>

          {/* Bottom Section: Settings and Queue Table */}
          <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
            <aside className="space-y-6">
              <SettingsSidebar />
            </aside>

            <section className="space-y-6">
              <QueueTable />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <ConversionSettingsProvider>
      <ConversionQueueProvider>
        <PageContent />
      </ConversionQueueProvider>
    </ConversionSettingsProvider>
  );
}
