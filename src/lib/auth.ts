import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'rp_admin';

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
