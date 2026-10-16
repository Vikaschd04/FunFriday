import { NotFoundException, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

const uuid = z.uuid();

/** A malformed id can never name a resource: respond 404 instead of reaching the database. */
export class UuidParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!uuid.safeParse(value).success) {
      throw new NotFoundException();
    }
    return value;
  }
}
