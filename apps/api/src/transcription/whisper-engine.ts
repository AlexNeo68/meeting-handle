import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import autoDownloadModel from 'nodejs-whisper/dist/autoDownloadModel';
import { MODEL_OBJECT, WHISPER_CPP_PATH } from 'nodejs-whisper/dist/constants';
import type { Logger as WhisperLogger } from 'nodejs-whisper/dist/types';
import { convertToWavType } from 'nodejs-whisper/dist/utils';
import { executeCppCommand } from 'nodejs-whisper/dist/whisper';
import { parseLanguage, parseProgress } from './progress.parser';
import { TRANSCRIPTION_ERRORS } from './transcription.constants';
import type { WhisperEngine } from './transcription.constants';

interface TranscribeCallbacks {
  onProgress: (pct: number) => void;
  onLanguage?: (lang: string) => void;
}

function stripTimestamps(text: string): string {
  return text
    .replace(/\[\d{2}:\d{2}(?:\.\d{3})?\s*-->\s*\d{2}:\d{2}(?:\.\d{3})?\s*\]/g, '')
    .trim();
}

@Injectable()
export class WhisperCppEngine implements WhisperEngine {
  private readonly logger = new Logger(WhisperCppEngine.name);

  async transcribe(
    absPath: string,
    opts: { onProgress: (pct: number) => void; onLanguage?: (lang: string) => void; signal?: AbortSignal },
  ): Promise<{ transcript: string; language?: string }> {
    const { onProgress, onLanguage, signal } = opts;
    const modelName = process.env.WHISPER_MODEL_NAME ?? 'base';
    const modelRootPath = process.env.WHISPER_MODEL_DIR;
    const modelFile = (MODEL_OBJECT as Record<string, string>)[modelName] ?? MODEL_OBJECT.base;
    const modelPath = modelRootPath ? resolve(modelRootPath, modelFile) : join(WHISPER_CPP_PATH, 'models', modelFile);

    const parseLogger = this.createParseLogger({ onProgress, onLanguage });

    let wavPath: string | undefined;
    let txtPath: string | undefined;
    try {
      this.assertNotAborted(signal);

      if (!existsSync(modelPath)) {
        if (process.env.WHISPER_AUTO_DOWNLOAD !== 'false') {
          await autoDownloadModel(parseLogger.logger, modelName, false, modelRootPath);
        }
        this.assertNotAborted(signal);
        if (!existsSync(modelPath)) {
          throw new Error(TRANSCRIPTION_ERRORS.MODEL_NOT_DOWNLOADED);
        }
      }

      let exePath = this.getWhisperExecutablePath();
      if (!exePath) {
        try {
          await executeCppCommand('cmake --build build --config Release', parseLogger.logger, false);
        } catch {
          this.logger.warn('whisper-cli binary could not be built');
        }
        exePath = this.getWhisperExecutablePath();
        if (!exePath) {
          throw new Error('whisper-cli binary is not built');
        }
      }

      this.assertNotAborted(signal);
      wavPath = await convertToWavType(absPath, parseLogger.logger);

      this.assertNotAborted(signal);
      const command = `"${exePath}" -pp -l auto -m "${modelPath}" -f "${wavPath}" -otxt -ng`;
      const stdout = await executeCppCommand(command, parseLogger.logger, false);

      txtPath = `${wavPath}.txt`;
      let transcript: string;
      if (existsSync(txtPath)) {
        transcript = readFileSync(txtPath, 'utf8').trim();
      } else {
        transcript = stripTimestamps(stdout);
      }

      const language = parseLogger.getDetectedLanguage();
      return { transcript, ...(language ? { language } : {}) };
    } catch (err) {
      throw this.mapError(err);
    } finally {
      if (txtPath) {
        unlink(txtPath).catch(() => undefined);
      }
      if (wavPath && wavPath !== absPath) {
        unlink(wavPath).catch(() => undefined);
      }
    }
  }

  private createParseLogger(callbacks: TranscribeCallbacks): {
    logger: WhisperLogger;
    getDetectedLanguage: () => string | undefined;
  } {
    let buffer = '';
    let detectedLanguage: string | undefined;
    const logger = {
      log: () => undefined,
      warn: () => undefined,
      error: (msg: unknown) => this.logger.error(String(msg)),
      debug: (chunk: unknown) => {
        buffer += String(chunk);
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const progress = parseProgress(line);
          if (progress !== null) {
            try {
              callbacks.onProgress(progress);
            } catch {
              this.logger.warn('onProgress callback failed');
            }
          }
          const language = parseLanguage(line);
          if (language !== null) {
            detectedLanguage = language;
            if (callbacks.onLanguage) {
              try {
                callbacks.onLanguage(language);
              } catch {
                this.logger.warn('onLanguage callback failed');
              }
            }
          }
        }
      },
    };
    return { logger, getDetectedLanguage: () => detectedLanguage };
  }

  private getWhisperExecutablePath(): string {
    const execName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
    const possiblePaths = [
      join(WHISPER_CPP_PATH, 'build', 'bin', execName),
      join(WHISPER_CPP_PATH, 'build', 'bin', 'Release', execName),
      join(WHISPER_CPP_PATH, 'build', 'bin', 'Debug', execName),
      join(WHISPER_CPP_PATH, 'build', execName),
      join(WHISPER_CPP_PATH, execName),
    ];
    for (const execPath of possiblePaths) {
      if (existsSync(execPath)) {
        return execPath;
      }
    }
    return '';
  }

  private assertNotAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new Error('Aborted');
    }
  }

  private mapError(err: unknown): Error {
    if (err instanceof Error) {
      const message = err.message;
      if (/Aborted/.test(message)) {
        return err;
      }
      if (/no audio stream|does not contain any stream/i.test(message)) {
        return new Error(TRANSCRIPTION_ERRORS.NO_AUDIO_STREAM);
      }
      if (/(ffmpeg|command not found|ENOENT)/i.test(message) && /ffmpeg/i.test(message)) {
        return new Error(TRANSCRIPTION_ERRORS.FFMPEG_NOT_FOUND);
      }
      return err;
    }
    return new Error('Transcription failed');
  }
}
