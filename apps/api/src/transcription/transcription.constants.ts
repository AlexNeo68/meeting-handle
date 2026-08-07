export const WHISPER_ENGINE = 'WHISPER_ENGINE';

export const TRANSCRIPTION_ERRORS = {
  INTERRUPTED_BY_RESTART: 'Interrupted by server restart',
  FFMPEG_NOT_FOUND: 'ffmpeg not found',
  NO_AUDIO_STREAM: 'No audio stream',
  MODEL_NOT_DOWNLOADED: 'Model not downloaded',
} as const;

export type TranscriptionErrorKey = (typeof TRANSCRIPTION_ERRORS)[keyof typeof TRANSCRIPTION_ERRORS];

export function transcriptionEnabled(): boolean {
  return process.env.TRANSCRIPTION_ENABLED !== 'false';
}

export function transcriptionConcurrency(): number {
  const parsed = parseInt(process.env.TRANSCRIPTION_CONCURRENCY ?? '1', 10);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

export function whisperModelName(): string {
  return process.env.WHISPER_MODEL_NAME ?? 'base';
}

export function whisperModelDir(): string | undefined {
  return process.env.WHISPER_MODEL_DIR || undefined;
}

export function whisperAutoDownloadEnabled(): boolean {
  return process.env.WHISPER_AUTO_DOWNLOAD !== 'false';
}

export interface WhisperEngine {
  transcribe(
    absPath: string,
    opts: {
      onProgress: (pct: number) => void;
      onLanguage?: (lang: string) => void;
      signal?: AbortSignal;
    },
  ): Promise<{ transcript: string; language?: string }>;
  warmup?(): Promise<void>;
}
