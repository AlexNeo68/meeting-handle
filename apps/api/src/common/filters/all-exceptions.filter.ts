import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { MAX_AVATAR_SIZE, MAX_FILE_SIZE } from '@meeting-ai/shared';
import { Request, Response } from 'express';

const FILE_SIZE_LIMIT_MESSAGE = `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)} MB limit`;
const AVATAR_SIZE_LIMIT_MESSAGE = `Размер файла превышает лимит ${MAX_AVATAR_SIZE / (1024 * 1024)} МБ`;

function isAvatarUpload(request: Request): boolean {
  const path = request.route?.path ?? request.originalUrl ?? '';
  return path.startsWith('/user/profile/avatar');
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      if (exception.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE) {
        const request = host.switchToHttp().getRequest<Request>();
        response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: 400,
          message: isAvatarUpload(request) ? AVATAR_SIZE_LIMIT_MESSAGE : FILE_SIZE_LIMIT_MESSAGE,
          error: 'Bad Request',
        });
        return;
      }

      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const code = (exception as NodeJS.ErrnoException | null)?.code;
    const status = code === 'ENOSPC' ? 507 : code === 'ENOENT' ? 404 : 500;
    const message =
      status === 507
        ? 'Insufficient storage'
        : status === 404
          ? 'File not found'
          : 'Internal server error';
    const error =
      status === 507
        ? 'Insufficient Storage'
        : status === 404
          ? 'Not Found'
          : 'Internal Server Error';

    response.status(status).json({
      statusCode: status,
      message,
      error,
    });
  }
}
