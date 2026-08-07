import { existsSync, readFileSync } from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import autoDownloadModel from 'nodejs-whisper/dist/autoDownloadModel';
import { convertToWavType } from 'nodejs-whisper/dist/utils';
import { executeCppCommand } from 'nodejs-whisper/dist/whisper';
import { TRANSCRIPTION_ERRORS } from './transcription.constants';
import { WhisperCppEngine } from './whisper-engine';

jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock('nodejs-whisper/dist/utils', () => ({
  convertToWavType: jest.fn(),
}));

jest.mock('nodejs-whisper/dist/autoDownloadModel', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('nodejs-whisper/dist/whisper', () => ({
  executeCppCommand: jest.fn(),
}));

jest.mock('nodejs-whisper/dist/constants', () => ({
  WHISPER_CPP_PATH: '/fixture/whisper.cpp',
  MODEL_OBJECT: { base: 'ggml-base.bin' },
}));

const mockExistsSync = existsSync as unknown as jest.Mock;
const mockReadFileSync = readFileSync as unknown as jest.Mock;
const mockConvertToWavType = convertToWavType as unknown as jest.Mock;
const mockAutoDownloadModel = autoDownloadModel as unknown as jest.Mock;
const mockExecuteCppCommand = executeCppCommand as unknown as jest.Mock;

describe('WhisperCppEngine', () => {
  let engine: WhisperCppEngine;
  let unlinkSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WHISPER_MODEL_NAME;
    delete process.env.WHISPER_MODEL_DIR;
    delete process.env.WHISPER_AUTO_DOWNLOAD;
    unlinkSpy = jest.spyOn(fsPromises, 'unlink').mockResolvedValue(undefined);
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('Hello world');
    engine = new WhisperCppEngine();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.WHISPER_MODEL_NAME;
    delete process.env.WHISPER_MODEL_DIR;
    delete process.env.WHISPER_AUTO_DOWNLOAD;
  });

  it('transcribes on the happy path and cleans up temp files', async () => {
    const absPath = '/uploads/x/meeting.mp3';
    const wavPath = '/uploads/x/meeting.wav';
    mockConvertToWavType.mockResolvedValue(wavPath);
    mockExistsSync.mockImplementation(
      (p: string) => p.endsWith('ggml-base.bin') || p.endsWith('whisper-cli') || p === `${wavPath}.txt`,
    );
    mockReadFileSync.mockReturnValue('  Hello world  ');
    mockExecuteCppCommand.mockResolvedValue('');

    const result = await engine.transcribe(absPath, { onProgress: jest.fn() });

    expect(result.transcript).toBe('Hello world');

    const command = mockExecuteCppCommand.mock.calls[0][0] as string;
    expect(command).toContain('-pp');
    expect(command).toContain('-l auto');
    expect(command).toContain('-otxt');
    expect(command).toContain('-ng');
    expect(command).toContain(`-m "/fixture/whisper.cpp/models/ggml-base.bin"`);
    expect(command).toContain(`-f "${wavPath}"`);

    expect(mockConvertToWavType).toHaveBeenCalledWith(absPath, expect.anything());
    expect(mockExecuteCppCommand).toHaveBeenCalledTimes(1);

    expect(unlinkSpy).toHaveBeenCalledWith(`${wavPath}.txt`);
    expect(unlinkSpy).toHaveBeenCalledWith(wavPath);
    expect(unlinkSpy).not.toHaveBeenCalledWith(absPath);
  });

  it('reports progress and language from stderr chunks split across calls', async () => {
    const absPath = '/uploads/x/meeting.mp3';
    const wavPath = '/uploads/x/meeting.wav';
    mockConvertToWavType.mockResolvedValue(wavPath);
    mockExistsSync.mockImplementation(
      (p: string) => p.endsWith('ggml-base.bin') || p.endsWith('whisper-cli') || p === `${wavPath}.txt`,
    );
    const onProgress = jest.fn();
    const onLanguage = jest.fn();
    mockExecuteCppCommand.mockImplementation(
      (_cmd: string, logger: { debug: (chunk: string) => void }) => {
        logger.debug('whisper_print_progress_callback: progress = ');
        logger.debug(' 45%\n');
        logger.debug('whisper_full_with_state: auto-detected language: ru (p = 0.920000)\n');
        return Promise.resolve('[00:00:00.000 --> 00:00:02.000]  Hello world\n');
      },
    );

    const result = await engine.transcribe(absPath, { onProgress, onLanguage });

    expect(onProgress).toHaveBeenCalledWith(45);
    expect(onLanguage).toHaveBeenCalledWith('ru');
    expect(result.language).toBe('ru');
    expect(result.transcript).toBe('Hello world');
  });

  it('throws MODEL_NOT_DOWNLOADED when the model is missing and auto-download is disabled', async () => {
    process.env.WHISPER_AUTO_DOWNLOAD = 'false';
    mockExistsSync.mockReturnValue(false);

    await expect(engine.transcribe('/uploads/x/meeting.mp3', { onProgress: jest.fn() })).rejects.toThrow(
      TRANSCRIPTION_ERRORS.MODEL_NOT_DOWNLOADED,
    );

    expect(mockAutoDownloadModel).not.toHaveBeenCalled();
  });

  it('downloads the model automatically when missing', async () => {
    let modelExists = false;
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('ggml-base.bin')) {
        return modelExists;
      }
      return p.endsWith('whisper-cli');
    });
    mockAutoDownloadModel.mockImplementation(async () => {
      modelExists = true;
    });
    mockConvertToWavType.mockResolvedValue('/uploads/x/meeting.wav');
    mockExecuteCppCommand.mockResolvedValue('Hello from stdout');

    const result = await engine.transcribe('/uploads/x/meeting.mp3', { onProgress: jest.fn() });

    expect(mockAutoDownloadModel).toHaveBeenCalledTimes(1);
    expect(mockAutoDownloadModel).toHaveBeenCalledWith(expect.anything(), 'base', false, undefined);
    expect(result.transcript).toBe('Hello from stdout');
  });

  it('throws when the whisper-cli binary is not built', async () => {
    mockExistsSync.mockImplementation((p: string) => p.endsWith('ggml-base.bin'));
    mockExecuteCppCommand.mockResolvedValue('');

    await expect(engine.transcribe('/uploads/x/meeting.mp3', { onProgress: jest.fn() })).rejects.toThrow(
      'whisper-cli binary is not built',
    );

    expect(mockExecuteCppCommand).toHaveBeenCalledWith(
      'cmake --build build --config Release',
      expect.anything(),
      false,
    );
  });

  it('maps ffmpeg conversion failure to FFMPEG_NOT_FOUND', async () => {
    mockExistsSync.mockReturnValue(true);
    mockConvertToWavType.mockRejectedValue(
      new Error('Failed to convert audio file: /bin/sh: ffmpeg: command not found'),
    );

    await expect(engine.transcribe('/uploads/x/meeting.mp3', { onProgress: jest.fn() })).rejects.toThrow(
      TRANSCRIPTION_ERRORS.FFMPEG_NOT_FOUND,
    );
  });

  it('maps no-audio-stream conversion failure to NO_AUDIO_STREAM', async () => {
    mockExistsSync.mockReturnValue(true);
    mockConvertToWavType.mockRejectedValue(
      new Error('Failed to convert audio file: meeting.mp3 does not contain any stream'),
    );

    await expect(engine.transcribe('/uploads/x/meeting.mp3', { onProgress: jest.fn() })).rejects.toThrow(
      TRANSCRIPTION_ERRORS.NO_AUDIO_STREAM,
    );
  });

  it('returns an empty transcript when the txt file is empty', async () => {
    const wavPath = '/uploads/x/meeting.wav';
    mockConvertToWavType.mockResolvedValue(wavPath);
    mockExistsSync.mockImplementation(
      (p: string) => p.endsWith('ggml-base.bin') || p.endsWith('whisper-cli') || p === `${wavPath}.txt`,
    );
    mockReadFileSync.mockReturnValue('   ');
    mockExecuteCppCommand.mockResolvedValue('');

    const result = await engine.transcribe('/uploads/x/meeting.mp3', { onProgress: jest.fn() });

    expect(result.transcript).toBe('');
  });

  it('keeps a valid wav source untouched', async () => {
    const absPath = '/uploads/x/meeting.wav';
    mockConvertToWavType.mockResolvedValue(absPath);
    mockExistsSync.mockImplementation(
      (p: string) => p.endsWith('ggml-base.bin') || p.endsWith('whisper-cli') || p === `${absPath}.txt`,
    );
    mockReadFileSync.mockReturnValue('transcript text');
    mockExecuteCppCommand.mockResolvedValue('');

    const result = await engine.transcribe(absPath, { onProgress: jest.fn() });

    expect(result.transcript).toBe('transcript text');
    expect(unlinkSpy).toHaveBeenCalledWith(`${absPath}.txt`);
    expect(unlinkSpy).not.toHaveBeenCalledWith(absPath);
  });

  it('aborts before starting when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      engine.transcribe('/uploads/x/meeting.mp3', { onProgress: jest.fn(), signal: controller.signal }),
    ).rejects.toThrow('Aborted');

    expect(mockConvertToWavType).not.toHaveBeenCalled();
  });
});
