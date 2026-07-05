/** Безопасная загрузка текста веб-страницы для анализа источников */

const MAX_BYTES = 512_000;
const TIMEOUT_MS = 15_000;
const MAX_TEXT_CHARS = 24_000;

const BLOCKED_HOST_RE =
  /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|::1)(:\d+)?$/i;

function isPrivateIp(host: string): boolean {
  const h = host.toLowerCase();
  if (BLOCKED_HOST_RE.test(h)) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [, a, b] = m.map(Number);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function validatePublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('Некорректный URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Поддерживаются только http и https ссылки');
  }
  if (isPrivateIp(url.hostname)) {
    throw new Error('Этот адрес недоступен для загрузки');
  }
  return url;
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function htmlToPlainText(html: string): string {
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  t = decodeBasicEntities(t);
  return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return undefined;
  return decodeBasicEntities(m[1].replace(/<[^>]+>/g, '').trim()).slice(0, 300) || undefined;
}

export type FetchedUrlContent = {
  url: string;
  title?: string;
  text: string;
  truncated: boolean;
};

export async function fetchUrlText(rawUrl: string): Promise<FetchedUrlContent> {
  const url = validatePublicHttpUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'JungAI-ResearchBot/1.0 (+research source preview)',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      throw new Error(`Страница вернула код ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      throw new Error('Страница слишком большая для анализа');
    }

    const html = buf.toString('utf-8');
    let text: string;
    if (contentType.includes('text/html') || html.includes('<html')) {
      text = htmlToPlainText(html);
    } else {
      text = decodeBasicEntities(html.trim());
    }

    const truncated = text.length > MAX_TEXT_CHARS;
    if (truncated) text = text.slice(0, MAX_TEXT_CHARS);

    return {
      url: url.toString(),
      title: extractTitle(html),
      text,
      truncated,
    };
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Превышено время ожидания загрузки страницы');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
