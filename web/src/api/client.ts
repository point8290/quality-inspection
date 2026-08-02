import type { ApiErrorDetail, ApiFailure, ApiSuccess } from './types';

// Relative, so Vite's dev proxy and a same-origin production deploy both just work.
const BASE_URL = '/api';

/**
 * Every failed request becomes this one error type, carrying the HTTP status and the
 * server's error code. The status matters beyond display: offline sync treats 409 on a
 * resolve as success and 400 as a dead-letter (DESIGN.md §5.2).
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Performs a request and returns the whole envelope, so callers can read `meta` too. */
export async function request<TData, TMeta = undefined>(
  path: string,
  init?: RequestInit,
): Promise<ApiSuccess<TData, TMeta>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  // A crashed server or a proxy can answer with non-JSON, so parsing must not throw.
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const failure = body as ApiFailure | null;
    throw new ApiRequestError(
      response.status,
      failure?.error?.code ?? 'INTERNAL_ERROR',
      failure?.error?.message ?? response.statusText,
      failure?.error?.details,
    );
  }

  return body as ApiSuccess<TData, TMeta>;
}
