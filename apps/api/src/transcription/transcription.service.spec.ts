import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { TranscriptionStatus } from '../../generated/prisma/enums';
import { StoragePathService } from '../files/storage-path.service';
import { PrismaService } from '../prisma/prisma.service';
import { TranscriptionService } from './transcription.service';
import type { WhisperEngine } from './transcription.constants';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('TranscriptionService', () => {
  const engineMock = { transcribe: jest.fn() };
  const prismaMock = {
    meetingFile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const storageMock = { resolve: jest.fn((p: string) => p) };

  let service: TranscriptionService;

  const createService = () =>
    new TranscriptionService(
      engineMock as unknown as WhisperEngine,
      prismaMock as unknown as PrismaService,
      storageMock as unknown as StoragePathService,
    );

  const fileRecord = (id: string) => ({
    id,
    storagePath: `uploads/${id}.mp3`,
    originalName: 'audio.mp3',
    mimeType: 'audio/mpeg',
    size: 100,
  });

  const progressUpdates = () =>
    prismaMock.meetingFile.update.mock.calls
      .map((call) => call[0].data)
      .filter((data) => Object.keys(data).length === 1 && 'transcriptionProgress' in data);

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setImmediate(r));
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TRANSCRIPTION_ENABLED;
    process.env.TRANSCRIPTION_CONCURRENCY = '1';
    prismaMock.meetingFile.findUnique.mockImplementation((args: { where: { id: string }; select?: unknown }) =>
      args.select ? Promise.resolve({ id: args.where.id }) : Promise.resolve(fileRecord(args.where.id)),
    );
    prismaMock.meetingFile.update.mockResolvedValue({ id: 'file-1' });
    storageMock.resolve.mockImplementation((p: string) => p);
    engineMock.transcribe.mockResolvedValue({ transcript: '', language: undefined });
    service = createService();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.TRANSCRIPTION_ENABLED;
    delete process.env.TRANSCRIPTION_CONCURRENCY;
  });

  it('does not start transcription when disabled', async () => {
    process.env.TRANSCRIPTION_ENABLED = 'false';
    service = createService();

    service.enqueue('file-1');
    await flush();

    expect(engineMock.transcribe).not.toHaveBeenCalled();
    expect(prismaMock.meetingFile.update).not.toHaveBeenCalled();
  });

  it('marks the file PROCESSING then COMPLETED on success', async () => {
    engineMock.transcribe.mockResolvedValue({ transcript: 'Hello world', language: 'ru' });

    service.enqueue('file-1');
    await flush();

    expect(engineMock.transcribe).toHaveBeenCalledTimes(1);
    expect(engineMock.transcribe).toHaveBeenCalledWith(
      'uploads/file-1.mp3',
      expect.objectContaining({
        onProgress: expect.any(Function),
        onLanguage: expect.any(Function),
      }),
    );

    const updateData = prismaMock.meetingFile.update.mock.calls.map((call) => call[0].data);
    expect(updateData[0]).toEqual({
      transcriptionStatus: TranscriptionStatus.PROCESSING,
      transcriptionProgress: 0,
    });

    const completed = updateData.find((d) => d.transcriptionStatus === TranscriptionStatus.COMPLETED);
    expect(completed).toMatchObject({
      transcript: 'Hello world',
      transcriptionLanguage: 'ru',
      transcriptionProgress: 100,
      transcriptionError: null,
    });
    expect(completed.transcribedAt).toBeInstanceOf(Date);
  });

  it('marks the file FAILED when the engine throws', async () => {
    engineMock.transcribe.mockRejectedValue(new Error('model exploded'));

    service.enqueue('file-1');
    await flush();

    const updateData = prismaMock.meetingFile.update.mock.calls.map((call) => call[0].data);
    expect(updateData[updateData.length - 1]).toEqual({
      transcriptionStatus: TranscriptionStatus.FAILED,
      transcriptionError: 'model exploded',
    });
  });

  it('marks the file FAILED when storage path resolution throws', async () => {
    storageMock.resolve.mockImplementation(() => {
      throw new ForbiddenException('Invalid file path');
    });

    service.enqueue('file-1');
    await flush();

    const updateData = prismaMock.meetingFile.update.mock.calls.map((call) => call[0].data);
    const failed = updateData.find((d) => d.transcriptionStatus === TranscriptionStatus.FAILED);
    expect(failed).toBeDefined();
    expect(failed.transcriptionError).toBe('Invalid file path');
  });

  it('skips files deleted before processing', async () => {
    prismaMock.meetingFile.findUnique.mockResolvedValue(null);

    service.enqueue('file-1');
    await flush();

    expect(engineMock.transcribe).not.toHaveBeenCalled();
    expect(prismaMock.meetingFile.update).not.toHaveBeenCalled();
  });

  it('deduplicates enqueues of the same file', async () => {
    engineMock.transcribe.mockResolvedValue({ transcript: 't' });

    service.enqueue('file-1');
    service.enqueue('file-1');
    service.enqueue('file-1');
    await flush();

    expect(engineMock.transcribe).toHaveBeenCalledTimes(1);
  });

  it('runs transcriptions sequentially when concurrency is 1', async () => {
    process.env.TRANSCRIPTION_CONCURRENCY = '1';
    service = createService();

    const first = deferred();
    const second = deferred();
    engineMock.transcribe.mockImplementation((path: string) =>
      path.endsWith('file-1.mp3') ? first.promise : second.promise,
    );

    service.enqueue('file-1');
    service.enqueue('file-2');
    await flush();

    expect(engineMock.transcribe).toHaveBeenCalledTimes(1);
    expect(engineMock.transcribe.mock.calls[0][0]).toBe('uploads/file-1.mp3');

    first.resolve();
    await flush();

    expect(engineMock.transcribe).toHaveBeenCalledTimes(2);
    expect(engineMock.transcribe.mock.calls[1][0]).toBe('uploads/file-2.mp3');

    second.resolve();
    await flush();
  });

  it('runs transcriptions in parallel when concurrency is 2', async () => {
    process.env.TRANSCRIPTION_CONCURRENCY = '2';
    service = createService();

    const first = deferred();
    const second = deferred();
    let callCount = 0;
    engineMock.transcribe.mockImplementation(() => {
      callCount += 1;
      return callCount === 1 ? first.promise : second.promise;
    });

    service.enqueue('file-1');
    service.enqueue('file-2');
    await flush();

    expect(callCount).toBe(2);

    first.resolve();
    second.resolve();
    await flush();
  });

  it('deduplicates repeated progress and clamps out-of-range values', async () => {
    engineMock.transcribe.mockImplementation(
      async (_path: string, { onProgress }: { onProgress: (pct: number) => void }) => {
        onProgress(30);
        onProgress(30);
        onProgress(50);
        onProgress(150);
        return { transcript: 't' };
      },
    );

    service.enqueue('file-1');
    await flush();

    const values = progressUpdates().map((d) => d.transcriptionProgress);
    expect(values).toEqual([30, 50, 100]);
    expect(values.every((v) => v <= 100)).toBe(true);
  });

  it('does not throw when the row is deleted during processing', async () => {
    let selectFindCalls = 0;
    prismaMock.meetingFile.findUnique.mockImplementation((args: { select?: unknown }) => {
      if (args.select) {
        selectFindCalls += 1;
        return Promise.resolve(selectFindCalls > 1 ? null : { id: 'file-1' });
      }
      return Promise.resolve(fileRecord('file-1'));
    });

    service.enqueue('file-1');
    await flush();

    expect(engineMock.transcribe).toHaveBeenCalledTimes(1);
    expect(prismaMock.meetingFile.update).toHaveBeenCalledTimes(1);
  });

  it('ignores P2025 errors from update', async () => {
    prismaMock.meetingFile.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '7.9.0',
      }),
    );

    service.enqueue('file-1');
    await flush();

    expect(prismaMock.meetingFile.update).toHaveBeenCalled();
  });
});
