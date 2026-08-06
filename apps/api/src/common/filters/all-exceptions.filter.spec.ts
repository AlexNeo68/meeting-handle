import { BadRequestException, HttpStatus, Logger, PayloadTooLargeException } from '@nestjs/common';
import { MAX_AVATAR_SIZE } from '@meeting-ai/shared';
import { AllExceptionsFilter } from './all-exceptions.filter';

const AVATAR_SIZE_LIMIT_MESSAGE = `File size exceeds ${MAX_AVATAR_SIZE / (1024 * 1024)} MB limit`;

function mockHost(url: string) {
  const json = jest.fn();
  const response = {
    status: jest.fn(() => ({ json })),
    json,
  };
  return {
    getRequest: () => ({ originalUrl: url }),
    getResponse: () => response,
  };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('should map 413 on avatar upload to 400 with an English 5 MB size-limit key', () => {
    const host = mockHost('/user/profile/avatar');

    filter.catch(new PayloadTooLargeException(), {
      switchToHttp: () => host,
    } as Parameters<typeof filter.catch>[1]);

    const { status, json } = host.getResponse();
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: AVATAR_SIZE_LIMIT_MESSAGE,
      error: 'Bad Request',
    });
  });

  it('should map 413 on files upload to 400 with an English 100 MB size-limit key', () => {
    const host = mockHost('/meetings/123e4567-e89b-12d3-a456-426614174000/files');

    filter.catch(new PayloadTooLargeException(), {
      switchToHttp: () => host,
    } as Parameters<typeof filter.catch>[1]);

    const { status, json } = host.getResponse();
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'File size exceeds 100 MB limit',
      error: 'Bad Request',
    });
  });

  it('should pass through non-413 HttpExceptions unchanged', () => {
    const host = mockHost('/user/profile/avatar');
    const exception = new BadRequestException('Unsupported avatar type');

    filter.catch(exception, {
      switchToHttp: () => host,
    } as Parameters<typeof filter.catch>[1]);

    const { status, json } = host.getResponse();
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Unsupported avatar type',
      error: 'Bad Request',
    });
  });

  it('should log unhandled errors with a stack trace via Logger.error', () => {
    const host = mockHost('/some/path');
    const error = new Error('boom');
    const loggerSpy = jest.spyOn(Logger, 'error').mockImplementation(() => undefined);

    filter.catch(error, {
      switchToHttp: () => host,
    } as Parameters<typeof filter.catch>[1]);

    expect(loggerSpy).toHaveBeenCalledWith(error.message, error.stack, 'AllExceptionsFilter');

    const { status, json } = host.getResponse();
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  });

  it('should map an unhandled ENOSPC fs error to 507 Insufficient storage', () => {
    const host = mockHost('/some/path');
    const errnoError = Object.assign(new Error('No space left on device'), { code: 'ENOSPC' });

    filter.catch(errnoError, {
      switchToHttp: () => host,
    } as Parameters<typeof filter.catch>[1]);

    const { status, json } = host.getResponse();
    expect(status).toHaveBeenCalledWith(507);
    expect(json).toHaveBeenCalledWith({
      statusCode: 507,
      message: 'Insufficient storage',
      error: 'Insufficient Storage',
    });
  });

  it('should map an unhandled ENOENT fs error to 404 File not found', () => {
    const host = mockHost('/some/path');
    const errnoError = Object.assign(new Error('No such file or directory'), { code: 'ENOENT' });

    filter.catch(errnoError, {
      switchToHttp: () => host,
    } as Parameters<typeof filter.catch>[1]);

    const { status, json } = host.getResponse();
    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'File not found',
      error: 'Not Found',
    });
  });
});
