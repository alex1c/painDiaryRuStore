/**
 * Application and storage error types.
 * In development, messages stay diagnostic; production callers may map to UI copy.
 * Never swallow errors with empty catch blocks — always wrap or rethrow.
 */

/**
 * Thrown when SQLite / adapter operations fail unexpectedly.
 * Carries an optional underlying cause for debugging.
 */
export class StorageError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;

    // Preserve prototype chain for instanceof checks under older runtimes.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Generic application error for non-storage domain failures
 * (e.g. invariant violations outside validation helpers).
 */
export class AppError extends Error {
  readonly cause?: unknown;
  readonly code?: string;

  constructor(message: string, options?: { cause?: unknown; code?: string }) {
    super(message);
    this.name = 'AppError';
    this.cause = options?.cause;
    this.code = options?.code;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Returns a human-readable diagnostic string for logs / dev overlays.
 * Prefer this over dumping raw Error objects into UI.
 */
export function formatErrorForDiagnostics(error: unknown): string {
  if (error instanceof StorageError || error instanceof AppError) {
    const base = `${error.name}: ${error.message}`;
    // Prefer verbose cause chains in development / test environments.
    const isDev =
      (typeof __DEV__ !== 'undefined' && __DEV__) ||
      process.env.NODE_ENV !== 'production';
    if (error.cause !== undefined && isDev) {
      const causeText =
        error.cause instanceof Error
          ? `${error.cause.name}: ${error.cause.message}`
          : String(error.cause);
      return `${base} | cause: ${causeText}`;
    }
    return base;
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}
