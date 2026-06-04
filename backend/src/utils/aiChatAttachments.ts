import mammoth from 'mammoth';
import { config } from '../config';

// pdf-parse v2: класс PDFParse, не функция
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse') as {
  PDFParse: new (opts: { data: Buffer }) => {
    getText(): Promise<{ text: string }>;
    destroy(): Promise<void>;
  };
};

export const AI_CHAT_MAX_FILES = 5;
export const AI_CHAT_MAX_FILE_BYTES = 8 * 1024 * 1024;
/** Для vision data URL — слишком большие картинки режем */
export const AI_CHAT_MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const AI_CHAT_MAX_EXTRACTED_TEXT_CHARS = 30_000;
const ATTACHMENT_TTL_MS = 60 * 60 * 1000;

const VISION_MODEL_CANDIDATES = [
  config.aiVisionModel,
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'anthropic/claude-sonnet-4.6',
  'google/gemini-2.0-flash-001',
  'google/gemini-2.5-flash-preview',
];

export type AiChatAttachmentKind = 'image' | 'document';

export type StoredAiChatAttachment = {
  userId: string;
  name: string;
  mimeType: string;
  kind: AiChatAttachmentKind;
  text?: string;
  imageDataUrl?: string;
  createdAt: number;
};

const store = new Map<string, StoredAiChatAttachment>();

function pruneExpired() {
  const now = Date.now();
  for (const [id, item] of store) {
    if (now - item.createdAt > ATTACHMENT_TTL_MS) store.delete(id);
  }
}

