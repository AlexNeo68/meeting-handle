import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      if (exception.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE) {
        response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: 400,
          message: 'File size exceeds 100 MB limit',
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
