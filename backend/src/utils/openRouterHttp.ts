import OpenAI from 'openai';
import { fetch as undiciFetch, ProxyAgent, type RequestInit as UndiciRequestInit } from 'undici';
import { config } from '../config';

export const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

export function getOpenRouterApiKey(): string {
  const apiKey = config.openRouterApiKey || config.hfToken;
  if (!apiKey) {
    throw new Error('OpenRouter API не настроен. Установите OPENROUTER_API_KEY.');
  }
  return apiKey;
}

export function getOpenRouterApiKeyOrNull(): string | null {
  const key = config.openRouterApiKey || config.hfToken;
  return key || null;
}

export function openRouterDefaultHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...extra,
    ...(config.openRouterSiteUrl ? { 'HTTP-Referer': config.openRouterSiteUrl } : {}),
    ...(config.openRouterSiteName ? { 'X-OpenRouter-Title': config.openRouterSiteName } : {}),
  };
}

export function openRouterAuthHeaders(apiKey: string, extra: Record<string, string> = {}): Record<string, string> {
  return openRouterDefaultHeaders({
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    ...extra,
  });
}

function resolveProxyUrl(): string {
  return (config.openRouterProxyUrl || '').trim();
}

let proxyAgent: ProxyAgent | null = null;

function getProxyAgent(): ProxyAgent | null {
  const proxy = resolveProxyUrl();
  if (!proxy) return null;
  if (!proxyAgent) {
    proxyAgent = new ProxyAgent(proxy);
  }
  return proxyAgent;
}

function proxiedFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const agent = getProxyAgent();
  if (!agent) {
    return fetch(input, init);
  }
  const url = typeof input === 'string' ? input : input.toString();
  return undiciFetch(url, {
    ...(init as UndiciRequestInit),
    dispatcher: agent,
  }) as unknown as Promise<Response>;
}

export function createOpenRouterClient(apiKey?: string): OpenAI {
  const key = apiKey ?? getOpenRouterApiKey();
  const opts: ConstructorParameters<typeof OpenAI>[0] = {
    baseURL: OPENROUTER_API_BASE,
    apiKey: key,
    defaultHeaders: openRouterDefaultHeaders(),
  };
  if (getProxyAgent()) {
    opts.fetch = proxiedFetch as typeof fetch;
  }
  return new OpenAI(opts);
}

export function openRouterFetch(pathOrUrl: string, init?: RequestInit): Promise<Response> {
  const url = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `${OPENROUTER_API_BASE}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
  return proxiedFetch(url, init);
}

export function isOpenRouterProxyEnabled(): boolean {
  return Boolean(resolveProxyUrl());
}
