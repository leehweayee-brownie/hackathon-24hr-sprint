import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@vp/shared';

export interface FieldError {
  field?: string;
  message: string;
}

/** HttpException carrying a machine-readable code and the consistent error envelope. */
export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly errors: FieldError[] = [],
  ) {
    super({ success: false, message, code, errors }, status);
  }

  static notFound(what = 'Resource'): AppException {
    return new AppException(ErrorCode.NOT_FOUND, `${what} not found`, HttpStatus.NOT_FOUND);
  }

  static forbidden(message = 'You do not have access to this resource'): AppException {
    return new AppException(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  static unauthorized(message = 'Authentication required'): AppException {
    return new AppException(ErrorCode.UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
  }

  static conflict(message: string, code: ErrorCode = ErrorCode.CONFLICT): AppException {
    return new AppException(code, message, HttpStatus.CONFLICT);
  }
}