function newAttachmentId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const DOC_EXTENSIONS = new Set(['.pdf', '.docx', '.doc', '.txt']);

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function mimeFromName(name: string): string {
  const ext = extOf(name);
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.txt') return 'text/plain';
  if (['.jpg', '.jpeg'].includes(ext)) return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

export function isAllowedAiChatFile(mime: string, originalname: string): boolean {
  const m = (mime || mimeFromName(originalname)).toLowerCase();
  if (IMAGE_MIMES.has(m)) return true;
  if (m === 'application/pdf') return true;
  if (m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return true;
  if (m === 'application/msword') return true;
  if (m === 'text/plain') return true;
  const ext = extOf(originalname);
  return DOC_EXTENSIONS.has(ext) || ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result?.text || '';
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractDocumentText(buffer: Buffer, mime: string, name: string): Promise<string> {
  const m = mime.toLowerCase();
  const ext = extOf(name);

  if (m === 'text/plain' || ext === '.txt') {
    return buffer.toString('utf8');
  }

  if (m === 'application/pdf' || ext === '.pdf') {
    return extractPdfText(buffer);
  }

  if (
    m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  if (m === 'application/msword' || ext === '.doc') {
    throw new Error(
      `Формат .doc («${name}») не поддерживается. Сохраните файл как .docx или PDF.`
    );
  }

  throw new Error(`Неподдерживаемый тип файла: ${name}`);
}

function truncateText(text: string): string {
  const t = text.replace(/\r\n/g, '\n').trim();
  if (t.length <= AI_CHAT_MAX_EXTRACTED_TEXT_CHARS) return t;
  return `${t.slice(0, AI_CHAT_MAX_EXTRACTED_TEXT_CHARS)}\n...[текст обрезан]`;
}

function bufferToDataUrl(buffer: Buffer, mime: string): string {
  const base64 = buffer.toString('base64');
  return `data:${mime};base64,${base64}`;
}

export function hasImageAttachments(attachments: StoredAiChatAttachment[]): boolean {
  return attachments.some((a) => a.kind === 'image' && a.imageDataUrl);
}

export function modelSupportsVision(model: string): boolean {
  const m = model.toLowerCase();
  return /gpt-4o|gpt-4\.1|gpt-5|o1|o3|o4|claude-3|claude-sonnet|claude-opus|claude-haiku-4|gemini|llava|pixtral|vision|qwen-vl|qwen2-vl|qwen3-vl|deepseek.*vl|llama.*vision/i.test(
    m
  );
}

/** Для запросов с картинками — vision-модель из whitelist, иначе базовая (если она vision). */
export function resolveChatModelForAttachments(
  baseModel: string,
  attachments: StoredAiChatAttachment[],
  allowedModels: Set<string>
): { model: string; usedVisionModel: boolean } {
  if (!hasImageAttachments(attachments)) {
    return { model: baseModel, usedVisionModel: false };
  }
  if (modelSupportsVision(baseModel) && allowedModels.has(baseModel)) {
    return { model: baseModel, usedVisionModel: true };
  }
  for (const candidate of VISION_MODEL_CANDIDATES) {
    const c = candidate.trim();
    if (c && allowedModels.has(c) && modelSupportsVision(c)) {
      return { model: c, usedVisionModel: true };
    }
  }
  return { model: baseModel, usedVisionModel: false };
}

export function appendVisionSystemHint(systemPrompt: string, attachments: StoredAiChatAttachment[]): string {
  if (!hasImageAttachments(attachments)) return systemPrompt;
  return (
    systemPrompt +
    '\n\nК сообщению прикреплено изображение (или несколько). Ты получаешь их визуально — опиши и проанализируй то, что видишь на фото, в том числе в юнгианском ключе, если уместно. Не проси пользователя пересказывать картинку текстом.'
  );
}

export type ParsedAiChatAttachmentMeta = {
  id: string;
  name: string;
  kind: AiChatAttachmentKind;
  mimeType: string;
  sizeBytes: number;
  textPreview?: string;
};

export async function storeAiChatFileUpload(
  userId: string,
  file: Express.Multer.File
): Promise<ParsedAiChatAttachmentMeta> {
  pruneExpired();
  if (!file?.buffer?.length) {
    throw new Error('Пустой файл');
  }
  if (file.size > AI_CHAT_MAX_FILE_BYTES) {
    throw new Error(`Файл «${file.originalname}» слишком большой (макс. ${AI_CHAT_MAX_FILE_BYTES / 1024 / 1024} МБ)`);
  }

  const mime = (file.mimetype || mimeFromName(file.originalname)).toLowerCase();
  const name = file.originalname || 'file';

  if (!isAllowedAiChatFile(mime, name)) {
    throw new Error(
      `Файл «${name}» не поддерживается. Разрешены: PDF, DOCX, TXT, JPG, PNG, WEBP, GIF.`
    );
  }

  const id = newAttachmentId();
  const isImage = IMAGE_MIMES.has(mime) || ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extOf(name));

  if (isImage) {
    if (file.size > AI_CHAT_MAX_IMAGE_BYTES) {
      throw new Error(`Изображение «${name}» слишком большое (макс. ${AI_CHAT_MAX_IMAGE_BYTES / 1024 / 1024} МБ)`);
    }
    const imageMime = IMAGE_MIMES.has(mime) ? mime : mimeFromName(name);
    store.set(id, {
      userId,
      name,
      mimeType: imageMime,
      kind: 'image',
      imageDataUrl: bufferToDataUrl(file.buffer, imageMime),
      createdAt: Date.now(),
    });
    return { id, name, kind: 'image', mimeType: imageMime, sizeBytes: file.size };
  }

  let text: string;
  try {
    text = truncateText(await extractDocumentText(file.buffer, mime, name));
  } catch (e: any) {
    throw new Error(e?.message || `Не удалось прочитать «${name}»`);
  }

  if (!text.trim()) {
    throw new Error(`В файле «${name}» не найден текст для анализа.`);
  }

  store.set(id, {
    userId,
    name,
    mimeType: mime,
    kind: 'document',
    text,
    createdAt: Date.now(),
  });

  const preview = text.length > 200 ? `${text.slice(0, 200)}…` : text;
  return {
    id,
    name,
    kind: 'document',
    mimeType: mime,
    sizeBytes: file.size,
    textPreview: preview,
  };
}

export function resolveAiChatAttachments(
  userId: string,
  idsRaw: unknown
): StoredAiChatAttachment[] {
  pruneExpired();
  const ids = Array.isArray(idsRaw)
    ? idsRaw.map((x) => String(x).trim()).filter(Boolean).slice(0, AI_CHAT_MAX_FILES)
    : [];
  const out: StoredAiChatAttachment[] = [];
  for (const id of ids) {
    const item = store.get(id);
    if (!item || item.userId !== userId) continue;
    out.push(item);
    store.delete(id);
  }
  return out;
}

export function formatUserMessageForHistory(
  message: string,
  attachments: StoredAiChatAttachment[]
): string {
  if (!attachments.length) return message;
  const lines = attachments.map((a) =>
    a.kind === 'image' ? `📎 ${a.name} (изображение)` : `📎 ${a.name}`
  );
  return `${message}\n\n${lines.join('\n')}`;
}

export function buildAttachmentContextBlock(attachments: StoredAiChatAttachment[]): string {
  const docs = attachments.filter((a) => a.kind === 'document' && a.text);
  if (!docs.length) return '';
  const blocks = docs.map(
    (a, i) =>
      `### Файл ${i + 1}: ${a.name}\n${a.text}`
  );
  return `\n\n--- Прикреплённые файлы (${docs.length}) ---\n${blocks.join('\n\n')}`;
}

export type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export function buildOpenRouterUserContent(
  text: string,
  attachments: StoredAiChatAttachment[],
  model: string
): string | OpenRouterContentPart[] {
  const docBlock = buildAttachmentContextBlock(attachments);
  let fullText = text + docBlock;
  const images = attachments.filter((a) => a.kind === 'image' && a.imageDataUrl);

  if (images.length && modelSupportsVision(model)) {
    const parts: OpenRouterContentPart[] = [{ type: 'text', text: fullText }];
    for (const img of images) {
      parts.push({ type: 'image_url', image_url: { url: img.imageDataUrl! } });
    }
    return parts;
  }

  if (images.length) {
    fullText +=
      `\n\n[Прикреплены изображения: ${images.map((i) => i.name).join(', ')}. ` +
      'Текущая модель не поддерживает анализ картинок. В админке укажите vision-модель (например openai/gpt-4o-mini) или добавьте AI_VISION_MODEL в .env.]';
  }

  return fullText;
}

export function openRouterContentToString(content: string | OpenRouterContentPart[]): string {
  if (typeof content === 'string') return content;
  return content
    .map((p) => (p.type === 'text' ? p.text : '[изображение]'))
    .join('\n');
}

export function messagesIncludeImages(messages: Array<{ content: string | OpenRouterContentPart[] }>): boolean {
  return messages.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some((p) => p.type === 'image_url')
  );
}
