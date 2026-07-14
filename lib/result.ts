export type AppErrorCode =
  | 'NETWORK'
  | 'AUTH'
  | 'VALIDATION'
  | 'PAYMENT'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'RATE_LIMIT'
  | 'UNKNOWN';

export type AppError = {
  code: AppErrorCode;
  message: string;
  cause?: unknown;
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<T = never>(
  code: AppErrorCode,
  message: string,
  cause?: unknown,
): Result<T> {
  return { ok: false, error: { code, message, cause } };
}

export function fromUnknown(error: unknown, fallback = 'Something went wrong'): AppError {
  if (error && typeof error === 'object' && 'message' in error) {
    return {
      code: 'UNKNOWN',
      message: String((error as { message: unknown }).message) || fallback,
      cause: error,
    };
  }
  return { code: 'UNKNOWN', message: fallback, cause: error };
}
