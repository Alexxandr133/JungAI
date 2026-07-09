import path from 'path';
import type OpenAI from 'openai';
import { config } from '../config';
import { createOpenRouterClient } from './openRouterHttp';

// pdf-parse v2 fallback
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse') as {
  PDFParse: new (opts: { data: Buffer }) => {
    getText(): Promise<{ text: string }>;
    destroy(): Promise<void>;
  };
};

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsPromise: Promise<PdfJsModule> | null = null;

function pdfjsDistRoot(): string {
  return path.dirname(require.resolve('pdfjs-dist/package.json'));
}

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
      const root = pdfjsDistRoot();
      pdfjs.GlobalWorkerOptions.workerSrc = path.join(root, 'legacy/build/pdf.worker.mjs');
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/** 0..1 — выше = текст похож на нормальный русский/английский */
export function scoreExtractedTextQuality(text: string): number {
  const t = text.trim();
  if (!t) return 0;

  let score = 0.55;
  const len = t.length;

  const suspicious = (t.match(/[@?=<>]/g) || []).length;
  score -= Math.min(0.55, (suspicious / len) * 18);

  const mixedScript = (t.match(/[а-яё][A-Z@?=<>]|[A-Z@?=<>][а-яё]/gi) || []).length;
  score -= Math.min(0.45, (mixedScript / len) * 22);

  const cyrillic = (t.match(/[а-яА-ЯёЁ]/g) || []).length;
  const latin = (t.match(/[a-zA-Z]/g) || []).length;
  const letters = cyrillic + latin || 1;
  if (cyrillic > letters * 0.15) score += 0.15;

  const words = t.match(/[\p{L}]{3,}/gu) || [];
  const badWords = words.filter((w) => /[@?=<>]/.test(w) || /[а-яё][A-Z]|[A-Z][а-яё]/.test(w));
  if (words.length) score += ((words.length - badWords.length) / words.length) * 0.35;

  return Math.max(0, Math.min(1, score));
}

export function isGarbledExtractedText(text: string): boolean {
  return scoreExtractedTextQuality(text) < 0.48;
}

async function extractPdfTextViaPdfJs(buffer: Buffer): Promise<string> {
  const pdfjs = await loadPdfJs();
  const root = pdfjsDistRoot();
  const doc = await pdfjs
    .getDocument({
      data: new Uint8Array(buffer),
      cMapUrl: path.join(root, 'cmaps/'),
      cMapPacked: true,
      standardFontDataUrl: path.join(root, 'standard_fonts/'),
      useSystemFonts: true,
      disableFontFace: false,
    })
    .promise;

  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const line = tc.items
      .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (line) parts.push(line);
  }
  await doc.destroy();
  return parts.join('\n\n');
}

async function extractPdfTextViaPdfParse(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result?.text || '';
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractPdfTextViaOpenRouter(buffer: Buffer, fileName: string): Promise<string> {
  const client = createOpenRouterClient();

  const base64 = buffer.toString('base64');
  const model = config.aiModelDefault || 'google/gemini-2.0-flash-001';

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Извлеки весь читаемый текст из PDF. Сохрани структуру абзацев и заголовков. ' +
              'Верни только текст документа на языке оригинала, без комментариев и markdown.',
          },
          {
            type: 'file',
            file: {
              filename: fileName,
              file_data: `data:application/pdf;base64,${base64}`,
            },
          } as OpenAI.Chat.Completions.ChatCompletionContentPart,
        ],
      },
    ],
    max_tokens: 16000,
    temperature: 0.1,
  });

  const text = completion.choices[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Модель не вернула текст из PDF');
  }
  return text.trim();
}

export type ExtractPdfResult = {
  text: string;
  method: 'pdfjs' | 'pdf-parse' | 'openrouter';
  quality: number;
};

export async function extractPdfText(buffer: Buffer, fileName = 'document.pdf'): Promise<ExtractPdfResult> {
  const candidates: Array<{ text: string; method: ExtractPdfResult['method'] }> = [];

  try {
    candidates.push({ text: await extractPdfTextViaPdfJs(buffer), method: 'pdfjs' });
  } catch {
    /* try next */
  }

  try {
    candidates.push({ text: await extractPdfTextViaPdfParse(buffer), method: 'pdf-parse' });
  } catch {
    /* try next */
  }

  const ranked = candidates
    .map((c) => ({ ...c, quality: scoreExtractedTextQuality(c.text) }))
    .filter((c) => c.text.trim())
    .sort((a, b) => b.quality - a.quality);

  let best = ranked[0];

  if (!best || best.quality < 0.48) {
    try {
      const aiText = await extractPdfTextViaOpenRouter(buffer, fileName);
      const aiQuality = scoreExtractedTextQuality(aiText);
      if (!best || aiQuality > best.quality) {
        best = { text: aiText, method: 'openrouter', quality: aiQuality };
      }
    } catch {
      /* local only */
    }
  }

  if (!best?.text.trim()) {
    throw new Error(
      'Не удалось извлечь текст из PDF. Попробуйте загрузить DOCX или экспортировать PDF через «Печать → Сохранить как PDF».'
    );
  }

  if (best.quality < 0.35) {
    throw new Error(
      'PDF распознан с ошибками кодировки. Сохраните документ как DOCX или пересохраните PDF через «Печать → PDF» в Word/PowerPoint.'
    );
  }

  return { text: best.text, method: best.method, quality: best.quality };
}
