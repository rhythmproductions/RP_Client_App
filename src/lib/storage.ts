import { createClient } from '@supabase/supabase-js';

const BUCKET = 'uploads';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.',
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

/**
 * Generate a signed URL that the client can PUT a file to directly.
 * The URL is valid for 10 minutes.
 */
export async function createSignedUploadUrl(
  storagePath: string,
): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Failed to create upload URL: ${error?.message ?? 'unknown error'}`,
    );
  }
  return data.signedUrl;
}

/**
 * Delete all files for a submission from Supabase Storage.
 */
export async function deleteSubmissionFiles(
  submissionId: string,
  storedNames: string[],
): Promise<void> {
  const supabase = getSupabase();
  const paths = storedNames.map((name) => `${submissionId}/${name}`);
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) {
    throw new Error(`Failed to delete files: ${error.message}`);
  }
}

/**
 * Generate a signed download URL for the admin to view a file.
 * Valid for 1 hour. When `forceDownload` is set, the browser will
 * download the file instead of displaying it inline.
 */
export async function createSignedDownloadUrl(
  storagePath: string,
  forceDownload?: string,
): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60, forceDownload ? { download: forceDownload } : undefined);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Failed to create download URL: ${error?.message ?? 'unknown error'}`,
    );
  }
  return data.signedUrl;
}
