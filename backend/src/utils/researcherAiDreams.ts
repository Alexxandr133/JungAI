import { anonymizeDreamRecord } from './anonymizeText';

export type DreamsContextRange = '30d' | '90d' | '365d' | 'all';

export type DreamSamplingMode =
  | 'recent'
  | 'all_in_range'
  | 'by_participant'
  | 'by_symbol'
  | 'random'
  | 'stratified';

export const MAX_RESEARCHER_POOL_BY_RANGE: Record<DreamsContextRange, number> = {
  '30d': 200,
  '90d': 350,
  '365d': 500,
  all: 800,
};

export const RESEARCHER_DREAM_CONTENT_MAX = 1200;

type DreamRow = {
  id: string;
  title: string | null;
  content: string | null;
  symbols: unknown;
  symbolsStatus?: string | null;
  createdAt: Date;
  clientId: string | null;
  client?: { id?: string; name?: string | null } | null;
};

export function parseDreamsContextRange(raw: unknown): DreamsContextRange {
  const s = String(raw ?? '30d');
  if (s === '30d' || s === '90d' || s === '365d' || s === 'all') return s;
  return '30d';
}

export function parseDreamSamplingMode(raw: unknown): DreamSamplingMode {
  const s = String(raw ?? 'recent');
  const allowed: DreamSamplingMode[] = [
    'recent',
    'all_in_range',
    'by_participant',
    'by_symbol',
    'random',
    'stratified',
  ];
  return allowed.includes(s as DreamSamplingMode) ? (s as DreamSamplingMode) : 'recent';
}

export function parseDreamSampleSize(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return 50;
  return Math.min(200, Math.max(5, Math.round(n)));
}

export function minDateForDreamRange(range: DreamsContextRange): Date | null {
  if (range === 'all') return null;
  const days = range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

export function dreamRangeLabelRu(range: DreamsContextRange): string {
  switch (range) {
    case '30d':
      return 'последние 30 дней';
    case '90d':
      return 'последние 90 дней';
    case '365d':
      return 'последний год';
    default:
      return 'всё время';
  }
}

export function dreamSamplingLabelRu(mode: DreamSamplingMode): string {
  switch (mode) {
    case 'recent':
      return 'последние по дате';
    case 'all_in_range':
      return 'все в периоде (до лимита)';
    case 'by_participant':
      return 'один участник';
    case 'by_symbol':
      return 'по символу';
    case 'random':
      return 'случайная выборка';
    case 'stratified':
      return 'равномерно по участникам';
    default:
      return mode;
  }
}

function formatDreamSymbols(symbols: unknown): string {
  if (symbols == null) return '';
  if (Array.isArray(symbols)) return symbols.map(String).filter(Boolean).join(', ');
  if (typeof symbols === 'object') return Object.keys(symbols as object).join(', ');
  return '';
}

function dreamHasSymbol(symbols: unknown, filter: string): boolean {
  const q = filter.trim().toLowerCase();
  if (!q) return true;
  const list = Array.isArray(symbols)
    ? symbols.map(String)
    : typeof symbols === 'object' && symbols !== null
      ? Object.keys(symbols as object)
      : [];
  return list.some((s) => s.toLowerCase().includes(q));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function sampleResearcherDreams(
  rows: DreamRow[],
  mode: DreamSamplingMode,
  sampleSize: number,
  opts: { participantClientId?: string; symbolFilter?: string } = {}
): DreamRow[] {
  let pool = [...rows];

  if (mode === 'by_participant' && opts.participantClientId) {
    pool = pool.filter((d) => d.clientId === opts.participantClientId);
  }

  if (mode === 'by_symbol' && opts.symbolFilter?.trim()) {
    pool = pool.filter((d) => dreamHasSymbol(d.symbols, opts.symbolFilter!));
  }

  pool.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (mode === 'stratified') {
    const byClient = new Map<string, DreamRow[]>();
    for (const d of pool) {
      const key = d.clientId || '__anonymous__';
      if (!byClient.has(key)) byClient.set(key, []);
      byClient.get(key)!.push(d);
    }
    const groups = [...byClient.values()];
    if (groups.length === 0) return [];
    const perGroup = Math.max(1, Math.ceil(sampleSize / groups.length));
    const out: DreamRow[] = [];
    for (const g of groups) {
      out.push(...g.slice(0, perGroup));
    }
    return out.slice(0, sampleSize);
  }

  if (mode === 'random') {
    return shuffle(pool).slice(0, sampleSize);
  }

  if (mode === 'all_in_range') {
    return pool.slice(0, sampleSize);
  }

  return pool.slice(0, sampleSize);
}

export type ResearcherDreamContextMeta = {
  range: DreamsContextRange;
  samplingMode: DreamSamplingMode;
  sampleSize: number;
  poolCount: number;
  selectedCount: number;
  participantClientId?: string;
  symbolFilter?: string;
};

export function buildResearcherDreamsContext(
  rows: DreamRow[],
  meta: ResearcherDreamContextMeta
): string {
  if (rows.length === 0) {
    return '\n\nВ выборке снов для этого запроса записей нет. Сообщи исследователю и предложи изменить период, режим выборки или фильтры.';
  }

  const anonymized = rows.map(anonymizeDreamRecord);
  const rangeLabel = dreamRangeLabelRu(meta.range);
  const modeLabel = dreamSamplingLabelRu(meta.samplingMode);

  let header = `\n\n=== Сны (обезличенные) ===`;
  header += `\nПериод: ${rangeLabel}. Режим выборки: ${modeLabel}.`;
  header += `\nВ пуле: ${meta.poolCount} записей; в контекст: ${meta.selectedCount}.`;
  if (meta.participantClientId) {
    header += `\nФильтр участника: ${meta.participantClientId.slice(-6).toUpperCase()}.`;
  }
  if (meta.symbolFilter?.trim()) {
    header += `\nФильтр символа: «${meta.symbolFilter.trim()}».`;
  }
  header += `\nМаркеры [имя], [место] — результат обезличивания. Не запрашивай ПДн.\n`;

  const body = anonymized
    .map((dream, idx) => {
      const symbols = formatDreamSymbols(dream.symbols);
      const raw = dream.content || '';
      const snippet =
        raw.length > RESEARCHER_DREAM_CONTENT_MAX
          ? `${raw.slice(0, RESEARCHER_DREAM_CONTENT_MAX)}…`
          : raw;
      let block = `${idx + 1}. «${dream.title || 'Без названия'}» (${dream.participantLabel || 'аноним'}, ${new Date(dream.createdAt).toLocaleDateString('ru-RU')})\n`;
      block += `   ${snippet || '(нет текста)'}\n`;
      if (symbols) block += `   Символы: ${symbols}\n`;
      return block;
    })
    .join('\n');

  return `${header}\n${body}`;
}

export function estimateDreamContextChars(rows: DreamRow[]): number {
  return rows.reduce((acc, d) => {
    const title = String(d.title || '');
    const content = String(d.content || '').slice(0, RESEARCHER_DREAM_CONTENT_MAX);
    const symbols = formatDreamSymbols(d.symbols);
    return acc + title.length + content.length + symbols.length + 180;
  }, 0);
}

export function listParticipantStats(rows: DreamRow[]): Array<{ clientId: string; label: string; count: number }> {
  const map = new Map<string, number>();
  for (const d of rows) {
    if (!d.clientId) continue;
    map.set(d.clientId, (map.get(d.clientId) || 0) + 1);
  }
  return [...map.entries()]
    .map(([clientId, count]) => ({
      clientId,
      label: `Участник #${clientId.slice(-6).toUpperCase()}`,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}
