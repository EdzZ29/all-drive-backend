import { CookieOptions } from 'express';

// Name of the httpOnly cookie that carries the JWT access token.
export const ACCESS_TOKEN_COOKIE = 'access_token';

// Converts an ms-style duration ("1d", "12h", "30m", "3600s") or a plain
// number of seconds into milliseconds, for use as a cookie maxAge.
export function durationToMs(
  value: string | undefined,
  fallbackMs: number,
): number {
  if (!value) return fallbackMs;

  const match = /^(\d+)\s*(s|m|h|d)?$/.exec(value.trim());
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * unitMs[unit];
}

// Shared cookie flags. httpOnly keeps the token out of reach of JS (XSS),
// sameSite=lax guards against CSRF, secure is enabled outside development.
export function baseCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    path: '/',
  };
}
