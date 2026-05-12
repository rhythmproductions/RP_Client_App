import { google, drive_v3 } from 'googleapis';

// ── Config ──────────────────────────────────────────────────────────

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

function readEnv(): { keyJson: string; sharedDriveId: string } {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID;
  if (!keyJson) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY environment variable.');
  }
  if (!sharedDriveId) {
    throw new Error('Missing GOOGLE_SHARED_DRIVE_ID environment variable.');
  }
  return { keyJson, sharedDriveId };
}

function parseKey(keyJson: string): { client_email: string; private_key: string } {
  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(keyJson);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON.');
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_KEY is missing client_email or private_key.',
    );
  }
  // Netlify env vars often arrive with literal "\n" sequences instead of
  // actual newlines — normalise so the PEM parser is happy.
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, '\n'),
  };
}

function getAuth() {
  const { keyJson } = readEnv();
  const { client_email, private_key } = parseKey(keyJson);
  return new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: [DRIVE_SCOPE],
  });
}

function getDrive(): drive_v3.Drive {
  return google.drive({ version: 'v3', auth: getAuth() });
}

// ── Resumable upload session ────────────────────────────────────────

/**
 * Create a Google Drive resumable upload session.
 *
 * Returns a session URI that the client browser can PUT the file bytes
 * directly to, bypassing the Netlify Function (which would otherwise
 * cap the request body at ~6 MB).
 *
 * `origin` must be the exact browser origin that will issue the PUT —
 * Drive binds CORS support on the session URI to whatever Origin we
 * pass in this initial request.
 */
export async function createResumableUploadSession(args: {
  filename: string;
  mimeType: string;
  size: number;
  origin: string;
}): Promise<string> {
  const { sharedDriveId } = readEnv();
  const auth = getAuth();
  const { token } = await auth.getAccessToken();
  if (!token) {
    throw new Error('Failed to obtain Google access token.');
  }

  const metadata = {
    name: args.filename,
    parents: [sharedDriveId],
  };

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': args.mimeType,
        'X-Upload-Content-Length': String(args.size),
        Origin: args.origin,
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Drive resumable session failed (${res.status}): ${detail || res.statusText}`,
    );
  }

  const sessionUri = res.headers.get('location');
  if (!sessionUri) {
    throw new Error('Drive did not return a session URI.');
  }
  return sessionUri;
}

// ── Download / delete ────────────────────────────────────────────────

/**
 * Stream a file's bytes from Drive. Use the returned stream as the body
 * of a Response.
 */
export async function getFileStream(
  driveFileId: string,
): Promise<NodeJS.ReadableStream> {
  const drive = getDrive();
  const res = await drive.files.get(
    {
      fileId: driveFileId,
      alt: 'media',
      supportsAllDrives: true,
    },
    { responseType: 'stream' },
  );
  return res.data;
}

export async function deleteDriveFile(driveFileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.delete({
    fileId: driveFileId,
    supportsAllDrives: true,
  });
}
