import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const code = (exception as NodeJS.ErrnoException | null)?.code;
    const status = code === 'ENOSPC' ? 507 : code === 'ENOENT' ? 404 : 500;

    response.status(status).json({
      statusCode: status,
      message: status === 507 ? 'Insufficient storage' : 'Internal server error',
    });
  }
}
