import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Stockage des photos de profil (section AC) : décodage d'une image envoyée en base64 depuis le
 * frontend et écriture sur disque (pas de dépendance multipart sur ce serveur http natif). Seule
 * l'URL relative (`/uploads/avatars/...`) est conservée en base, servie statiquement par le
 * serveur (voir `handleAvatarUpload`/`readUploadedFile` dans server.ts).
 */

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

export function uploadsRoot(): string {
  return path.resolve(process.cwd(), 'uploads');
}

export async function saveAvatarImage(profileId: string, dataUrlOrBase64: string, mimeTypeHint?: string): Promise<string> {
  const match = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/.exec(dataUrlOrBase64);
  const mimeType = match ? match[1] : mimeTypeHint;
  const base64 = match ? match[2] : dataUrlOrBase64;
  const extension = mimeType ? MIME_EXTENSIONS[mimeType] : undefined;
  if (!extension) throw new Error('Format d\'image non supporté (png, jpeg, webp ou gif attendu)');

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.byteLength === 0) throw new Error('Image vide');
  if (buffer.byteLength > MAX_AVATAR_BYTES) throw new Error('Image trop volumineuse (4 Mo maximum)');

  const dir = path.join(uploadsRoot(), 'avatars');
  await mkdir(dir, { recursive: true });
  const filename = `${profileId}.${extension}`;
  await writeFile(path.join(dir, filename), buffer);
  return `/uploads/avatars/${filename}`;
}

export async function readUploadedFile(relativeUrl: string): Promise<{ data: Buffer; contentType: string } | null> {
  const safe = path.normalize(relativeUrl).replace(/^([./\\]+)/, '');
  const filePath = path.join(uploadsRoot(), safe.replace(/^uploads[/\\]/, ''));
  if (!filePath.startsWith(uploadsRoot())) return null;
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const contentType = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`;
    return { data, contentType };
  } catch {
    return null;
  }
}
