import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

export function getFfmpegPath(): string | null {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv) return fromEnv;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const p = require('ffmpeg-static') as string | null | undefined;
    return p || null;
  } catch {
    return null;
  }
}

export function chunkThresholdBytes(): number {
  const mb = Number(process.env.AI_TRANSCRIPTION_CHUNK_MB ?? '8');
  const clamped = Number.isFinite(mb) ? Math.max(1, mb) : 8;
  return Math.floor(clamped * 1024 * 1024);
}

export function chunkSegmentSeconds(): number {
  const s = Number(process.env.AI_TRANSCRIPTION_CHUNK_SEC ?? '600');
  return Number.isFinite(s) ? Math.max(120, Math.floor(s)) : 600;
}

/** Короче сегменты для очень длинных файлов (2–3 ч) — меньше галлюцинаций и «заеданий». */
export function effectiveChunkSegmentSeconds(byteLength: number): number {
  const base = chunkSegmentSeconds();
  const mb = byteLength / (1024 * 1024);
  if (mb >= 80) return Math.min(base, 300);
  if (mb >= 45) return Math.min(base, 420);
  return base;
}

function ffmpegSplitTimeoutMs(byteLength: number): number {
  const mb = byteLength / (1024 * 1024);
  return Math.min(1_800_000, Math.max(300_000, Math.floor(300_000 + mb * 15_000)));
}

export function shouldChunkAudio(byteLength: number): boolean {
  return byteLength > chunkThresholdBytes();
}

function fileExtForFormat(format: string): string {
  const f = format.toLowerCase();
  if (f === 'mpeg') return 'mp3';
  if (['mp3', 'wav', 'ogg', 'm4a', 'webm', 'flac', 'aac', 'mp4', 'opus'].includes(f)) return f;
  return 'mp3';
}

/**
 * Режет аудио на части (~8 мин по умолчанию) через ffmpeg -c copy.
 * При ошибке или отсутствии ffmpeg возвращает исходный буфер одним элементом.
 */
export async function splitAudioBuffer(
  buffer: Buffer,
  format: string,
  segmentSecOverride?: number
): Promise<Buffer[]> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    console.warn('[STT] ffmpeg не найден — длинный файл отправится целиком (риск 502)');
    return [buffer];
  }

  const ext = fileExtForFormat(format);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jing-stt-'));
  const inputPath = path.join(tmpDir, `input.${ext}`);
  const outPattern = path.join(tmpDir, `part_%03d.${ext}`);
  const segmentSec = segmentSecOverride ?? chunkSegmentSeconds();
  const splitTimeout = ffmpegSplitTimeoutMs(buffer.length);

  try {
    await fs.writeFile(inputPath, buffer);
    await execFileAsync(
      ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        inputPath,
        '-f',
        'segment',
        '-segment_time',
        String(segmentSec),
        '-reset_timestamps',
        '1',
        '-c',
        'copy',
        outPattern,
      ],
      { timeout: splitTimeout, maxBuffer: 64 * 1024 * 1024 }
    );

    const files = (await fs.readdir(tmpDir))
      .filter((f) => f.startsWith('part_') && f.endsWith(`.${ext}`))
      .sort();

    if (files.length <= 1) {
      return [buffer];
    }

    const chunks: Buffer[] = [];
    for (const f of files) {
      chunks.push(await fs.readFile(path.join(tmpDir, f)));
    }
    console.log('[STT] audio split', {
      parts: chunks.length,
      segmentSec,
      totalMb: (buffer.length / 1024 / 1024).toFixed(1),
      partSizesMb: chunks.map((c) => (c.length / 1024 / 1024).toFixed(1)),
    });
    return chunks;
  } catch (e: any) {
    console.warn('[STT] ffmpeg -c copy split failed, retry encode', e?.message || e);
    try {
      const outMp3 = path.join(tmpDir, 'part_%03d.mp3');
      await execFileAsync(
        ffmpeg,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          inputPath,
          '-f',
          'segment',
          '-segment_time',
          String(segmentSec),
          '-ac',
          '1',
          '-ar',
          '16000',
          '-b:a',
          '64k',
          outMp3,
        ],
        { timeout: splitTimeout, maxBuffer: 64 * 1024 * 1024 }
      );
      const mp3Files = (await fs.readdir(tmpDir))
        .filter((f) => f.startsWith('part_') && f.endsWith('.mp3'))
        .sort();
      if (mp3Files.length > 1) {
        const chunks: Buffer[] = [];
        for (const f of mp3Files) {
          chunks.push(await fs.readFile(path.join(tmpDir, f)));
        }
        console.log('[STT] audio split (re-encoded mp3)', { parts: chunks.length, segmentSec });
        return chunks;
      }
    } catch (e2: any) {
      console.warn('[STT] ffmpeg re-encode split failed', e2?.message || e2);
    }
    return [buffer];
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
