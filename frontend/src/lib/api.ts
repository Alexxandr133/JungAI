export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function api<T = unknown>(path: string, options: { method?: HttpMethod; token?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const env = (import.meta as any).env || {};
  let baseOrigin: string = env.VITE_API_ORIGIN || '';
  if (!baseOrigin && env.DEV && typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '4000') {
    // In dev, if no explicit API origin is set, default to backend on :4000
    baseOrigin = 'http://localhost:4000';
  }
  const url = `${baseOrigin}${path.startsWith('/') ? path : `/${path}`}`;
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = options.headers || {};
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let body: BodyInit | null | undefined = null;
  if (options.body) {
    if (isFormData) {
      body = options.body as BodyInit;
    } else {
      body = JSON.stringify(options.body) as BodyInit;
    }
  }
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: body || undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let errorMessage = text || `Request failed: ${res.status}`;
    
    // Пытаемся извлечь сообщение из JSON ответа
    try {
      const errorJson = JSON.parse(text);
      if (errorJson.error) {
        errorMessage = errorJson.error;
      }
      if (errorJson.message) {
        errorMessage = errorJson.message;
      }
      // Проверяем на ошибку верификации
      if (res.status === 403 && (errorJson.error === 'Verification required' || errorMessage.includes('верификацию'))) {
        errorMessage = 'Verification required';
      }
      // Проверяем на rate limit (429 Too Many Requests)
      if (res.status === 429 || errorMessage.toLowerCase().includes('too many') || errorMessage.toLowerCase().includes('слишком много')) {
        errorMessage = 'Слишком много запросов, попробуйте позже';
      }
    } catch {
      // Если не JSON, используем текст как есть
    }
    
    const error = new Error(errorMessage);
    (error as any).status = res.status;
    throw error;
  }
  // Handle empty/204 responses safely
  if (res.status === 204) return undefined as unknown as T;
  const contentType = res.headers.get('content-type') || '';
  const bodyText = await res.text().catch(() => '');
  if (!bodyText) return undefined as unknown as T;
  if (contentType.includes('application/json')) {
    return JSON.parse(bodyText) as T;
  }
  // Fallback: return raw text when not JSON
  return bodyText as unknown as T;
}
