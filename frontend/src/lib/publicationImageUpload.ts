import { api } from './api';

/** Persist only file URLs — never base64 data: / blob: */
export function toPersistedImageUrl(url: string | null | undefined): string | null {
  const value = String(url || '').trim();
  if (!value) return null;
  if (value.startsWith('data:') || value.startsWith('blob:')) return null;
  const abs = value.match(/^https?:\/\/[^/]+(\/uploads\/.+)$/i);
  if (abs) return abs[1];
  if (value.startsWith('/uploads/')) return value;
  if (value.startsWith('/') && value.length <= 500) return value;
  if (/^https?:\/\//i.test(value) && value.length <= 500) return value;
  return null;
}

/** Client-side image compress before upload. Returns a JPEG/PNG Blob. */
export async function compressImageFile(
  file: File,
  opts: { maxEdge?: number; quality?: number } = {}
): Promise<Blob> {
  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.82;
  if (!file.type.startsWith('image/')) throw new Error('Нужен файл изображения');

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas недоступен');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const preferPng = file.type === 'image/png' && scale === 1;
  const mime = preferPng ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, preferPng ? undefined : quality)
  );
  if (!blob) throw new Error('Не удалось сжать изображение');
  return blob;
}

export type UploadKind = 'post' | 'avatar' | 'cover';

const KIND_EDGE: Record<UploadKind, number> = {
  post: 1600,
  cover: 2560,
  avatar: 512
};

export async function uploadPublicationImage(
  file: File,
  token: string,
  kind: UploadKind = 'post'
): Promise<string> {
  const blob = await compressImageFile(file, {
    maxEdge: KIND_EDGE[kind],
    quality: kind === 'avatar' ? 0.88 : kind === 'cover' ? 0.9 : 0.82
  });
  const form = new FormData();
  const ext = blob.type === 'image/png' ? 'png' : 'jpg';
  form.append('image', blob, `image.${ext}`);
  const res = await api<{ url: string }>('/api/publications/upload-image', {
    method: 'POST',
    token,
    body: form
  });
  if (!res.url) throw new Error('Сервер не вернул URL');
  return res.url;
}
