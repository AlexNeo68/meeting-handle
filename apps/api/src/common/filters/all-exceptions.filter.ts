import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { MAX_AVATAR_SIZE, MAX_FILE_SIZE } from '@meeting-ai/shared';
import { Request, Response } from 'express';

// Error message language strategy:
// The API returns user-facing errors in English as stable keys. The web app
// translates them to Russian in one place — translateApiError
// (apps/web/src/lib/api-errors.ts). Never return localized (e.g. Russian)
// messages from the server.

function fileSizeLimitMessage(maxBytes: number): string {
  return `File size exceeds ${maxBytes / (1024 * 1024)} MB limit`;
}

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
        const limit = isAvatarUpload(request) ? MAX_AVATAR_SIZE : MAX_FILE_SIZE;
        response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: 400,
          message: fileSizeLimitMessage(limit),
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
