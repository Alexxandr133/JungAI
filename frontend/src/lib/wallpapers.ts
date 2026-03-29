/** Файлы из `public/wallpapers/` (копия с `walpep/`). */
export const WALLPAPER_FILES = [
  '0790a8c79f97c8c779a9c6222256d7f4.jpg',
  '4881f951f3cbedf4c2fb6008b888af56.jpg',
  '789f455e0383309223eb83c4c47206ff.jpg',
  '7da0fa407754be73a7a486076b2b5c1d.jpg',
  'dc4e84424d4016f2a76db2c8672f60ba.jpg',
  'e7226408d91edf5d20b8623a51a9cef7.jpg',
  'ff84c44eeda93e2fa45072b06bb1e636.jpg'
] as const;

export function wallpaperUrl(filename: string): string {
  return `/wallpapers/${encodeURIComponent(filename)}`;
}
