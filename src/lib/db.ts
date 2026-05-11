import { getStore } from '@netlify/blobs';

// ── Types ───────────────────────────────────────────────────────────

export type StoredFile = {
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'video' | 'other';
  // Set once the client finishes uploading the file to Google Drive.
  driveFileId?: string;
};

export type Submission = {
  id: string;
  createdAt: string; // ISO
  clientName: string;
  clientEmail?: string;
  title?: string;
  description?: string;
  files: StoredFile[];
  status: 'pending' | 'complete';
};

// ── Blob store ──────────────────────────────────────────────────────

function getSubmissionsStore() {
  return getStore({ name: 'submissions', consistency: 'strong' });
}

// ── Public API ──────────────────────────────────────────────────────

export async function addSubmission(sub: Submission): Promise<void> {
  const store = getSubmissionsStore();
  await store.setJSON(sub.id, sub);
}

export async function findSubmission(id: string): Promise<Submission | null> {
  const store = getSubmissionsStore();
  const data = await store.get(id, { type: 'json' });
  return (data as Submission) ?? null;
}

export async function updateSubmission(
  id: string,
  patch: Partial<Submission>,
): Promise<Submission | null> {
  const existing = await findSubmission(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  await addSubmission(updated);
  return updated;
}

export async function deleteSubmission(id: string): Promise<boolean> {
  const store = getSubmissionsStore();
  const existing = await findSubmission(id);
  if (!existing) return false;
  await store.delete(id);
  return true;
}

export async function listSubmissions(): Promise<Submission[]> {
  const store = getSubmissionsStore();
  const { blobs } = await store.list();

  const submissions = await Promise.all(
    blobs.map(async (entry) => {
      const data = await store.get(entry.key, { type: 'json' });
      return data as Submission | null;
    }),
  );

  return submissions
    .filter((s): s is Submission => s !== null && s.status === 'complete')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
