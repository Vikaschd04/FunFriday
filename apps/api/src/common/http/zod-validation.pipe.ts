import { type PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { ValidationException } from '../errors/validation.exception.js';

/** Validates a body/query against a shared contract schema; failures become 400 with field errors. */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    const flat = z.flattenError(result.error);
    const fieldErrors: Record<string, string[]> = {};
    for (const [field, messages] of Object.entries(flat.fieldErrors)) {
      fieldErrors[field] = (messages as string[] | undefined) ?? [];
    }
    if (flat.formErrors.length > 0) {
      fieldErrors._ = flat.formErrors;
    }
    throw new ValidationException({ fieldErrors });
  }
}
