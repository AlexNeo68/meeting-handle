import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { TranscriptionStatus } from '../../generated/prisma/enums';
import { StoragePathService } from '../files/storage-path.service';
import { PrismaService } from '../prisma/prisma.service';
import { WHISPER_ENGINE } from './transcription.constants';
import type { WhisperEngine } from './transcription.constants';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly queue: string[] = [];
  private readonly inFlight = new Set<string>();
  private readonly lastProgress = new Map<string, number>();
  private readonly concurrency: number;
  private readonly enabled: boolean;

  constructor(
    @Inject(WHISPER_ENGINE) private readonly engine: WhisperEngine,
    private readonly prisma: PrismaService,
    private readonly storagePath: StoragePathService,
  ) {
    const parsed = parseInt(process.env.TRANSCRIPTION_CONCURRENCY ?? '1', 10);
    this.concurrency = Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
    this.enabled = process.env.TRANSCRIPTION_ENABLED !== 'false';
  }

  enqueue(fileId: string): void {
    if (!this.enabled) {
      return;
    }
    if (this.queue.includes(fileId) || this.inFlight.has(fileId)) {
      return;
    }
    this.queue.push(fileId);
    this.processQueue();
  }

  private processQueue(): void {
    while (this.inFlight.size < this.concurrency && this.queue.length > 0) {
      const fileId = this.queue.shift();
      if (!fileId) {
        return;
      }
      this.inFlight.add(fileId);
      this.runTask(fileId)
        .catch((err) => this.logger.error(`Transcription task failed for ${fileId}: ${String(err)}`))
        .finally(() => {
          this.inFlight.delete(fileId);
          this.lastProgress.delete(fileId);
          this.processQueue();
        });
    }
  }

  private async runTask(fileId: string): Promise<void> {
    try {
      const file = await this.prisma.meetingFile.findUnique({ where: { id: fileId } });
      if (!file) {
        return;
      }

      await this.safeUpdate(fileId, {
        transcriptionStatus: TranscriptionStatus.PROCESSING,
        transcriptionProgress: 0,
      });

      const absPath = this.storagePath.resolve(file.storagePath);

      let detectedLanguage: string | undefined;
      const result = await this.engine.transcribe(absPath, {
        onProgress: (pct) => this.persistProgress(fileId, pct),
        onLanguage: (lang) => {
          detectedLanguage = lang;
        },
      });

      await this.safeUpdate(fileId, {
        transcriptionStatus: TranscriptionStatus.COMPLETED,
        transcript: result.transcript,
        transcriptionLanguage: detectedLanguage ?? result.language ?? null,
        transcribedAt: new Date(),
        transcriptionProgress: 100,
        transcriptionError: null,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Transcription failed';
      await this.safeUpdate(fileId, {
        transcriptionStatus: TranscriptionStatus.FAILED,
        transcriptionError: reason,
      });
    }
  }

  private async persistProgress(fileId: string, pct: number): Promise<void> {
    const clamped = Math.min(100, Math.max(0, Math.round(pct)));
    if (this.lastProgress.get(fileId) === clamped) {
      return;
    }
    this.lastProgress.set(fileId, clamped);
    try {
      await this.safeUpdate(fileId, { transcriptionProgress: clamped });
    } catch (err) {
      this.logger.warn(`Failed to persist progress for ${fileId}: ${String(err)}`);
    }
  }

  private async safeUpdate(fileId: string, data: Prisma.MeetingFileUpdateInput): Promise<void> {
    try {
      const existing = await this.prisma.meetingFile.findUnique({
        where: { id: fileId },
        select: { id: true },
      });
      if (!existing) {
        return;
      }
      await this.prisma.meetingFile.update({ where: { id: fileId }, data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return;
      }
      this.logger.warn(`Failed to update transcription for ${fileId}: ${String(err)}`);
    }
  }
}
