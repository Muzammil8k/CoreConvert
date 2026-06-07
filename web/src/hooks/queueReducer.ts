import type { ConversionJob, QueueAction } from '@/src/types/conversion';

export function queueReducer(state: ConversionJob[], action: QueueAction): ConversionJob[] {
  switch (action.type) {
    case 'ENQUEUE':
      return [
        ...state,
        ...action.jobs.map((job) => ({ ...job, status: 'queued' as const, progress: 0 })),
      ];

    case 'PROGRESS':
      return state.map((job) =>
        job.id === action.jobId
          ? { ...job, status: 'processing' as const, progress: Math.max(job.progress, action.percent) }
          : job
      );

    case 'COMPLETE':
      return state.map((job) =>
        job.id === action.jobId
          ? {
              ...job,
              status: 'done' as const,
              progress: 100,
              outputBlob: action.blob,
              outputFilename: action.outputFilename,
            }
          : job
      );

    case 'ERROR':
      return state.map((job) =>
        job.id === action.jobId
          ? {
              ...job,
              status: 'error' as const,
              errorCode: action.code,
              errorMessage: action.message,
            }
          : job
      );

    case 'CANCEL':
      return state.map((job) =>
        job.id === action.jobId ? { ...job, status: 'cancelled' as const } : job
      );

    case 'CLEAR':
      return [];
  }
}
