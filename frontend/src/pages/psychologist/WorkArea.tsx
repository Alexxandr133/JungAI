import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { useAppearance } from '../../context/AppearanceContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';
import { usePsychologistPlatformTour } from '../../hooks/usePsychologistPlatformTour';
import { PSYCHOLOGIST_WORK_AREA_TOUR_STEPS } from '../../lib/psychologistPlatformTourSteps';
import { PsychologistTourHelpButton } from '../../components/PsychologistTourHelpButton';
import { BookOpen, Brain, ChevronDown, Moon } from 'lucide-react';
import './WorkAreaEditor.css';

type Client = { 
  id: string; 
  name?: string; 
  email?: string;
  avatarUrl?: string | null;
  profile?: {
    avatarUrl?: string | null;
  } | null;
};

const DEFAULT_TABS = [
  'Ведение клиента',
  'запрос',
  'анамнез',
  'ценности/кредо',
  'раздражители',
  'сны',
  'Тесты',
  'записи',
  'Дневник клиента',
  'Синхронии'
];

const CARD_TABS = new Set(['Дневник клиента', 'сны', 'Тесты']);

function isCardTab(tab: string) {
  return CARD_TABS.has(tab);
}

type WorkAreaTestResult = {
  id: string;
  testType: string;
  result: any;
  createdAt: string;
};

function testTypeLabel(testType: string) {
  if (testType === 'association-session') return 'Ассоциативный тест';
  if (testType === 'pyramid-session') return 'Пирамида ассоциаций';
  return testType;
}

function testResultSummary(row: WorkAreaTestResult) {
  const result = row.result && typeof row.result === 'object' ? row.result : {};
  if (row.testType === 'association-session') {
    const report = result.report || {};
    const run1 = Number(report.run1 || 0);
    const avg = Number(report.avg || 0);
    const outliers = Number(report.outliers || 0);
    if (run1) {
      return `${run1} ответов · среднее ${(avg / 1000).toFixed(2)} с · задержек ${outliers}`;
    }
    const responses = Array.isArray(result.responses) ? result.responses.length : 0;
    return responses ? `${responses} ответов` : 'Результат сохранён';
  }
  if (row.testType === 'pyramid-session') {
    const key = result.levels?.[5]?.[0] || result.levels?.['5']?.[0];
    const query = typeof result.query === 'string' ? result.query.trim() : '';
    if (key && query) return `«${query}» → ${key}`;
    if (key) return `Ключевое слово: ${key}`;
    if (query) return query;
    return 'Результат сохранён';
  }
  return 'Результат сохранён';
}

type AssociationLogRow = {
  word_index?: number;
  word?: string;
  response_text?: string;
  reaction_time_ms?: number;
  run_number?: 1 | 2;
  therapist_flag?: string | null;
  is_reproduction_match?: boolean | null;
};

function associationLogRows(result: unknown): AssociationLogRow[] {
  const responses = result && typeof result === 'object' && Array.isArray((result as { responses?: unknown }).responses)
    ? ((result as { responses: AssociationLogRow[] }).responses)
    : [];
  return [...responses].sort((a, b) => {
    const run = (a.run_number || 1) - (b.run_number || 1);
    if (run) return run;
    return (a.word_index || 0) - (b.word_index || 0);
  });
}

function reactionLabel(row: AssociationLogRow) {
  if (row.run_number === 2) {
    if (row.is_reproduction_match === true) return 'совпало';
    if (row.is_reproduction_match === false) return 'другое';
    return '—';
  }
  const ms = Number(row.reaction_time_ms || 0);
  return `${(ms / 1000).toFixed(2)} с`;
}

const HIGHLIGHT_COLORS = [
  { id: 'peach', label: 'Персиковый', color: '#fde8d8' },
  { id: 'sage', label: 'Шалфей', color: '#e3f1ea' },
  { id: 'lavender', label: 'Лаванда', color: '#efebfc' },
  { id: 'yellow', label: 'Жёлтый', color: '#fef6d0' },
] as const;

/** Печать A4; экран — непрерывный лист (без DOM-пагинации). */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_MARGIN_MM = 18;

