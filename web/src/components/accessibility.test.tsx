import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as axe from 'axe-core';

import DropZone from './DropZone';
import QueueTable from './QueueTable';
import SettingsSidebar from './SettingsSidebar';
import { ConversionQueueProvider } from '@/src/contexts/ConversionQueueContext';
import { ConversionSettingsProvider } from '@/src/contexts/ConversionSettingsContext';
import { ErrorCode } from '@/src/types/conversion';

// Mock conversionEngine so FFmpeg is never instantiated in tests
vi.mock('@/src/lib/conversionEngine', () => ({
  convertFile: vi.fn(() => new Promise(() => {})),
  mapErrorToCode: (err: unknown) => ({
    code: ErrorCode.UNKNOWN,
    message: err instanceof Error ? err.message : String(err),
  }),
}));

async function runAxe(container: HTMLElement) {
  const results = await axe.run(container);
  expect(results.violations).toEqual([]);
}

describe('Accessibility checks', () => {
  it('DropZone should have no axe violations', async () => {
    const { container } = render(
      <ConversionSettingsProvider>
        <ConversionQueueProvider>
          <DropZone />
        </ConversionQueueProvider>
      </ConversionSettingsProvider>,
    );

    await runAxe(container);
  });

  it('QueueTable should have no axe violations', async () => {
    const { container } = render(
      <ConversionSettingsProvider>
        <ConversionQueueProvider>
          <QueueTable />
        </ConversionQueueProvider>
      </ConversionSettingsProvider>,
    );

    await runAxe(container);
  });

  it('SettingsSidebar should have no axe violations', async () => {
    const { container } = render(
      <ConversionSettingsProvider>
        <SettingsSidebar />
      </ConversionSettingsProvider>,
    );

    await runAxe(container);
  });
});
