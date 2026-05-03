import path from 'path';

/**
 * Абсолютный путь к каталогу backend/uploads.
 * Не использует process.cwd(): при смене cwd PM2 статика и загрузки остаются согласованными.
 * При необходимости переопределить каталог в проде: UPLOADS_DIR=/path/to/uploads
 */
export function getUploadsRoot(): string {
  if (process.env.UPLOADS_DIR?.trim()) {
    return path.resolve(process.env.UPLOADS_DIR.trim());
  }
  return path.resolve(__dirname, '..', '..', 'uploads');
}
