import fs from 'node:fs/promises';
import path from 'node:path';

export type StoredFile = {
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'video' | 'other';
};

export type Submission = {
  id: string;
  createdAt: string; // ISO
  clientName: string;
  clientEmail?: string;
  title?: string;
  description?: string;
  files: StoredFile[];
};

type DbShape = {
  submissions: Submission[];
};

/** Root directory for all runtime data (uploads + db file). */
export const DATA_DIR =
  process.env.DATA_DIR && path.isAbsolute(process.env.DATA_DIR)
    ? process.env.DATA_DIR
    : path.join(process.cwd(), 'data');

export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'db.json');

async function ensureDirs() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

async function readDb(): Promise<DbShape> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as DbShape;
    if (!parsed.submissions) return { submissions: [] };
    return parsed;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return { submissions: [] };
    }
    throw err;
  }
}

async function writeDb(db: DbShape): Promise<void> {
  await ensureDirs();
  const tmp = `${DB_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, DB_PATH);
}

export async function listSubmissions(): Promise<Submission[]> {
  const db = await readDb();
  // Newest first.
  return [...db.submissions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function addSubmission(sub: Submission): Promise<void> {
  const db = await readDb();
  db.submissions.push(sub);
  await writeDb(db);
}

export async function findSubmission(id: string): Promise<Submission | null> {
  const db = await readDb();
  return db.submissions.find((s) => s.id === id) ?? null;
}
