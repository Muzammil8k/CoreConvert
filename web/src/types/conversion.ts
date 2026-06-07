// Job statuses
export type JobStatus = 'queued' | 'processing' | 'done' | 'error' | 'cancelled';

// Error codes enum
export enum ErrorCode {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  UNSUPPORTED_CODEC = 'UNSUPPORTED_CODEC',
  CORRUPT_INPUT = 'CORRUPT_INPUT',
  OUT_OF_MEMORY = 'OUT_OF_MEMORY',
  INSUFFICIENT_STORAGE = 'INSUFFICIENT_STORAGE',
  CANCELLED_BY_USER = 'CANCELLED_BY_USER',
  UNKNOWN = 'UNKNOWN',
}

// Input and output formats
export type InputFormat = 'HEIC' | 'MOV' | string;
export type ImageFormat = 'PNG' | 'JPG';
export type VideoFormat = 'MP4';
export type OutputFormat = ImageFormat | VideoFormat | string;
export type VideoResolution = 'Original' | '1080p' | '720p';

// Conversion settings
export interface ConversionSettings {
  imageFormat: ImageFormat;
  videoFormat: VideoFormat;
  videoResolution: VideoResolution;
  quality: number;      
  autoDownload: boolean;
  targetFormat?: string; 
}

// A single job in the queue
export interface ConversionJob {
  id: string;
  inputFilename: string;
  inputSize: number;
  inputFormat: InputFormat;
  outputFormat: OutputFormat;
  status: JobStatus;
  progress: number;        // 0–100
  errorCode: ErrorCode | null;
  errorMessage: string | null;
  outputBlob: Blob | null;
  outputFilename: string | null;
}

// Worker message types (main → worker)
export type WorkerCommand =
  | { type: 'CONVERT'; jobId: string; file: ArrayBuffer; filename: string; settings: ConversionSettings }
  | { type: 'CANCEL';  jobId: string }

// Worker message types (worker → main)
export type WorkerEvent =
  | { type: 'PROGRESS';  jobId: string; percent: number }
  | { type: 'COMPLETE';  jobId: string; output: Uint8Array; outputFilename: string }
  | { type: 'ERROR';     jobId: string; code: ErrorCode;   message: string }
  | { type: 'CANCELLED'; jobId: string }

// Queue reducer action types
export type QueueAction =
  | { type: 'ENQUEUE';  jobs: ConversionJob[] }
  | { type: 'PROGRESS'; jobId: string; percent: number }
  | { type: 'COMPLETE'; jobId: string; blob: Blob; outputFilename: string }
  | { type: 'ERROR';    jobId: string; code: ErrorCode; message: string }
  | { type: 'CANCEL';   jobId: string }
  | { type: 'CLEAR' }