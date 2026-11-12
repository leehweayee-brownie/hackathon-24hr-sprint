import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError, ErrorCode } from '@vp/shared';
import type { Response } from 'express';
import { AppException } from '../errors/app.exception';

const STATUS_CODES: Record<number, ErrorCode> = {
  400: ErrorCode.VALIDATION_FAILED,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  413: ErrorCode.FILE_TOO_LARGE,
  429: ErrorCode.RATE_LIMITED,
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<{ method: string; url: string }>();
    const { status, body } = this.toEnvelope(exception);
    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} → ${status}`, exception instanceof Error ? exception.stack : String(exception));
    }
    res.status(status).json(body);
  }

  private toEnvelope(exception: unknown): { status: number; body: ApiError } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        body: { success: false, message: exception.message, code: exception.code, errors: exception.errors },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      let message = exception.message;
      let errors: ApiError['errors'] = [];
      if (typeof response === 'object' && response !== null) {
        const r = response as { message?: string | string[]; error?: string };
        if (Array.isArray(r.message)) {
          errors = r.message.map((m) => ({ message: m, field: m.split(' ')[0] }));
          message = 'Validation failed';
        } else if (typeof r.message === 'string') {
          message = r.message;
        }
      }
      return { status, body: { success: false, message, code: STATUS_CODES[status] ?? ErrorCode.INTERNAL, errors } };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        return { status: 404, body: { success: false, message: 'Resource not found', code: ErrorCode.NOT_FOUND, errors: [] } };
      }
      if (exception.code === 'P2002') {
        return { status: 409, body: { success: false, message: 'Resource already exists', code: ErrorCode.CONFLICT, errors: [] } };
      }
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { success: false, message: 'Something went wrong', code: ErrorCode.INTERNAL, errors: [] },
    };
  }
}
