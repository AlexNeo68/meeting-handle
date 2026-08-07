export const WHISPER_ENGINE = 'WHISPER_ENGINE';

export const TRANSCRIPTION_ERRORS = {
  INTERRUPTED_BY_RESTART: 'Interrupted by server restart',
  FFMPEG_NOT_FOUND: 'ffmpeg not found',
  NO_AUDIO_STREAM: 'No audio stream',
  MODEL_NOT_DOWNLOADED: 'Model not downloaded',
} as const;

export type TranscriptionErrorKey = (typeof TRANSCRIPTION_ERRORS)[keyof typeof TRANSCRIPTION_ERRORS];

export interface WhisperEngine {
  transcribe(
    absPath: string,
    opts: {
      onProgress: (pct: number) => void;
      onLanguage?: (lang: string) => void;
      signal?: AbortSignal;
    },
  ): Promise<{ transcript: string; language?: string }>;
}
