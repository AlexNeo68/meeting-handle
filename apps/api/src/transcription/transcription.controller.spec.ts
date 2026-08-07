import { ConflictException } from '@nestjs/common';
import { TranscriptionStatus } from '../../generated/prisma/enums';
import { FilesService } from '../files/files.service';
import { TranscriptionController } from './transcription.controller';
import type { TranscriptionService } from './transcription.service';

describe('TranscriptionController', () => {
  const filesServiceMock = {
    findOwned: jest.fn(),
  };
  const transcriptionServiceMock = {
    enabled: true,
    enqueue: jest.fn(),
  };

  let controller: TranscriptionController;

  beforeEach(() => {
    jest.clearAllMocks();
    transcriptionServiceMock.enabled = true;
    filesServiceMock.findOwned.mockResolvedValue({
      id: 'file-id',
      transcriptionStatus: TranscriptionStatus.COMPLETED,
      transcript: 'Hello world',
      transcriptionLanguage: 'en',
      transcribedAt: new Date('2026-08-01T10:00:00Z'),
    });
    controller = new TranscriptionController(
      filesServiceMock as unknown as FilesService,
      transcriptionServiceMock as unknown as TranscriptionService,
    );
  });

  describe('when transcription is disabled', () => {
    beforeEach(() => {
      transcriptionServiceMock.enabled = false;
    });

    it('rejects getTranscript with 409 Transcription disabled', async () => {
      await expect(
        controller.getTranscript('meeting-id', 'file-id', 'user-id'),
      ).rejects.toThrow(new ConflictException('Transcription disabled'));

      expect(filesServiceMock.findOwned).not.toHaveBeenCalled();
    });

    it('rejects retry with 409 Transcription disabled', async () => {
      await expect(
        controller.retry('meeting-id', 'file-id', 'user-id'),
      ).rejects.toThrow(new ConflictException('Transcription disabled'));

      expect(filesServiceMock.findOwned).not.toHaveBeenCalled();
    });
  });

  describe('when transcription is enabled', () => {
    it('returns transcript data when the file is COMPLETED', async () => {
      const result = await controller.getTranscript('meeting-id', 'file-id', 'user-id');

      expect(filesServiceMock.findOwned).toHaveBeenCalledWith('file-id', 'meeting-id', 'user-id');
      expect(result).toEqual({
        transcript: 'Hello world',
        language: 'en',
        transcribedAt: new Date('2026-08-01T10:00:00Z'),
      });
    });

    it('rejects getTranscript with 409 when the transcription is not completed', async () => {
      filesServiceMock.findOwned.mockResolvedValue({
        transcriptionStatus: TranscriptionStatus.FAILED,
      });

      await expect(
        controller.getTranscript('meeting-id', 'file-id', 'user-id'),
      ).rejects.toThrow(new ConflictException('Transcription not completed'));
    });

    it('retries a FAILED file and returns PENDING', async () => {
      filesServiceMock.findOwned.mockResolvedValue({
        id: 'file-id',
        transcriptionStatus: TranscriptionStatus.FAILED,
      });

      const result = await controller.retry('meeting-id', 'file-id', 'user-id');

      expect(transcriptionServiceMock.enqueue).toHaveBeenCalledWith('file-id');
      expect(result).toEqual({ transcriptionStatus: TranscriptionStatus.PENDING });
    });

    it('rejects retry with 400 when the transcription is already in progress', async () => {
      filesServiceMock.findOwned.mockResolvedValue({
        transcriptionStatus: TranscriptionStatus.PROCESSING,
      });

      await expect(
        controller.retry('meeting-id', 'file-id', 'user-id'),
      ).rejects.toThrow(new Error('Transcription already in progress'));

      expect(transcriptionServiceMock.enqueue).not.toHaveBeenCalled();
    });
  });
});
