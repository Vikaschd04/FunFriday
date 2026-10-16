import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@funfriday/contracts';

/** A business-rule failure with a stable machine-readable code (e.g. CONFLICT, LAST_ADMIN). */
export class DomainException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    status: HttpStatus = HttpStatus.CONFLICT,
  ) {
    super(code, status);
  }
}

export class ConflictDomainException extends DomainException {
  constructor() {
    super('CONFLICT', HttpStatus.CONFLICT);
  }
}

export class LastAdminException extends DomainException {
  constructor() {
    super('LAST_ADMIN', HttpStatus.CONFLICT);
  }
}
