import { NextRequest, NextResponse } from 'next/server';
import { UPLOAD_COOKIE, getUploadAccessCode } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/upload/access — exchange a correct access code for a cookie
 * that unlocks the /upload page. If no code is configured server-side,
 * access is open and this always succeeds.
 */
export async function POST(req: NextRequest) {
  const configured = getUploadAccessCode();
  if (!configured) {
    return NextResponse.json({ ok: true });
  }

  const form = await req.formData().catch(() => null);
  const code = form ? String(form.get('code') ?? '').trim() : '';

  if (code !== configured) {
    return NextResponse.json({ error: 'Incorrect access code.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: UPLOAD_COOKIE,
    value: configured,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: UPLOAD_COOKIE,
    value: '',
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return res;
}
