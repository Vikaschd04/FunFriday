import { BadRequestException } from '@nestjs/common';
import type { ValidationDetails } from '@funfriday/contracts';

/** 400 BAD_REQUEST carrying per-field messages that come from our shared schemas. */
export class ValidationException extends BadRequestException {
  constructor(readonly details: ValidationDetails) {
    super('validation failed');
  }
}
