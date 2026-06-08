import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Validates/parses a handler input against a shared Zod schema (AR5). Apply per
 * param/body, e.g. `@Body(new ZodValidationPipe(createBookingSchema))`. On
 * failure it throws a `BadRequestException` carrying the envelope fields
 * (`code`/`message`/`details`) that the global exception filter serializes.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: result.error.issues,
      });
    }
    return result.data;
  }
}
