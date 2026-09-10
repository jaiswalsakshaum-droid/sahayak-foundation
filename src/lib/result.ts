/**
 * Safe result wrapper type for services.
 * Distinguishes success, genuine failure, and degraded/offline fallbacks.
 */

export type ServiceResult<T> =
  | { ok: true; data: T; degraded?: false }
  | { ok: false; error: string; degraded?: boolean; code?: string };

export function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function err<T = never>(
  error: string,
  optionsOrCode?: string | { degraded?: boolean; code?: string }
): ServiceResult<T> {
  if (typeof optionsOrCode === "string") {
    return {
      ok: false,
      error,
      degraded: false,
      code: optionsOrCode,
    };
  }

  return {
    ok: false,
    error,
    degraded: optionsOrCode?.degraded ?? false,
    code: optionsOrCode?.code,
  };
}

export function isOk<T>(result: ServiceResult<T>): result is { ok: true; data: T; degraded?: false } {
  return result.ok === true;
}

export function isErr<T>(
  result: ServiceResult<T>
): result is { ok: false; error: string; degraded?: boolean; code?: string } {
  return result.ok === false;
}

export function unwrapOr<T>(result: ServiceResult<T>, fallback: T): T {
  return result.ok ? result.data : fallback;
}
