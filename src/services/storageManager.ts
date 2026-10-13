import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { db } from '../db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOADS_DIR = path.resolve(__dirname, '../../temp_uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Generates an unguessable safe storage filename.
 */
export function generateStorageKey(): string {
  return `doc_${Date.now()}_${crypto.randomBytes(12).toString('hex')}.pdf`;
}

/**
 * Resolves and verifies that a file path is safely contained inside UPLOADS_DIR.
 * Guards against directory traversal exploits.
 */
export function resolveSafeStoragePath(filename: string): string {
  const safeFilename = path.basename(filename);
  const resolvedPath = path.resolve(UPLOADS_DIR, safeFilename);

  if (!resolvedPath.startsWith(UPLOADS_DIR)) {
    throw new Error('Access denied: Path traversal detected.');
  }
  return resolvedPath;
}

/**
 * Deletes a file safely from disk if it exists.
 */
export function safeDeleteFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (err) {
    console.error(`[StorageManager] Failed to delete file ${filePath}:`, err);
  }
  return false;
}

/**
 * Scans and deletes expired documents according to configured TTL retention policy.
 */
export async function purgeExpiredDocuments(): Promise<number> {
  let purgedCount = 0;
  try {
    const expiredList = await db.listExpiredDocuments();
    for (const doc of expiredList) {
      if (doc.filePath) {
        safeDeleteFile(doc.filePath);
      }
      await db.deleteDocument(doc.id);
      await db.logAudit(
        'SYSTEM',
        'TTL_PURGE',
        doc.originalFilename,
        `Document TTL expired. Securely removed from storage. (ID: ${doc.id})`
      );
      purgedCount++;
    }
  } catch (err) {
    console.error('[StorageManager] Error running TTL purge:', err);
  }
  return purgedCount;
}
