import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'rp_admin';
const UPLOAD_COOKIE_NAME = 'rp_upload';

export function getAdminPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD;
}

export function isAdminCookieValid(cookieValue: string | undefined): boolean {
  const pass = getAdminPassword();
  if (!pass) return false;
  return cookieValue === pass;
}

export type AuthResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

/** Check the admin cookie on an API route. Returns a 401 response if invalid. */
export function requireAdmin(req: NextRequest): AuthResult {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!isAdminCookieValid(cookie)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }),
    };
  }
  return { ok: true };
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;

// ── Client upload access code ───────────────────────────────────────

/**
 * Optional shared code that gates the /upload page. Set UPLOAD_ACCESS_CODE
 * in the environment to require it; leave it unset to keep uploads open.
 */
export function getUploadAccessCode(): string | undefined {
  const code = process.env.UPLOAD_ACCESS_CODE;
  return code && code.trim() ? code.trim() : undefined;
}

/** True when no code is configured, or the cookie matches the code. */
export function isUploadAccessValid(cookieValue: string | undefined): boolean {
  const code = getUploadAccessCode();
  if (!code) return true; // no gate configured
  return cookieValue === code;
}

/** Guard an upload API route. Returns a 401 response when the code is wrong. */
export function requireUploadAccess(req: NextRequest): AuthResult {
  const cookie = req.cookies.get(UPLOAD_COOKIE_NAME)?.value;
  if (!isUploadAccessValid(cookie)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'A valid access code is required to upload.' },
        { status: 401 },
      ),
    };
  }
  return { ok: true };
}

export const UPLOAD_COOKIE = UPLOAD_COOKIE_NAME;
