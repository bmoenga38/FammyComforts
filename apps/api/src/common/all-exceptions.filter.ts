import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { fail } from '@sommycomfort/shared';

/** Map common HTTP statuses to stable string error codes (the envelope `code`). */
const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

function defaultCodeForStatus(status: number): string {
  return CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR');
}

/**
 * Serializes every thrown error into the architecture's error envelope:
 * `{ error: { code, message, details? } }`. HttpExceptions whose body already
 * carries `code`/`details` (e.g. the Zod pipe) are preserved.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null) {
        const r = body as Record<string, unknown>;
        code =
          typeof r.code === 'string' ? r.code : defaultCodeForStatus(status);
        if (typeof r.message === 'string') message = r.message;
        else if (Array.isArray(r.message)) message = r.message.join(', ');
        else message = exception.message;
        if (Array.isArray(r.details)) details = r.details;
      } else {
        code = defaultCodeForStatus(status);
        message = typeof body === 'string' ? body : exception.message;
      }
    } else {
      this.logger.error(
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : String(exception),
      );
    }

    response.status(status).json(fail(code, message, details));
  }
}