function formatSavedClock(d: Date): string {
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function countWordsAndChars(text: string): { words: number; chars: number } {
  const trimmed = text.replace(/\u00a0/g, ' ').trim();
  const chars = text.replace(/\u00a0/g, ' ').length;
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  return { words, chars };
}

/** Разово чистит старые экранные распорки из сохранённого HTML. */
function stripLegacyPageSpacers(root: ParentNode) {
  root.querySelectorAll('[data-wa-spacer]').forEach((n) => n.remove());
}

function getEditorHtml(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  stripLegacyPageSpacers(clone);
  return clone.innerHTML;
}

/** Оценка числа страниц при печати (@page A4, поля A4_MARGIN_MM) — без мутации DOM. */
let cachedPrintContentPx: number | null = null;

function printContentHeightPx(): number {
  if (cachedPrintContentPx) return cachedPrintContentPx;
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;height:${A4_HEIGHT_MM - A4_MARGIN_MM * 2}mm;pointer-events:none`;
  document.body.appendChild(probe);
  cachedPrintContentPx = probe.offsetHeight || ((A4_HEIGHT_MM - A4_MARGIN_MM * 2) * 96) / 25.4;
  document.body.removeChild(probe);
  return cachedPrintContentPx;
}

function estimatePrintPageCount(el: HTMLElement): number {
  const cs = window.getComputedStyle(el);
  const padTop = parseFloat(cs.paddingTop) || 0;
  const padBottom = parseFloat(cs.paddingBottom) || 0;
  const inkH = Math.max(0, el.scrollHeight - padTop - padBottom);
  const pageContentPx = printContentHeightPx();
  if (pageContentPx <= 0) return 1;
  return Math.max(1, Math.ceil(inkH / pageContentPx - 1e-9));
}

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function plainTextToBlockHtml(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => (line ? `<div>${escapeHtmlText(line)}</div>` : '<div><br></div>'))
    .join('');
}

function storageKey(clientId: string, tab: string) {
  return `workarea.content.${clientId}.${tab}`;
}

function tabsKey(clientId: string) {
  return `workarea.tabs.${clientId}`;
}

function sanitizePastedRichHtml(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.body.querySelectorAll('*').forEach((el) => {
      const node = el as HTMLElement;
      node.style.removeProperty('background');
      node.style.removeProperty('background-color');
      node.style.removeProperty('color');
      const style = node.getAttribute('style') || '';
      const cleaned = style
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((rule) => {
          const key = rule.split(':')[0]?.trim().toLowerCase();
          return key !== 'background' && key !== 'background-color' && key !== 'color';
        })
        .join('; ');
      if (cleaned) node.setAttribute('style', cleaned);
      else node.removeAttribute('style');
    });

    // «Простыня» с кучей <br> → отдельные строки
    const brCount = doc.body.querySelectorAll('br').length;
    const blockCount = doc.body.querySelectorAll('p, div, li, h1, h2, h3, h4, blockquote').length;
    if (brCount >= 3 && blockCount <= 2) {
      const lines = (doc.body.innerText || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n');
      return lines
        .map((line) => (line.trim() ? `<div>${escapeHtmlText(line)}</div>` : '<div><br></div>'))
        .join('');
    }

    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

type WorkAreaProps = {
  restrictedClientId?: string; // Если передан, показывать только этого клиента
  hideNavbar?: boolean; // Скрыть навбар (для использования внутри других компонентов)
  noPadding?: boolean; // Убрать padding (для использования внутри других компонентов)
};

export default function WorkArea({ restrictedClientId, hideNavbar = false, noPadding = false }: WorkAreaProps = {}) {
  const { token, user } = useAuth();
  const { t } = useI18n();
  const { appearance } = useAppearance();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientFromQuery = searchParams.get('client');
  const [showClientsDropdown, setShowClientsDropdown] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [currentClientId, setCurrentClientId] = useState<string | null>(() => clientFromQuery);
  const [activeTab, setActiveTab] = useState<string>('Ведение клиента');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState<boolean>(() => localStorage.getItem('workarea.expanded') === '1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [formatState, setFormatState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  });
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const [renamingTab, setRenamingTab] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const saveTimeoutRef = useRef<number | null>(null);
  const contentHydratedRef = useRef(false);
  const [journalEntries, setJournalEntries] = useState<Array<{ id: string; content: string; createdAt: string; updatedAt: string }>>([]);
  const [loadingJournal, setLoadingJournal] = useState(false);
  const [clientDreams, setClientDreams] = useState<Array<{ id: string; title: string; content: string; createdAt: string; symbols?: unknown }>>([]);
  const [loadingDreams, setLoadingDreams] = useState(false);
  const [clientTests, setClientTests] = useState<WorkAreaTestResult[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [expandedTestIds, setExpandedTestIds] = useState<string[]>([]);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showTabContent, setShowTabContent] = useState(false);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [tablePickerHover, setTablePickerHover] = useState<{ rows: number; cols: number } | null>(null);
  const tablePickerButtonRef = useRef<HTMLButtonElement | null>(null);
  const tablePickerPanelRef = useRef<HTMLDivElement | null>(null);
  const [tablePickerPos, setTablePickerPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [tableContextMenu, setTableContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
  }>({ open: false, x: 0, y: 0 });
  const tableContextMenuRef = useRef<HTMLDivElement | null>(null);
  const tableContextRef = useRef<{
    table: HTMLTableElement;
    rowIndex: number; // tbody row index
    colIndex: number;
  } | null>(null);
  const colResizeRef = useRef<{
    table: HTMLTableElement;
    colIndex: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const isLightTheme = appearance.colorMode === 'light';
  const ui = useMemo(() => {
    const border = isLightTheme ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.10)';
    const borderStrong = isLightTheme ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.14)';
    const panel = isLightTheme ? '#ffffff' : 'var(--surface)';
    const panel2 = isLightTheme ? '#f1f5f9' : 'var(--surface-2)';
    const hover = isLightTheme ? 'rgba(37,99,235,0.06)' : 'rgba(255,255,255,0.06)';
    const activeBg = isLightTheme ? 'rgba(37,99,235,0.12)' : 'rgba(91,124,250,0.18)';
    const activeBorder = isLightTheme ? 'rgba(37,99,235,0.35)' : 'rgba(91,124,250,0.35)';
    const activeText = isLightTheme ? '#0f172a' : '#ffffff';
    return { border, borderStrong, panel, panel2, hover, activeBg, activeBorder, activeText };
  }, [isLightTheme]);

  const currentClient = useMemo(() => clients.find(c => c.id === currentClientId) || null, [clients, currentClientId]);
  
  const getAvatarUrl = (url: string | null | undefined, clientId?: string) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const env = (import.meta as any).env || {};
    let baseOrigin: string = env.VITE_API_ORIGIN || env.VITE_API_URL || '';
    if (!baseOrigin && env.DEV && typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '4000') {
      baseOrigin = 'http://localhost:4000';
    }
    if (!baseOrigin && typeof window !== 'undefined') {
      baseOrigin = window.location.origin;
    }
    // Добавляем параметры для предотвращения кэширования и уникальности для каждого клиента
    const separator = url.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    params.set('t', Date.now().toString());
    return `${baseOrigin}${url}${separator}${params.toString()}`;
  };

  // Check verification status (с кэшированием)
  useEffect(() => {
    if (!token) {
      setIsVerified(null);
      setVerificationStatus(null);
      return;
    }
    
    checkVerification(token).then(result => {
      setIsVerified(result.isVerified);
      setVerificationStatus(result.status);
    });
  }, [token]);

  useEffect(() => {
    if (!tablePickerOpen) return;
    const updatePos = () => {
      const btn = tablePickerButtonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      setTablePickerPos({
        top: rect.bottom + 10,
        left: rect.left,
        width: Math.max(260, Math.min(320, rect.width + 140))
      });
    };
    updatePos();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (tablePickerButtonRef.current?.contains(target)) return;
      if (tablePickerPanelRef.current?.contains(target)) return;
      setTablePickerOpen(false);
      setTablePickerHover(null);
      setTablePickerPos(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTablePickerOpen(false);
        setTablePickerHover(null);
        setTablePickerPos(null);
      }
    };
    const onScrollOrResize = () => updatePos();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [tablePickerOpen]);

  // Detect mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);


  // Load clients
  useEffect(() => {
    // Не загружаем клиентов, если не верифицирован
    if (isVerified === false) return;
    
    (async () => {
      // Если ограниченный режим, загружаем только нужного клиента
      if (restrictedClientId) {
        if (!token) return;
        try {
        const res = await api<{ items: any[] }>('/api/clients', { token: token ?? undefined });
        const items = (res.items || []).map(it => ({ id: String(it.id), name: it.name, email: it.email })) as Client[];
        const restrictedClient = items.find(c => String(c.id) === String(restrictedClientId));
        if (restrictedClient) {
          setClients([restrictedClient]);
          setCurrentClientId(restrictedClientId);
        } else {
          // Если клиент не найден, пытаемся загрузить по ID напрямую
          try {
            const clientRes = await api<any>(`/api/clients/${restrictedClientId}`, { token });
            const client = { id: String(clientRes.id), name: clientRes.name, email: clientRes.email };
            setClients([client]);
            setCurrentClientId(restrictedClientId);
          } catch (error: any) {
            if (error.message?.includes('Verification required')) {
              setIsVerified(false);
            }
            setClients([]);
          }
        }
      } catch (error: any) {
        if (error.message?.includes('Verification required')) {
          setIsVerified(false);
        }
        setClients([]);
      }
        return;
      }

      // Обычный режим - загружаем всех клиентов
      if (!token) { 
        setClients([]); 
        return; 
      }
      try {
        const res = await api<{ items: any[] }>('/api/clients', { token: token ?? undefined });
        const items = (res.items || []).map(it => ({ 
          id: String(it.id), 
          name: it.name, 
          email: it.email,
          avatarUrl: it.avatarUrl || it.profile?.avatarUrl || null,
          profile: it.profile || null
        })) as any[];
        setClients(items);
        let resolvedQuery = clientFromQuery && items.some((c) => c.id === clientFromQuery)
          ? clientFromQuery
          : '';
        if (clientFromQuery && !resolvedQuery) {
          try {
            const one = await api<{ id: string }>(`/api/clients/${clientFromQuery}`, { token });
            if (one?.id) resolvedQuery = String(one.id);
          } catch {
            resolvedQuery = '';
          }
        }
        setCurrentClientId((prev) => {
          const next = resolvedQuery || (prev && items.some((c) => c.id === prev) ? prev : items[0]?.id || '');
          if (next && next !== prev) setExpanded(false);
          return next;
        });
      } catch (error: any) {
        console.error('[WorkArea] Failed to load clients:', error);
        if (error.message?.includes('Verification required')) {
          setIsVerified(false);
        }
        setClients([]); // КРИТИЧНО: при ошибке показываем пустой список, а не демо-клиентов
        setCurrentClientId('');
      }
    })();
  }, [token, restrictedClientId, isVerified, clientFromQuery]);

  useEffect(() => {
    if (!clientFromQuery) return;
    setCurrentClientId((prev) => {
      if (prev === clientFromQuery) return prev;
      setExpanded(false);
      return clientFromQuery;
    });
  }, [clientFromQuery]);

  const [tabsFromDB, setTabsFromDB] = useState<string[] | null>(null);

  // Функция для замены "паранормальное" на "Синхронии"
  const normalizeTabs = (tabsList: string[]): string[] => {
    const mapped = tabsList.map(tab => {
      // Заменяем различные варианты написания "паранормальное" на "Синхронии"
      if (tab.toLowerCase().includes('паранормальн') || tab === 'паранормальное' || tab === 'Паранормальное') {
        return 'Синхронии';
      }
      return tab;
    });
    if (!mapped.includes('Тесты')) {
      const dreamsIdx = mapped.indexOf('сны');
      if (dreamsIdx >= 0) mapped.splice(dreamsIdx + 1, 0, 'Тесты');
      else mapped.push('Тесты');
    }
    return mapped;
  };

  // Load tabs from API
  useEffect(() => {
    if (!currentClientId || !token) {
      setTabsFromDB(null);
      return;
    }
    
    const loadTabs = async () => {
      try {
        const res = await api<{ tabs: string[] }>(`/api/clients/${currentClientId}/tabs`, { token });
        if (res.tabs && Array.isArray(res.tabs) && res.tabs.length > 0) {
          // Нормализуем вкладки (заменяем "паранормальное" на "Синхронии")
          const normalized = normalizeTabs(res.tabs);
          setTabsFromDB(normalized);
          // Сохраняем нормализованные вкладки в localStorage для быстрого доступа
          try { localStorage.setItem(tabsKey(currentClientId), JSON.stringify(normalized)); } catch {}
          // Если были изменения, сохраняем обратно в БД
          if (normalized.some((tab, i) => tab !== res.tabs[i])) {
            try {
              await api(`/api/clients/${currentClientId}/tabs`, {
                method: 'POST',
                token,
                body: { tabs: normalized }
              });
            } catch (e) {
              console.warn('Failed to save normalized tabs to API:', e);
            }
          }
        } else {
          setTabsFromDB(null);
        }
      } catch (error) {
        // Если нет вкладок в БД, используем localStorage или дефолтные
        setTabsFromDB(null);
        console.warn('Failed to load tabs from API, using localStorage:', error);
      }
    };
    
    loadTabs();
  }, [currentClientId, token, isVerified]);

  // Tabs per client (defaults + custom stored)
  const tabs = useMemo(() => {
    if (!currentClientId) return DEFAULT_TABS;
    // Приоритет: данные из БД > localStorage > дефолтные
    if (tabsFromDB && tabsFromDB.length > 0) {
      // tabsFromDB уже нормализованы при загрузке
      return tabsFromDB;
    }
    try {
      const raw = localStorage.getItem(tabsKey(currentClientId));
      if (!raw) return DEFAULT_TABS;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_TABS;
      // Нормализуем вкладки из localStorage
      const normalized = normalizeTabs(parsed);
      // Если были изменения, сохраняем обратно в localStorage
      if (normalized.some((tab, i) => tab !== parsed[i])) {
        try { localStorage.setItem(tabsKey(currentClientId), JSON.stringify(normalized)); } catch {}
        // Сохраняем в БД асинхронно (не блокируем рендер)
        if (token && currentClientId) {
          setTimeout(() => {
            api(`/api/clients/${currentClientId}/tabs`, {
              method: 'POST',
              token,
              body: { tabs: normalized }
            }).catch(e => console.warn('Failed to save normalized tabs to API:', e));
          }, 0);
        }
      }
      return normalized;
    } catch { return DEFAULT_TABS; }
  }, [currentClientId, tabsFromDB, token]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Load journal entries when switching to "Дневник клиента" tab
  useEffect(() => {
    if (activeTab === 'Дневник клиента' && currentClientId && token && isVerified !== false) {
      loadJournalEntries();
    } else {
      setJournalEntries([]);
    }
  }, [activeTab, currentClientId, token, isVerified]);

  // Load dreams when switching to "сны" tab
  useEffect(() => {
    if (activeTab === 'сны' && currentClientId && token && isVerified !== false) {
      loadClientDreams();
    } else {
      setClientDreams([]);
    }
  }, [activeTab, currentClientId, token, isVerified]);

  useEffect(() => {
    if (activeTab === 'Тесты' && currentClientId && token && isVerified !== false) {
      loadClientTests();
    } else {
      setClientTests([]);
      setExpandedTestIds([]);
    }
  }, [activeTab, currentClientId, token, isVerified]);

  // Не допускаем «просачивания» текста редактора во вкладки с карточками
  useEffect(() => {
    if (isCardTab(activeTab)) {
      if (editorRef.current) editorRef.current.innerHTML = '';
      setLoading(false);
    }
  }, [activeTab]);

  async function loadJournalEntries() {
    if (!currentClientId || !token || isVerified === false) return;
    setLoadingJournal(true);
    try {
      const res = await api<{ items: Array<{ id: string; content: string; createdAt: string; updatedAt: string }> }>(
        `/api/clients/${currentClientId}/journal`,
        { token }
      );
      setJournalEntries(res.items || []);
    } catch (error: any) {
      if (error.message?.includes('Verification required') || error.status === 403) {
        setIsVerified(false);
      }
      console.error('Failed to load journal entries:', error);
      setJournalEntries([]);
    } finally {
      setLoadingJournal(false);
    }
  }

  async function loadClientDreams() {
    if (!currentClientId || !token || isVerified === false) return;
    setLoadingDreams(true);
    try {
      const res = await api<{ items: Array<{ id: string; title: string; content: string; createdAt: string; symbols?: unknown }> }>(
        `/api/dreams?clientId=${encodeURIComponent(currentClientId)}`,
        { token }
      );
      setClientDreams(res.items || []);
    } catch (error: any) {
      if (error.message?.includes('Verification required') || error.status === 403) {
        setIsVerified(false);
      }
      console.error('Failed to load client dreams:', error);
      setClientDreams([]);
    } finally {
      setLoadingDreams(false);
    }
  }

  async function loadClientTests() {
    if (!currentClientId || !token || isVerified === false) return;
    setLoadingTests(true);
    try {
      const res = await api<{ items: WorkAreaTestResult[] }>(
        `/api/tests/results/${encodeURIComponent(currentClientId)}`,
        { token }
      );
      setClientTests(res.items || []);
    } catch (error: any) {
      if (error.message?.includes('Verification required') || error.status === 403) {
        setIsVerified(false);
      }
      console.error('Failed to load client tests:', error);
      setClientTests([]);
    } finally {
      setLoadingTests(false);
    }
  }

  function normalizeDreamSymbols(symbols: unknown): string[] {
    if (!symbols) return [];
    if (Array.isArray(symbols)) return symbols.map(String).filter(Boolean);
    if (typeof symbols === 'object') return Object.keys(symbols as object);
    return [];
  }

  // Load content when switching client/tab
  useEffect(() => {
    // Не загружаем контент, если не верифицирован
    if (isVerified === false) return;
    
    // Отменяем предыдущее сохранение при смене клиента/вкладки
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    // Пропускаем загрузку для вкладок без текстового редактора
    if (isCardTab(activeTab)) return;
    
    if (!currentClientId || !editorRef.current || !token) return;
    
    const loadContent = async () => {
      contentHydratedRef.current = false;
      setLoading(true);
      try {
        // Сначала пытаемся загрузить из API
        try {
          const doc = await api<{ content: string }>(`/api/clients/${currentClientId}/documents/${encodeURIComponent(activeTab)}`, { token });
          if (doc && typeof doc.content === 'string') {
            editorRef.current!.innerHTML = doc.content;
            const key = storageKey(currentClientId, activeTab);
            try { localStorage.setItem(key, doc.content); } catch {}
            setLastSavedAt(new Date());
            return;
          }
        } catch (apiError: any) {
          // Если требуется верификация
          if (apiError.message?.includes('Verification required') || apiError.status === 403) {
            setIsVerified(false);
            return;
          }
          // Если документ не найден (404), это нормально - значит его еще нет
          if (apiError.message?.includes('404') || apiError.message?.includes('not found')) {
            editorRef.current!.innerHTML = '';
            return;
          }
          // Для других ошибок пробуем загрузить из localStorage как fallback
          console.warn('Failed to load from API, trying localStorage:', apiError);
        }
        
        // Fallback: загружаем из localStorage
        const key = storageKey(currentClientId, activeTab);
        const html = localStorage.getItem(key) || '';
        editorRef.current!.innerHTML = html;
      } catch (error) {
        console.error('Error loading content:', error);
        editorRef.current!.innerHTML = '';
      } finally {
        contentHydratedRef.current = true;
        setLoading(false);
        window.setTimeout(() => {
          const ed = editorRef.current;
          if (!ed) return;
          stripLegacyPageSpacers(ed);
          const text = ed.innerText || '';
          const { words, chars } = countWordsAndChars(text);
          setWordCount(words);
          setCharCount(chars);
          setPageCount(estimatePrintPageCount(ed));
          const html = getEditorHtml(ed).replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, '').trim();
          setEditorEmpty(!text.trim() && (html === '' || html === '<div></div>' || html === '<p></p>'));
        }, 0);
      }
    };
    
    loadContent();
  }, [currentClientId, activeTab, token, isVerified]);

  async function saveToAPI(immediate = false) {
    if (!contentHydratedRef.current) return;
    if (isCardTab(activeTab)) return;
    if (!currentClientId || !editorRef.current || !token || isVerified === false) return;
    
    // Отменяем предыдущий таймер сохранения
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const save = async () => {
      setSaving(true);
      try {
        await api(`/api/clients/${currentClientId}/documents`, {
          method: 'POST',
          token,
          body: {
            tabName: activeTab,
            content: getEditorHtml(editorRef.current!)
          }
        });
        setLastSavedAt(new Date());
      } catch (error: any) {
        if (error.message?.includes('Verification required') || error.status === 403) {
          setIsVerified(false);
        }
        console.error('Error saving to API:', error);
        // Ошибка сохранения не критична - данные уже в localStorage
      } finally {
        setSaving(false);
      }
    };

    if (immediate) {
      await save();
    } else {
      // Сохраняем в API с debounce (через 1 секунду после последнего изменения)
      saveTimeoutRef.current = window.setTimeout(save, 1000);
    }
  }

  function persistContent() {
    if (!contentHydratedRef.current) return;
    if (isCardTab(activeTab)) return;
    if (!currentClientId || !editorRef.current) return;

    // Сохраняем в localStorage сразу (для быстрого доступа)
    const key = storageKey(currentClientId, activeTab);
    const content = getEditorHtml(editorRef.current);
    try { localStorage.setItem(key, content); } catch {}
    refreshEditorStats();

    // Сохраняем в API с debounce (если есть токен)
    if (token) {
      saveToAPI(false);
    }
  }

  function refreshEditorStats() {
    const el = editorRef.current;
    if (!el) return;
    stripLegacyPageSpacers(el);
    const text = el.innerText || '';
    const { words, chars } = countWordsAndChars(text);
    setWordCount(words);
    setCharCount(chars);
    const html = getEditorHtml(el).replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, '').trim();
    setEditorEmpty(!text.trim() && (html === '' || html === '<div></div>' || html === '<p></p>'));
    setPageCount(estimatePrintPageCount(el));
  }

  function printWorkAreaDocument() {
    const el = editorRef.current;
    if (!el) return;
    const title = `${currentClient?.name || 'Клиент'} — ${activeTab}`;
    const bodyHtml = getEditorHtml(el) || '<p></p>';

    let iframe = document.getElementById('wa-print-frame') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'wa-print-frame';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.setAttribute('title', 'Печать');
      document.body.appendChild(iframe);
    }
    // Реальная ширина A4 — иначе вёрстка с width:0 даёт «полстраницы» при печати
    iframe.style.cssText = [
      'position:fixed',
      'left:-10000px',
      'top:0',
      'width:210mm',
      'min-height:297mm',
      'border:0',
      'opacity:0',
      'pointer-events:none',
      'z-index:-1',
    ].join(';');

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    const win = iframe.contentWindow;
    if (!doc || !win) return;

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>
  <style>
    @page { size: A4 portrait; margin: ${A4_MARGIN_MM}mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #fff !important;
      color: #211e2b;
      font-family: 'Golos Text', system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: 15px;
      line-height: 1.7;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-body {
      width: 100%;
      max-width: 100%;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    h1, h2, h3 { font-family: Lora, Georgia, 'Times New Roman', serif; line-height: 1.25; margin: 0.6em 0 0.35em; }
    h2 { font-size: 1.35em; }
    h3 { font-size: 1.15em; }
    p { margin: 0 0 0.65em; }
    blockquote {
      margin: 12px 0;
      padding: 8px 14px;
      border-left: 3px solid #6c5bd4;
      background: #efebfc;
    }
    table { width: 100%; max-width: 100%; table-layout: fixed; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
    th, td { border: 1px solid #94a3b8; padding: 6px 8px; vertical-align: top; word-wrap: break-word; overflow-wrap: anywhere; }
    ul[data-wa-checklist] { list-style: none; padding-left: 0; }
    ul[data-wa-checklist] li { padding-left: 1.6em; position: relative; margin: 6px 0; }
    ul[data-wa-checklist] li::before { content: '☐'; position: absolute; left: 0; }
    img { max-width: 100%; }
    a { color: #5546b8; }
  </style>
</head>
<body>
  <div class="print-body">${bodyHtml}</div>
</body>
</html>`);
    doc.close();

    const runPrint = () => {
      try {
        win.focus();
        win.print();
      } catch {
        /* ignore */
      }
    };

    window.setTimeout(runPrint, 300);
  }

  function syncFormatState() {
    try {
      setFormatState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      });
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const onSel = () => syncFormatState();
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  // Toolbar actions (simple MVP using execCommand)
  function exec(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    persistContent();
    syncFormatState();
  }

  function execBlock(tag: 'P' | 'H2' | 'H3' | 'BLOCKQUOTE') {
    document.execCommand('formatBlock', false, tag);
    persistContent();
    syncFormatState();
  }

  function insertLink() {
    const url = prompt('Вставить ссылку (URL):');
    if (!url) return;
    document.execCommand('createLink', false, url);
    persistContent();
  }

  function removeLink() {
    document.execCommand('unlink', false);
    persistContent();
  }

  function applyHighlight(color: string, id: string) {
    document.execCommand('hiliteColor', false, color);
    setActiveHighlight(id);
    persistContent();
  }

  function insertChecklist() {
    const html =
      '<ul data-wa-checklist="1"><li>Пункт 1</li><li>Пункт 2</li><li>Пункт 3</li></ul><p><br/></p>';
    document.execCommand('insertHTML', false, html);
    persistContent();
  }

  function clearFormatting() {
    document.execCommand('removeFormat', false);
    document.execCommand('unlink', false);
    setActiveHighlight(null);
    persistContent();
    syncFormatState();
  }

  function openAiForClient() {
    if (!currentClientId) return;
    const tabsParam = encodeURIComponent(tabs.join('|'));
    navigate(
      `/psychologist/ai?client=${encodeURIComponent(currentClientId)}&clientMode=1&tabs=${tabsParam}&from=workarea`
    );
  }

  function handleEditorPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    const strippedHtml = html
      ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';
    const plain = (text || '').trim();
    // Если в HTML попал весь пузырь, а в plain — выделенный фрагмент, вставляем фрагмент.
    const htmlIsWholeMessage = Boolean(
      html &&
      plain &&
      (strippedHtml.length > plain.length * 1.5 ||
        (/ai-chat-bubble|ai-md/i.test(html) && strippedHtml.length > plain.length))
    );
    if (html && !htmlIsWholeMessage) {
      document.execCommand('insertHTML', false, sanitizePastedRichHtml(html));
    } else {
      document.execCommand('insertHTML', false, plainTextToBlockHtml(text || ''));
    }
    persistContent();
  }

  function insertTable(rowsRaw: number, colsRaw: number) {
    const rows = Math.max(2, Math.min(12, Number(rowsRaw || 4) || 4));
    const cols = Math.max(2, Math.min(10, Number(colsRaw || 4) || 4));
    const colgroup = `<colgroup>${Array.from({ length: cols }).map(() => `<col style="width:${Math.round(100 / cols)}%"/>`).join('')}</colgroup>`;
    const theadCells = Array.from({ length: cols })
      .map((_, i) => `<th style="position:relative">Столбец ${i + 1}<span class="wa-col-resizer" contenteditable="false" data-col="${i}"></span></th>`)
      .join('');
    const bodyRows = Array.from({ length: rows - 1 })
      .map(() => `<tr>${Array.from({ length: cols }).map(() => `<td>&nbsp;</td>`).join('')}</tr>`)
      .join('');
    const id = `wa-table-${Math.random().toString(36).slice(2, 9)}`;
    const html = `<div class="wa-table-wrap" data-wa-table-id="${id}"><table>${colgroup}<thead><tr>${theadCells}</tr></thead><tbody>${bodyRows}</tbody></table></div><p data-wa-after-table="${id}"><br/></p>`;
    document.execCommand('insertHTML', false, html);
    persistContent();
    window.setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const p = editor.querySelector(`[data-wa-after-table="${id}"]`) as HTMLElement | null;
      if (!p) return;
      const range = document.createRange();
      range.selectNodeContents(p);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }, 0);
  }

  function getClosestTableFromSelection(): HTMLTableElement | null {
    const sel = window.getSelection();
    const node = sel?.anchorNode || null;
    const el = (node && (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement)) || null;
    if (!el) return null;
    return (el.closest('.wa-table-wrap table') as HTMLTableElement | null) || null;
  }

  function deleteCurrentTable() {
    const table = getClosestTableFromSelection();
    if (!table) return;
    const wrap = table.closest('.wa-table-wrap') as HTMLElement | null;
    if (wrap) wrap.remove();
    else table.remove();
    persistContent();
  }

  function renumberColResizers(table: HTMLTableElement) {
    const ths = Array.from(table.querySelectorAll('thead th')) as HTMLTableCellElement[];
    ths.forEach((th, i) => {
      let resizer = th.querySelector('.wa-col-resizer') as HTMLElement | null;
      if (!resizer) {
        resizer = document.createElement('span');
        resizer.className = 'wa-col-resizer';
        resizer.setAttribute('contenteditable', 'false');
        th.appendChild(resizer);
      }
      resizer.setAttribute('data-col', String(i));
    });
  }

  function ensureColgroup(table: HTMLTableElement, cols: number) {
    let cg = table.querySelector('colgroup') as HTMLTableColElement | null;
    if (!cg) {
      cg = document.createElement('colgroup') as any;
      // table.firstChild может быть null
      table.insertBefore(cg as unknown as Node, table.firstChild);
    }
    if (!cg) return null;
    const existing = cg.querySelectorAll('col').length;
    for (let i = existing; i < cols; i++) {
      const col = document.createElement('col');
      col.style.width = `${Math.round(100 / Math.max(cols, 1))}%`;
      cg.appendChild(col);
    }
    while (cg.querySelectorAll('col').length > cols) {
      cg.lastElementChild?.remove();
    }
    return cg;
  }

  function addRowBelowFromContext() {
    const ctx = tableContextRef.current;
    if (!ctx) return;
    const tbody = ctx.table.querySelector('tbody');
    if (!tbody) return;
    const cols = (ctx.table.querySelector('thead tr')?.children.length || ctx.table.rows?.[0]?.cells?.length || 1);
    const tr = document.createElement('tr');
    for (let i = 0; i < cols; i++) {
      const td = document.createElement('td');
      td.innerHTML = '&nbsp;';
      tr.appendChild(td);
    }
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const insertAt = Math.min(rows.length, Math.max(0, ctx.rowIndex + 1));
    if (rows[insertAt]) tbody.insertBefore(tr, rows[insertAt]);
    else tbody.appendChild(tr);
    persistContent();
  }

  function deleteRowFromContext() {
    const ctx = tableContextRef.current;
    if (!ctx) return;
    const tbody = ctx.table.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length <= 1) return;
    rows[ctx.rowIndex]?.remove();
    persistContent();
  }

  function redistributeTableColWidths(table: HTMLTableElement) {
    const cg = table.querySelector('colgroup');
    if (!cg) return;
    const cols = Array.from(cg.querySelectorAll('col')) as HTMLTableColElement[];
    if (!cols.length) return;
    const pct = Math.floor((10000 / cols.length)) / 100; // e.g. 12.5 for 8 cols
    cols.forEach((col, i) => {
      // последний забирает остаток от округления
      if (i === cols.length - 1) {
        const used = pct * (cols.length - 1);
        col.style.width = `${Math.max(1, Math.round((100 - used) * 100) / 100)}%`;
      } else {
        col.style.width = `${pct}%`;
      }
    });
  }

  function addColumnRightFromContext() {
    const ctx = tableContextRef.current;
    if (!ctx) return;
    const table = ctx.table;
    const headRow = table.querySelector('thead tr');
    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    const currentCols = headRow ? headRow.children.length : (bodyRows[0]?.children.length || 1);
    const nextCols = Math.min(10, currentCols + 1);
    if (nextCols === currentCols) return;
    ensureColgroup(table, nextCols);

    const insertAt = Math.min(currentCols, Math.max(0, ctx.colIndex + 1));
    if (headRow) {
      const th = document.createElement('th');
      th.style.position = 'relative';
      th.textContent = `Столбец ${insertAt + 1}`;
      const resizer = document.createElement('span');
      resizer.className = 'wa-col-resizer';
      resizer.setAttribute('contenteditable', 'false');
      th.appendChild(resizer);
      headRow.insertBefore(th, headRow.children[insertAt] || null);
    }
    bodyRows.forEach((tr) => {
      const td = document.createElement('td');
      td.innerHTML = '&nbsp;';
      tr.insertBefore(td, tr.children[insertAt] || null);
    });
    redistributeTableColWidths(table);
    renumberColResizers(table);
    persistContent();
  }

  function deleteColumnFromContext() {
    const ctx = tableContextRef.current;
    if (!ctx) return;
    const table = ctx.table;
    const headRow = table.querySelector('thead tr');
    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    const currentCols = headRow ? headRow.children.length : (bodyRows[0]?.children.length || 1);
    if (currentCols <= 1) return;
    const removeAt = Math.min(currentCols - 1, Math.max(0, ctx.colIndex));

    // colgroup
    const cg = ensureColgroup(table, currentCols);
    const colEls = cg ? Array.from(cg.querySelectorAll('col')) : [];
    colEls[removeAt]?.remove();

    if (headRow) headRow.children[removeAt]?.remove();
    bodyRows.forEach((tr) => tr.children[removeAt]?.remove());

    ensureColgroup(table, currentCols - 1);
    redistributeTableColWidths(table);
    renumberColResizers(table);
    persistContent();
  }

  useEffect(() => {
    if (!tableContextMenu.open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (target && tableContextMenuRef.current?.contains(target)) return;
      setTableContextMenu(v => ({ ...v, open: false }));
      tableContextRef.current = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTableContextMenu(v => ({ ...v, open: false }));
        tableContextRef.current = null;
      }
    };
    document.addEventListener('mousedown', onDown, { capture: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, { capture: true } as any);
      document.removeEventListener('keydown', onKey);
    };
  }, [tableContextMenu.open]);

  function onEditorMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const resizer = target.closest('.wa-col-resizer') as HTMLElement | null;
    if (!resizer) return;
    const table = resizer.closest('table') as HTMLTableElement | null;
    if (!table) return;
    const idx = Number(resizer.getAttribute('data-col') || '0');
    const col = table.querySelectorAll('colgroup col')[idx] as HTMLTableColElement | undefined;
    const th = resizer.closest('th') as HTMLTableCellElement | null;
    if (!col || !th) return;

    e.preventDefault();
    colResizeRef.current = {
      table,
      colIndex: idx,
      startX: e.clientX,
      startWidth: th.getBoundingClientRect().width
    };
  }

  function onEditorContextMenu(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const cell = target.closest('td,th') as HTMLTableCellElement | null;
    if (!cell) return;
    const table = cell.closest('.wa-table-wrap table') as HTMLTableElement | null;
    if (!table) return;
    const tr = cell.parentElement as HTMLTableRowElement | null;
    if (!tr) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const tbodyRows = Array.from(tbody.querySelectorAll('tr'));
    const rowIndex = tr.parentElement === tbody ? tbodyRows.indexOf(tr) : 0;
    const colIndex = Array.from(tr.children).indexOf(cell);
    if (colIndex < 0) return;

    e.preventDefault();
    tableContextRef.current = { table, rowIndex: Math.max(0, rowIndex), colIndex: Math.max(0, colIndex) };
    setTableContextMenu({ open: true, x: e.clientX, y: e.clientY });
  }

  function onEditorKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed) return;
    const table = getClosestTableFromSelection();
    if (!table) return;
    // Ctrl+Backspace/Delete — удалить всю таблицу
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      deleteCurrentTable();
    }
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const state = colResizeRef.current;
      if (!state) return;
      const delta = e.clientX - state.startX;
      const tableWidth = state.table.getBoundingClientRect().width || 1;
      const minPct = (48 / tableWidth) * 100;
      const newPct = Math.max(minPct, Math.min(80, ((state.startWidth + delta) / tableWidth) * 100));
      const col = state.table.querySelectorAll('colgroup col')[state.colIndex] as HTMLTableColElement | undefined;
      if (!col) return;
      col.style.width = `${Math.round(newPct * 100) / 100}%`;
    };
    const onUp = () => {
      if (!colResizeRef.current) return;
      colResizeRef.current = null;
      persistContent();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  function toggleExpanded() {
    setExpanded(prev => {
      const next = !prev;
      try { localStorage.setItem('workarea.expanded', next ? '1' : '0'); } catch {}
      return next;
    });
  }

  async function saveTabsToAPI(newTabs: string[]) {
    if (!currentClientId || !token) return;
    try {
      await api(`/api/clients/${currentClientId}/tabs`, {
        method: 'POST',
        token,
        body: { tabs: newTabs }
      });
      // Обновляем состояние после успешного сохранения
      setTabsFromDB(newTabs);
    } catch (error) {
      console.error('Error saving tabs to API:', error);
    }
  }

  function addCustomTab(preferredName?: string | null) {
    if (!currentClientId) return;
    let name = (preferredName || '').trim();
    if (!name) name = 'Новая вкладка';
    // если шаблонное имя уже есть — создаём с суффиксом
    let finalName = name;
    if (tabs.includes(finalName)) {
      let i = 2;
      while (tabs.includes(`${name} ${i}`)) i += 1;
      finalName = `${name} ${i}`;
    }
    const next = [...tabs, finalName];
    try { localStorage.setItem(tabsKey(currentClientId), JSON.stringify(next)); } catch {}
    if (token) saveTabsToAPI(next);
    setActiveTab(finalName);
  }

  function renameTab(oldName: string, newNameRaw: string) {
    if (!currentClientId) return;
    const newName = newNameRaw.trim();
    setRenamingTab(null);
    if (!newName || newName === oldName) return;
    if (tabs.includes(newName)) {
      alert('Вкладка с таким названием уже есть');
      return;
    }
    const next = tabs.map((t) => (t === oldName ? newName : t));
    try {
      localStorage.setItem(tabsKey(currentClientId), JSON.stringify(next));
      const oldKey = storageKey(currentClientId, oldName);
      const newKey = storageKey(currentClientId, newName);
      const content = localStorage.getItem(oldKey);
      if (content != null) {
        localStorage.setItem(newKey, content);
        localStorage.removeItem(oldKey);
      }
    } catch {}
    if (token) {
      void (async () => {
        try {
          await saveTabsToAPI(next);
          if (editorRef.current && activeTab === oldName) {
            await api(`/api/clients/${currentClientId}/documents`, {
              method: 'POST',
              token,
              body: { tabName: newName, content: editorRef.current.innerHTML },
            });
          }
        } catch (e) {
          console.error('Error renaming tab:', e);
        }
      })();
    }
    if (activeTab === oldName) setActiveTab(newName);
  }

  function removeCustomTab(tab: string) {
    if (!currentClientId) return;
    
    // Спрашиваем подтверждение перед удалением
    if (!confirm(`Точно удалить вкладку "${tab}"?`)) {
      return;
    }
    
    // Разрешаем удаление любых вкладок, включая обязательные
    const next = tabs.filter(t => t !== tab);
    if (next.length === 0) {
      // Если удалили все вкладки, оставляем хотя бы одну дефолтную
      alert('Нельзя удалить все вкладки. Оставьте хотя бы одну.');
      return;
    }
    try { localStorage.setItem(tabsKey(currentClientId), JSON.stringify(next)); } catch {}
    if (token) saveTabsToAPI(next);
    if (activeTab === tab) setActiveTab(next[0] || DEFAULT_TABS[0]);
  }

  function handleDragStart(tab: string) {
    setDraggedTab(tab);
  }

  function handleDragOver(e: React.DragEvent, tab: string) {
    e.preventDefault();
    if (draggedTab && draggedTab !== tab) {
      setDragOverTab(tab);
    }
  }

  function handleDragLeave() {
    setDragOverTab(null);
  }

  function handleDrop(e: React.DragEvent, targetTab: string) {
    e.preventDefault();
    if (!draggedTab || draggedTab === targetTab || !currentClientId) {
      setDraggedTab(null);
      setDragOverTab(null);
      return;
    }

    const draggedIndex = tabs.indexOf(draggedTab);
    const targetIndex = tabs.indexOf(targetTab);
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedTab(null);
      setDragOverTab(null);
      return;
    }

    const newTabs = [...tabs];
    newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, draggedTab);
    
    try { localStorage.setItem(tabsKey(currentClientId), JSON.stringify(newTabs)); } catch {}
    if (token) saveTabsToAPI(newTabs);
    
    setDraggedTab(null);
    setDragOverTab(null);
  }

  function handleDragEnd() {
    setDraggedTab(null);
    setDragOverTab(null);
  }

  usePsychologistPlatformTour({
    tourId: 'workArea',
    userId: user?.id,
    role: user?.role,
    enabled: Boolean(
      token &&
      user?.role === 'psychologist' &&
      isVerified === true &&
      !loading &&
      !restrictedClientId
    ),
    steps: PSYCHOLOGIST_WORK_AREA_TOUR_STEPS
  });

  // Проверка верификации - показываем сообщение, если не верифицирован
  if (isVerified === false && token) {
    const verificationContent = (
      <main style={{ flex: 1, padding: noPadding ? '16px 24px' : '24px 48px', display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ padding: 48, textAlign: 'center', maxWidth: 600 }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🔒</div>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 24 }}>Требуется верификация</div>
          <div style={{ marginBottom: 24, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Для доступа к рабочей области и инструментам необходимо пройти верификацию администратором.
            {verificationStatus === 'pending' && (
              <div style={{ marginTop: 16, padding: 12, background: 'rgba(255, 193, 7, 0.1)', borderRadius: 8, color: '#ffc107' }}>
                ⏳ Ваш запрос на верификацию находится на рассмотрении
              </div>
            )}
            {verificationStatus === 'rejected' && (
              <div style={{ marginTop: 16, padding: 12, background: 'rgba(244, 67, 54, 0.1)', borderRadius: 8, color: '#f44336' }}>
                ❌ Ваш запрос на верификацию был отклонен. Пожалуйста, отправьте новый запрос.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/psychologist/profile" className="button" style={{ textDecoration: 'none' }}>
              Перейти к профилю для верификации
            </a>
          </div>
        </div>
      </main>
    );
    
    if (hideNavbar) {
      return verificationContent;
    }
    
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PsychologistNavbar />
        {verificationContent}
      </div>
    );
  }

  // Если в ограниченном режиме и клиент не найден
  if (restrictedClientId && clients.length === 0 && !loading) {
    const errorContent = (
      <main style={{ flex: 1, padding: noPadding ? '16px 24px' : '24px 48px', display: 'grid', placeItems: 'center' }}>
        <div className="card" style={{ padding: 48, textAlign: 'center', maxWidth: 500 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 20 }}>Клиент не найден</div>
          <div className="small" style={{ color: 'var(--text-muted)' }}>
            Клиент с ID {restrictedClientId} не найден или у вас нет доступа к нему.
          </div>
        </div>
      </main>
    );
    
    if (hideNavbar) {
      return errorContent;
    }
    
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PsychologistNavbar />
        {errorContent}
      </div>
    );
  }

  const content = (
    <main className="wa-root" style={{ 
      flex: 1, 
      padding: 0, 
      minWidth: 0, 
      overflow: 'hidden', 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      position: 'relative' 
    }}>
        {/* Main Content Area: Sidebar (Tabs) + Editor */}
        <div
          data-tour="workarea-header"
          style={{ 
          display: isMobileView ? 'flex' : 'grid', 
          gridTemplateColumns: isMobileView ? 'none' : ((expanded || restrictedClientId) ? '0 1fr' : '240px 1fr'), 
          gap: 0, 
          flex: 1, 
          minHeight: 0, 
          overflow: 'hidden',
          position: 'relative',
          transition: 'grid-template-columns 0.3s ease'
        }}>
          {/* Toggle button on the edge - always visible, positioned outside sidebar */}
          {!isMobileView && !restrictedClientId && (
            <button
              onClick={toggleExpanded}
              style={{
                position: 'absolute',
                left: expanded ? 0 : 239,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 12,
                height: 100,
                borderRadius: expanded ? '0 6px 6px 0' : '6px 0 0 6px',
                border: `1px solid ${ui.borderStrong}`,
                borderLeft: expanded ? `1px solid ${ui.borderStrong}` : 'none',
                borderRight: expanded ? 'none' : `1px solid ${ui.borderStrong}`,
                background: expanded ? ui.activeBg : ui.panel2,
                color: expanded ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 200,
                transition: 'all 0.3s ease',
                boxShadow: expanded ? (isLightTheme ? '2px 0 10px rgba(37,99,235,0.18)' : '2px 0 10px rgba(91,124,250,0.25)') : (isLightTheme ? 'inset -1px 0 0 rgba(15,23,42,0.08)' : 'inset -1px 0 0 rgba(255,255,255,0.10)'),
                pointerEvents: 'auto'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = ui.activeBg;
                e.currentTarget.style.color = 'var(--primary)';
                e.currentTarget.style.width = '16px';
                e.currentTarget.style.boxShadow = isLightTheme ? '2px 0 14px rgba(37,99,235,0.22)' : '2px 0 14px rgba(91,124,250,0.35)';
                e.currentTarget.style.borderColor = ui.activeBorder;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = expanded ? ui.activeBg : ui.panel2;
                e.currentTarget.style.color = expanded ? 'var(--primary)' : 'var(--text-muted)';
                e.currentTarget.style.width = '12px';
                e.currentTarget.style.boxShadow = expanded ? (isLightTheme ? '2px 0 10px rgba(37,99,235,0.18)' : '2px 0 10px rgba(91,124,250,0.25)') : (isLightTheme ? 'inset -1px 0 0 rgba(15,23,42,0.08)' : 'inset -1px 0 0 rgba(255,255,255,0.10)');
                e.currentTarget.style.borderColor = ui.borderStrong;
              }}
              title={expanded ? 'Показать вкладки' : 'Скрыть вкладки'}
            >
              {expanded ? '►' : '◄'}
            </button>
          )}
          {/* Left Sidebar - Tabs */}
          {!restrictedClientId && (
            <div
              data-tour="workarea-tabs"
              style={{ 
              display: isMobileView ? (showTabContent ? 'none' : 'flex') : 'flex',
              flexDirection: 'column',
              borderRight: isMobileView ? 'none' : `1px solid ${ui.border}`,
              background: ui.panel2,
              overflow: 'hidden',
              width: isMobileView ? '100%' : (expanded ? 0 : 240),
              minWidth: isMobileView ? 'auto' : (expanded ? 0 : 240),
              transition: 'width 0.3s ease, min-width 0.3s ease',
              position: 'relative'
            }}
            >
              <div style={{ 
                padding: '10px 10px 8px', 
                borderBottom: `1px solid ${ui.border}`,
                flexShrink: 0,
                overflow: 'visible',
                opacity: expanded ? 0 : 1,
                transition: 'opacity 0.3s ease',
                position: 'relative',
                zIndex: 5
              }}>
                <div style={{ position: 'relative' }} data-clients-dropdown>
                  {currentClient ? (
                    <button
                      type="button"
                      className="wa-client-chip wa-client-chip--sidebar"
                      onClick={() => setShowClientsDropdown(!showClientsDropdown)}
                    >
                      {getAvatarUrl(currentClient.avatarUrl || currentClient.profile?.avatarUrl, currentClient.id) ? (
                        <img
                          className="wa-avatar wa-avatar--sm"
                          src={getAvatarUrl(currentClient.avatarUrl || currentClient.profile?.avatarUrl, currentClient.id) || ''}
                          alt={currentClient.name || 'Аватар'}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector('.avatar-fallback')) {
                              const fallback = document.createElement('div');
                              fallback.className = 'avatar-fallback wa-avatar-fallback wa-avatar-fallback--sm';
                              fallback.textContent = (currentClient.name || '?').trim().charAt(0).toUpperCase();
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      ) : (
                        <div className="wa-avatar-fallback wa-avatar-fallback--sm">
                          {(currentClient.name || '?').trim().charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ minWidth: 0, textAlign: 'left', flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                          {currentClient.name || 'Клиент'}
                        </div>
                        <div className="small" style={{ fontSize: 11, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                          {currentClient.email || '—'}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, opacity: 0.55, flexShrink: 0 }}>▼</span>
                    </button>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 4px' }}>Нет клиентов</div>
                  )}
                  {showClientsDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      right: 0,
                      minWidth: 220,
                      background: 'var(--surface)',
                      border: `1px solid ${ui.border}`,
                      borderRadius: 12,
                      maxHeight: 320,
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                      padding: '6px'
                    }}>
                      {clients.map((c) => {
                        const active = c.id === currentClientId;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setCurrentClientId(c.id);
                              setShowClientsDropdown(false);
                              setExpanded(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '10px',
                              borderRadius: 8,
                              border: 'none',
                              background: active ? ui.activeBg : 'transparent',
                              color: 'var(--text)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              width: '100%',
                            }}
                          >
                            <div className="wa-avatar-fallback wa-avatar-fallback--sm">
                              {(c.name || '?').trim().charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.name || 'Клиент'}
                              </div>
                              <div className="small" style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.email || '—'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '8px',
                minHeight: 0,
                opacity: expanded ? 0 : 1,
                transition: 'opacity 0.3s ease',
                overflow: expanded ? 'hidden' : 'auto',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {tabs.map(tab => {
                  const active = tab === activeTab;
                  const isDragged = draggedTab === tab;
                  const isDragOver = dragOverTab === tab;
                  return (
                    <div 
                      key={tab} 
                      className="wa-tab"
                      style={{ 
                        marginBottom: 4,
                        opacity: isDragged ? 0.5 : 1,
                        transform: isDragOver ? 'translateX(4px)' : 'none',
                        transition: 'transform 0.2s'
                      }}
                      draggable={renamingTab !== tab}
                      onDragStart={() => handleDragStart(tab)}
                      onDragOver={(e) => handleDragOver(e, tab)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, tab)}
                      onDragEnd={handleDragEnd}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="button secondary"
                        onClick={() => {
                          if (renamingTab === tab) return;
                          setActiveTab(tab);
                          if (isMobileView) {
                            setShowTabContent(true);
                          }
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setRenamingTab(tab);
                          setRenameDraft(tab);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setActiveTab(tab);
                            if (isMobileView) {
                              setShowTabContent(true);
                            }
                          }
                        }}
                        style={{
                          width: '100%',
                          justifyContent: 'flex-start',
                          padding: '10px 12px',
                          fontSize: 13,
                          textAlign: 'left',
                          position: 'relative',
                          borderRadius: 8,
                          cursor: isDragged ? 'grabbing' : 'pointer',
                          border: isDragOver ? `2px dashed ${ui.activeBorder}` : active ? `1px solid ${ui.activeBorder}` : `1px solid transparent`,
                          background: active ? ui.activeBg : 'transparent',
                          color: active ? ui.activeText : 'var(--text)',
                          boxShadow: active ? (isLightTheme ? '0 6px 16px rgba(15,23,42,0.06)' : '0 10px 22px rgba(0,0,0,0.25)') : 'none',
                          transition: 'all 0.2s ease',
                          userSelect: 'none'
                        }}
                        onMouseEnter={(e) => {
                          if (!active) {
                            e.currentTarget.style.background = ui.hover;
                            e.currentTarget.style.transform = 'translateX(2px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.background = '';
                            e.currentTarget.style.transform = 'translateX(0)';
                          }
                        }}
                      >
                        {active && (
                          <span
                            aria-hidden
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 6,
                              bottom: 6,
                              width: 3,
                              borderRadius: 999,
                              background: 'var(--primary)'
                            }}
                          />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          {renamingTab === tab ? (
                            <input
                              className="wa-tab-rename"
                              value={renameDraft}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onBlur={() => renameTab(tab, renameDraft)}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  renameTab(tab, renameDraft);
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setRenamingTab(null);
                                }
                              }}
                            />
                          ) : (
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ opacity: 0.5, fontSize: 12 }}>☰</span>
                              {tab}
                            </span>
                          )}
                          <button 
                            type="button"
                            title="Удалить вкладку" 
                            className="button secondary wa-tab__close" 
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCustomTab(tab);
                            }} 
                            style={{ 
                              padding: '2px 6px', 
                              fontSize: 11,
                              minWidth: 'auto',
                              marginLeft: 8,
                              flexShrink: 0,
                              transition: 'all 0.2s ease',
                              color: 'var(--text-muted)'
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="wa-add-tab-btn"
                  onClick={() => addCustomTab('Новая вкладка')}
                  disabled={!currentClientId}
                  title={t('workArea.addTab')}
                >
                  + Добавить вкладку
                </button>
              </div>
            </div>
          )}

          {/* Right Side - Editor Area */}
          <div
            data-tour="workarea-editor"
            key={activeTab}
            style={{ 
            display: isMobileView ? (showTabContent ? 'flex' : 'none') : 'flex', 
            flexDirection: 'column', 
            minWidth: 0, 
            minHeight: 0, 
            overflow: 'hidden',
            background: 'var(--bg)',
            width: isMobileView ? '100%' : 'auto'
          }}
          >
            {/* Mobile: только «назад к вкладкам», без названия вкладки */}
            {isMobileView && showTabContent && (
              <button
                type="button"
                className="wa-mobile-back"
                onClick={() => setShowTabContent(false)}
                title="Назад к вкладкам"
              >
                ← К вкладкам
              </button>
            )}

            {/* Toolbar (скрыт для вкладок без редактора) */}
            {!isCardTab(activeTab) && (
              <div className="wa-toolbar" style={{ background: ui.panel2, borderBottom: `1px solid ${ui.border}` }}>
                <select
                  className="wa-tb-select"
                  onChange={(e) => execBlock(e.target.value as 'P' | 'H2' | 'H3')}
                  defaultValue="P"
                  title="Стиль абзаца"
                  aria-label="Стиль абзаца"
                >
                  <option value="P">Обычный</option>
                  <option value="H2">Заголовок 2</option>
                  <option value="H3">Заголовок 3</option>
                </select>

                <span className="wa-toolbar__sep" aria-hidden />

                <button type="button" className={`wa-tb-btn${formatState.bold ? ' is-active' : ''}`} onClick={() => exec('bold')} title="Жирный" aria-pressed={formatState.bold}>B</button>
                <button type="button" className={`wa-tb-btn${formatState.italic ? ' is-active' : ''}`} onClick={() => exec('italic')} title="Курсив" aria-pressed={formatState.italic} style={{ fontStyle: 'italic' }}>I</button>
                <button type="button" className={`wa-tb-btn${formatState.underline ? ' is-active' : ''}`} onClick={() => exec('underline')} title="Подчёркнутый" aria-pressed={formatState.underline} style={{ textDecoration: 'underline' }}>U</button>
                <button type="button" className={`wa-tb-btn${formatState.strikeThrough ? ' is-active' : ''}`} onClick={() => exec('strikeThrough')} title="Зачёркнутый" aria-pressed={formatState.strikeThrough} style={{ textDecoration: 'line-through' }}>S</button>

                <span className="wa-toolbar__sep" aria-hidden />

                <div className="wa-hl" role="group" aria-label="Выделение">
                  {HIGHLIGHT_COLORS.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      className={`wa-hl__swatch${activeHighlight === h.id ? ' is-active' : ''}`}
                      style={{ background: h.color }}
                      title={`Выделение: ${h.label}`}
                      aria-label={`Выделение: ${h.label}`}
                      onClick={() => applyHighlight(h.color, h.id)}
                    />
                  ))}
                </div>

                <span className="wa-toolbar__sep" aria-hidden />

                <button type="button" className="wa-tb-btn" onClick={() => execBlock('BLOCKQUOTE')} title="Цитата">❝</button>
                <button type="button" className="wa-tb-btn" onClick={insertChecklist} title="Чек-лист">☑</button>
                <button type="button" className={`wa-tb-btn${formatState.insertUnorderedList ? ' is-active' : ''}`} onClick={() => exec('insertUnorderedList')} title="Маркированный список" aria-pressed={formatState.insertUnorderedList}>•</button>
                <button type="button" className={`wa-tb-btn${formatState.insertOrderedList ? ' is-active' : ''}`} onClick={() => exec('insertOrderedList')} title="Нумерованный список" aria-pressed={formatState.insertOrderedList}>1.</button>
                <button type="button" className="wa-tb-btn" onClick={() => exec('outdent')} title="Уменьшить отступ">⇤</button>
                <button type="button" className="wa-tb-btn" onClick={() => exec('indent')} title="Увеличить отступ">⇥</button>

                <span className="wa-toolbar__sep" aria-hidden />

                <button type="button" className={`wa-tb-btn${formatState.justifyLeft ? ' is-active' : ''}`} onClick={() => exec('justifyLeft')} title="По левому краю" aria-pressed={formatState.justifyLeft}>⟸</button>
                <button type="button" className={`wa-tb-btn${formatState.justifyCenter ? ' is-active' : ''}`} onClick={() => exec('justifyCenter')} title="По центру" aria-pressed={formatState.justifyCenter}>≡</button>
                <button type="button" className={`wa-tb-btn${formatState.justifyRight ? ' is-active' : ''}`} onClick={() => exec('justifyRight')} title="По правому краю" aria-pressed={formatState.justifyRight}>⟹</button>

                <span className="wa-toolbar__sep" aria-hidden />

                <button type="button" className="wa-tb-btn" onClick={insertLink} title="Вставить ссылку">🔗</button>
                <button type="button" className="wa-tb-btn" onClick={removeLink} title="Удалить ссылку">🔗✕</button>
                <button
                  ref={tablePickerButtonRef}
                  type="button"
                  className="wa-tb-btn"
                  onClick={() => {
                    setTablePickerOpen((v) => !v);
                    setTablePickerHover({ rows: 4, cols: 4 });
                  }}
                  title="Вставить таблицу"
                >
                  Таблица ▾
                </button>
                <button type="button" className="wa-tb-btn" onClick={deleteCurrentTable} title="Удалить таблицу">
                  ⌫ табл.
                </button>

                {tablePickerOpen && tablePickerPos && createPortal(
                  <div
                    ref={tablePickerPanelRef}
                    style={{
                      position: 'fixed',
                      top: tablePickerPos.top,
                      left: tablePickerPos.left,
                      zIndex: 9999,
                      width: tablePickerPos.width,
                      maxWidth: 'calc(100vw - 24px)',
                      padding: 10,
                      borderRadius: 12,
                      border: `1px solid ${ui.border}`,
                      background: ui.panel2,
                      boxShadow: isLightTheme ? '0 10px 24px rgba(15,23,42,0.12)' : '0 10px 24px rgba(0,0,0,0.35)'
                    }}
                  >
                    <div className="small" style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                      {tablePickerHover ? `Таблица ${tablePickerHover.rows}×${tablePickerHover.cols}` : 'Таблица'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
                      {Array.from({ length: 10 }).map((_, r) =>
                        Array.from({ length: 10 }).map((__, c) => {
                          const rows = r + 1;
                          const cols = c + 1;
                          const active = Boolean(tablePickerHover && rows <= tablePickerHover.rows && cols <= tablePickerHover.cols);
                          return (
                            <div
                              key={`${r}-${c}`}
                              onMouseEnter={() => setTablePickerHover({ rows, cols })}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                insertTable(rows, cols);
                                setTablePickerOpen(false);
                                setTablePickerHover(null);
                                setTablePickerPos(null);
                              }}
                              style={{
                                height: 18,
                                borderRadius: 4,
                                border: `1px solid ${ui.border}`,
                                background: active
                                  ? (isLightTheme ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.28)')
                                  : (isLightTheme ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.10)'),
                                cursor: 'pointer'
                              }}
                              title={`${rows}×${cols}`}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>,
                  document.body
                )}

                <span className="wa-toolbar__sep" aria-hidden />

                <button type="button" className="wa-tb-btn" onClick={() => exec('undo')} title="Отменить">↶</button>
                <button type="button" className="wa-tb-btn" onClick={() => exec('redo')} title="Повторить">↷</button>
                <button type="button" className="wa-tb-btn" onClick={clearFormatting} title="Очистить формат">⌫</button>

                <span className="wa-toolbar__sep" aria-hidden />

                <button
                  type="button"
                  className="wa-print-btn"
                  onClick={printWorkAreaDocument}
                  title="Печать документа A4"
                >
                  Печать
                </button>

                <span className="wa-toolbar__spacer" />

                <button
                  type="button"
                  className="wa-ai-btn"
                  onClick={openAiForClient}
                  disabled={!currentClientId}
                  title="Открыть ИИ-чат с контекстом вкладок текущего клиента"
                >
                  ИИ по клиенту
                </button>
              </div>
            )}

            {/* Editor, journal, or dream cards */}
            {activeTab === 'Дневник клиента' ? (
              <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '24px',
                minHeight: 0
              }}>
                {loadingJournal ? (
                  <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                    <div className="small" style={{ color: 'var(--text-muted)' }}>Загрузка записей дневника...</div>
                  </div>
                ) : journalEntries.length === 0 ? (
                  <div className="card wa-empty">
                    <div className="wa-empty__icon" aria-hidden>
                      <BookOpen size={22} strokeWidth={1.75} />
                    </div>
                    <div className="wa-empty__title">Дневник клиента пуст</div>
                    <div className="small" style={{ color: 'var(--text-muted)' }}>Клиент еще не создал записей в дневнике</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 16, maxWidth: 900, margin: '0 auto' }}>
                    {journalEntries.map(entry => (
                      <div key={entry.id} className="card" style={{ padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div className="small" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {new Date(entry.createdAt).toLocaleDateString('ru-RU', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                        </div>
                        <div style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text)', fontSize: 14 }}>{entry.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === 'сны' ? (
              <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '24px',
                minHeight: 0
              }}>
                {loadingDreams ? (
                  <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                    <div className="small" style={{ color: 'var(--text-muted)' }}>Загрузка снов...</div>
                  </div>
                ) : clientDreams.length === 0 ? (
                  <div className="card wa-empty">
                    <div className="wa-empty__icon" aria-hidden>
                      <Moon size={22} strokeWidth={1.75} />
                    </div>
                    <div className="wa-empty__title">Снов пока нет</div>
                    <div className="small" style={{ color: 'var(--text-muted)' }}>Клиент ещё не добавил записи сновидений</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 16, maxWidth: 900, margin: '0 auto' }}>
                    {clientDreams.map(dream => {
                      const symbols = normalizeDreamSymbols(dream.symbols);
                      const preview = (dream.content || '').trim();
                      const short =
                        preview.length > 320 ? `${preview.slice(0, 320).trim()}…` : preview;
                      return (
                        <div key={dream.id} className="card" style={{ padding: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: 'var(--text)' }}>
                                {dream.title?.trim() || 'Без названия'}
                              </div>
                              <div className="small" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                                {new Date(dream.createdAt).toLocaleDateString('ru-RU', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                            <Link
                              to={`/dreams/${dream.id}`}
                              className="button secondary"
                              style={{ padding: '8px 14px', fontSize: 13, flexShrink: 0, textDecoration: 'none' }}
                            >
                              Открыть
                            </Link>
                          </div>
                          {symbols.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                              {symbols.slice(0, 12).map(sym => (
                                <span
                                  key={sym}
                                  style={{
                                    fontSize: 12,
                                    padding: '4px 10px',
                                    borderRadius: 999,
                                    background: 'var(--surface-2)',
                                    color: 'var(--text-muted)',
                                    border: `1px solid ${ui.border}`
                                  }}
                                >
                                  {sym}
                                </span>
                              ))}
                              {symbols.length > 12 && (
                                <span className="small" style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>
                                  +{symbols.length - 12}
                                </span>
                              )}
                            </div>
                          )}
                          {short ? (
                            <div style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text)', fontSize: 14 }}>
                              {short}
                            </div>
                          ) : (
                            <div className="small" style={{ color: 'var(--text-muted)' }}>Нет текста</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : activeTab === 'Тесты' ? (
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                minHeight: 0
              }}>
                {loadingTests ? (
                  <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                    <div className="small" style={{ color: 'var(--text-muted)' }}>Загрузка тестов...</div>
                  </div>
                ) : clientTests.length === 0 ? (
                  <div className="card wa-empty">
                    <div className="wa-empty__icon" aria-hidden>
                      <Brain size={22} strokeWidth={1.75} />
                    </div>
                    <div className="wa-empty__title">Тестов пока нет</div>
                    <div className="small" style={{ color: 'var(--text-muted)' }}>
                      Сохранённые результаты сессионных тестов появятся здесь
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 16, maxWidth: 900, margin: '0 auto' }}>
                    {clientTests.map((row) => {
                      const notes = typeof row.result?.notes === 'string' ? row.result.notes.trim() : '';
                      const log = associationLogRows(row.result);
                      const run1 = log.filter((r) => (r.run_number || 1) === 1);
                      const run2 = log.filter((r) => r.run_number === 2);
                      const pyramidLevels = row.testType === 'pyramid-session' && row.result?.levels
                        ? ([1, 2, 3, 4, 5] as const).map((level) => ({
                            level,
                            words: (row.result.levels[level] || row.result.levels[String(level)] || [])
                              .map((w: unknown) => String(w || '').trim())
                              .filter(Boolean)
                          }))
                        : [];
                      const open = expandedTestIds.includes(row.id);
                      return (
                        <div key={row.id} className="card wa-test-card">
                          <button
                            type="button"
                            className="wa-test-card__head"
                            aria-expanded={open}
                            onClick={() =>
                              setExpandedTestIds((ids) =>
                                ids.includes(row.id) ? ids.filter((id) => id !== row.id) : [...ids, row.id]
                              )
                            }
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="wa-test-card__title">{testTypeLabel(row.testType)}</div>
                              <div className="small" style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                                {new Date(row.createdAt).toLocaleDateString('ru-RU', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                              <div className="wa-test-card__sum">{testResultSummary(row)}</div>
                            </div>
                            <ChevronDown size={18} className={`wa-test-card__chevron${open ? ' is-open' : ''}`} aria-hidden />
                          </button>
                          {open ? (
                            <div className="wa-test-card__body">
                              {notes ? (
                                <div className="small" style={{ marginBottom: 10, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                                  {notes}
                                </div>
                              ) : null}
                              {row.testType === 'association-session' && log.length > 0 ? (
                                <>
                                  {([
                                    { title: run2.length ? 'Круг 1' : null, rows: run1 },
                                    { title: run2.length ? 'Круг 2' : null, rows: run2 }
                                  ] as const).filter((block) => block.rows.length).map((block) => (
                                    <div key={block.title || 'run'}>
                                      {block.title ? <div className="wa-test-log__run">{block.title}</div> : null}
                                      <table className="wa-test-log">
                                        <thead>
                                          <tr>
                                            <th>№</th>
                                            <th>Слово</th>
                                            <th>Ответ</th>
                                            <th>Время</th>
                                            <th>Пометка</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {block.rows.map((r, i) => (
                                            <tr key={`${r.run_number || 1}-${r.word_index ?? i}`}>
                                              <td>{(r.word_index ?? i) + 1}</td>
                                              <td>{r.word || '—'}</td>
                                              <td>{r.response_text || '—'}</td>
                                              <td>{reactionLabel(r)}</td>
                                              <td>{r.therapist_flag || '—'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ))}
                                </>
                              ) : null}
                              {pyramidLevels.length > 0 ? (
                                <div style={{ marginTop: 4, display: 'grid', gap: 8 }}>
                                  {pyramidLevels.map((level) => (
                                    <div key={level.level} className="small" style={{ color: 'var(--text)', lineHeight: 1.5 }}>
                                      <span style={{ color: 'var(--text-muted)' }}>{level.level}.</span>{' '}
                                      {level.words.length ? level.words.join(', ') : '—'}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <>
              <div className="wa-editor-scroll">
                {loading && (
                  <div style={{ 
                    position: 'absolute', 
                    top: 20, 
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10, 
                    color: 'var(--text-muted)',
                    background: 'rgba(26,29,36,0.9)',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 13
                  }}>
                    {t('workArea.loading')}
                  </div>
                )}
                <div className="wa-paper" style={{ width: `${A4_WIDTH_MM}mm` }}>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onMouseDown={onEditorMouseDown}
                    onContextMenu={onEditorContextMenu}
                    onKeyDown={onEditorKeyDown}
                    onInput={persistContent}
                    onPaste={handleEditorPaste}
                    className={`workarea-editor${editorEmpty ? ' is-empty' : ''}`}
                    data-placeholder="Пишите здесь — всё сохраняется автоматически"
                    style={{ opacity: loading ? 0.5 : 1 }}
                  />
                </div>
              </div>
              <div className="wa-statusbar">
                <span><strong>{wordCount}</strong> слов</span>
                <span><strong>{charCount}</strong> символов</span>
                <span>~<strong>{pageCount}</strong> стр. при печати</span>
                <span>Клиент: <strong>{currentClient?.name || '—'}</strong></span>
                {restrictedClientId && (
                  <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>
                    🔓 Админ
                  </span>
                )}
                <div className="wa-statusbar__right">
                  <span className={`wa-save-status${saving ? ' is-saving' : ''}`} aria-live="polite">
                    {saving
                      ? 'Сохранение…'
                      : lastSavedAt
                        ? `Сохранено · ${formatSavedClock(lastSavedAt)}`
                        : '—'}
                  </span>
                  <PsychologistTourHelpButton tourId="workArea" steps={PSYCHOLOGIST_WORK_AREA_TOUR_STEPS} userId={user?.id} role={user?.role} />
                </div>
              </div>
              {tableContextMenu.open && createPortal(
                  <div
                    ref={tableContextMenuRef}
                    style={{
                      position: 'fixed',
                      top: tableContextMenu.y,
                      left: tableContextMenu.x,
                      zIndex: 10000,
                      minWidth: 220,
                      padding: 6,
                      borderRadius: 12,
                      border: `1px solid ${ui.border}`,
                      background: ui.panel2,
                      boxShadow: isLightTheme ? '0 12px 28px rgba(15,23,42,0.14)' : '0 12px 28px rgba(0,0,0,0.38)'
                    }}
                    onMouseDown={(e) => {
                      // не даём редактору терять фокус / выделение
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <button className="button secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 10px', fontSize: 13 }} onClick={() => { addRowBelowFromContext(); setTableContextMenu(v => ({ ...v, open: false })); }}>
                      Добавить строку
                    </button>
                    <button className="button secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 10px', fontSize: 13, marginTop: 6 }} onClick={() => { addColumnRightFromContext(); setTableContextMenu(v => ({ ...v, open: false })); }}>
                      Добавить столбец
                    </button>
                    <div style={{ height: 1, background: ui.border, margin: '8px 6px' }} />
                    <button className="button secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 10px', fontSize: 13 }} onClick={() => { deleteRowFromContext(); setTableContextMenu(v => ({ ...v, open: false })); }}>
                      Удалить строку
                    </button>
                    <button className="button secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 10px', fontSize: 13, marginTop: 6 }} onClick={() => { deleteColumnFromContext(); setTableContextMenu(v => ({ ...v, open: false })); }}>
                      Удалить столбец
                    </button>
                    <div style={{ height: 1, background: ui.border, margin: '8px 6px' }} />
                    <button className="button secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 10px', fontSize: 13 }} onClick={() => { deleteCurrentTable(); setTableContextMenu(v => ({ ...v, open: false })); }}>
                      Удалить таблицу
                    </button>
                  </div>,
                  document.body
                )}
              </>
            )}
          </div>
        </div>
      </main>
  );

  if (hideNavbar) {
    return (
      <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {content}
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      {content}
    </div>
  );
}


