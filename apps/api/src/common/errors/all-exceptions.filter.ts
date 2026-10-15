import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { resolveRequestId } from '../http/request-id.js';
import { toErrorResponse } from './error-response.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const requestId = resolveRequestId(res.locals.requestId);
    const { status, body } = toErrorResponse(exception, requestId);

    if (status >= 500) {
      // req.path excludes the query string, which may later carry invite tokens.
      this.logger.error(
        `${req.method} ${req.path} -> ${status} [${requestId}]`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    res.status(status).json(body);
  }
}
