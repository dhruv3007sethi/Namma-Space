import type { ErrorCode } from '@namma/shared';
import type { z } from 'zod';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PROVIDER_NOT_CONFIGURED: 503,
  INTERNAL_ERROR: 500,
};

/** An error that maps directly to a structured API error response. */
export class AppError extends Error {
  override name = 'AppError';
  readonly statusCode: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.statusCode = STATUS_BY_CODE[code];
  }
}

export const notFound = (entity: string, id: string) =>
  new AppError('NOT_FOUND', `${entity} ${id} was not found`);

/** Validates `data` against `schema`, throwing a VALIDATION_ERROR AppError on failure. */
export function parseOrThrow<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Request validation failed',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}
