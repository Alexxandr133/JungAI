import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
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
  'записи',
  'Дневник клиента',
  'Синхронии'
];

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
  const [showClientsDropdown, setShowClientsDropdown] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [currentClientId, setCurrentClientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('Ведение клиента');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState<boolean>(() => localStorage.getItem('workarea.expanded') === '1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const [journalEntries, setJournalEntries] = useState<Array<{ id: string; content: string; createdAt: string; updatedAt: string }>>([]);
  const [loadingJournal, setLoadingJournal] = useState(false);
  const [clientDreams, setClientDreams] = useState<Array<{ id: string; title: string; content: string; createdAt: string; symbols?: unknown }>>([]);
  const [loadingDreams, setLoadingDreams] = useState(false);
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
        setClients(items); // КРИТИЧНО: показываем только реальных клиентов, без fallback на демо
        setCurrentClientId(prev => {
          const newId = prev || (items[0]?.id || '');
          if (newId && newId !== prev) {
            setExpanded(false); // Показываем панель вкладок при автоматическом выборе клиента
          }
          return newId;
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
  }, [token, restrictedClientId, isVerified]);

  // Preselect client from query parameter
  useEffect(() => {
    const url = new URL(window.location.href);
    const clientFromQuery = url.searchParams.get('client');
    if (!clientFromQuery) return;
    setCurrentClientId(prev => {
      const newId = prev || clientFromQuery;
      if (newId && newId !== prev) {
        setExpanded(false); // Показываем панель вкладок при выборе клиента из query
      }
      return newId;
    });
  }, []);

  const [tabsFromDB, setTabsFromDB] = useState<string[] | null>(null);

  // Функция для замены "паранормальное" на "Синхронии"
  const normalizeTabs = (tabsList: string[]): string[] => {
    return tabsList.map(tab => {
      // Заменяем различные варианты написания "паранормальное" на "Синхронии"
      if (tab.toLowerCase().includes('паранормальн') || tab === 'паранормальное' || tab === 'Паранормальное') {
        return 'Синхронии';
      }
      return tab;
    });
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

  // Не допускаем «просачивания» текста редактора во вкладки с карточками
  useEffect(() => {
    if (activeTab === 'Дневник клиента' || activeTab === 'сны') {
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
    if (activeTab === 'Дневник клиента' || activeTab === 'сны') return;
    
    if (!currentClientId || !editorRef.current || !token) return;
    
    const loadContent = async () => {
      setLoading(true);
      try {
        // Сначала пытаемся загрузить из API
        try {
          const doc = await api<{ content: string }>(`/api/clients/${currentClientId}/documents/${encodeURIComponent(activeTab)}`, { token });
          if (doc && doc.content) {
            editorRef.current!.innerHTML = doc.content;
            // Также сохраняем в localStorage как кэш
            const key = storageKey(currentClientId, activeTab);
            try { localStorage.setItem(key, doc.content); } catch {}
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
        setLoading(false);
      }
    };
    
    loadContent();
  }, [currentClientId, activeTab, token, isVerified]);

  async function saveToAPI(immediate = false) {
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
            content: editorRef.current!.innerHTML
          }
        });
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
    if (!currentClientId || !editorRef.current) return;

    // Сохраняем в localStorage сразу (для быстрого доступа)
    const key = storageKey(currentClientId, activeTab);
    const content = editorRef.current.innerHTML;
    try { localStorage.setItem(key, content); } catch {}

    // Сохраняем в API с debounce (если есть токен)
    if (token) {
      saveToAPI(false);
    }
  }

  // Toolbar actions (simple MVP using execCommand)
  function exec(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    persistContent();
  }

  function execBlock(tag: 'P' | 'H1' | 'H2' | 'H3' | 'BLOCKQUOTE' | 'PRE') {
    document.execCommand('formatBlock', false, tag);
    persistContent();
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

  function setColor(color: string) {
    document.execCommand('foreColor', false, color);
    persistContent();
  }

  function setBackColor(color: string) {
    document.execCommand('hiliteColor', false, color);
    persistContent();
  }

  function setFontFamily(fontFamily: string) {
    document.execCommand('fontName', false, fontFamily);
    persistContent();
  }

  function clearFormatting() {
    document.execCommand('removeFormat', false);
    document.execCommand('unlink', false);
    persistContent();
  }

  function handleEditorPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (html) {
      document.execCommand('insertHTML', false, sanitizePastedRichHtml(html));
      persistContent();
      return;
    }
    document.execCommand('insertText', false, text || '');
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

  function addColumnRightFromContext() {
    const ctx = tableContextRef.current;
    if (!ctx) return;
    const table = ctx.table;
    const headRow = table.querySelector('thead tr');
    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    const currentCols = headRow ? headRow.children.length : (bodyRows[0]?.children.length || 1);
    const nextCols = currentCols + 1;
    const cg = ensureColgroup(table, nextCols);
    const colEls = cg ? (Array.from(cg.querySelectorAll('col')) as HTMLTableColElement[]) : [];

    // ширина нового столбца
    const newCol = colEls[nextCols - 1];
    if (newCol && !newCol.style.width) newCol.style.width = '120px';

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
      const newWidth = Math.max(48, Math.round(state.startWidth + delta));
      const col = state.table.querySelectorAll('colgroup col')[state.colIndex] as HTMLTableColElement | undefined;
      if (!col) return;
      col.style.width = `${newWidth}px`;
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

  function addCustomTab() {
    if (!currentClientId) return;
    const name = prompt('Название новой вкладки:')?.trim();
    if (!name) return;
    const next = Array.from(new Set([...tabs, name]));
    try { localStorage.setItem(tabsKey(currentClientId), JSON.stringify(next)); } catch {}
    if (token) saveTabsToAPI(next);
    setActiveTab(name);
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
    <main style={{ 
      flex: 1, 
      padding: 0, 
      minWidth: 0, 
      overflow: 'hidden', 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      position: 'relative' 
    }}>
        {/* Top Header Bar with Client Selector */}
        <div
          data-tour="workarea-header"
          style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: 16, 
          padding: '12px 20px',
          borderBottom: `1px solid ${ui.border}`,
          background: ui.panel,
          flexShrink: 0
        }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--text)' }}>{t('workArea.title')}</h1>
            
            {/* Client Selector */}
            {!restrictedClientId && currentClient && (
              <div style={{ position: 'relative' }} data-clients-dropdown>
                <button
                  onClick={() => setShowClientsDropdown(!showClientsDropdown)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    minWidth: 200
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--surface)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--surface-2)';
                  }}
                >
                  {getAvatarUrl(currentClient.avatarUrl || currentClient.profile?.avatarUrl, currentClient.id) ? (
                    <img
                      src={getAvatarUrl(currentClient.avatarUrl || currentClient.profile?.avatarUrl, currentClient.id) || ''}
                      alt={currentClient.name || 'Аватар'}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid rgba(255,255,255,0.1)',
                        flexShrink: 0
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.avatar-fallback')) {
                          const fallback = document.createElement('div');
                          fallback.className = 'avatar-fallback';
                          fallback.style.cssText = 'width: 40px; height: 40px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 700; font-size: 16px; flex-shrink: 0;';
                          fallback.textContent = (currentClient.name || '?').trim().charAt(0).toUpperCase();
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0b0f1a', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                      {(currentClient.name || '?').trim().charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0, textAlign: 'left', flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{currentClient.name || 'Клиент'}</div>
                    <div className="small" style={{ fontSize: 12, opacity: .8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{currentClient.email || '—'}</div>
                  </div>
                  <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0 }}>▼</span>
                </button>
                {showClientsDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    minWidth: 280,
                    maxWidth: 400,
                    background: 'var(--surface)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12,
                    maxHeight: 400,
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    padding: '8px'
                  }}>
                    {clients.map(c => {
                      const active = c.id === currentClientId;
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            setCurrentClientId(c.id);
                            setShowClientsDropdown(false);
                            setExpanded(false); // Показываем панель вкладок при выборе клиента
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px',
                            borderRadius: 8,
                            border: 'none',
                            background: active ? ui.activeBg : 'transparent',
                            color: 'var(--text)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (!active) {
                              e.currentTarget.style.background = ui.hover;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!active) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          {getAvatarUrl(c.avatarUrl || c.profile?.avatarUrl, c.id) ? (
                            <img
                              src={getAvatarUrl(c.avatarUrl || c.profile?.avatarUrl, c.id) || ''}
                              alt={c.name || 'Аватар'}
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '2px solid rgba(255,255,255,0.1)',
                                flexShrink: 0
                              }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent && !parent.querySelector('.avatar-fallback')) {
                                  const fallback = document.createElement('div');
                                  fallback.className = 'avatar-fallback';
                                  fallback.style.cssText = 'width: 40px; height: 40px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 700; font-size: 16px; flex-shrink: 0;';
                                  fallback.textContent = (c.name || '?').trim().charAt(0).toUpperCase();
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0b0f1a', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                              {(c.name || '?').trim().charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{c.name || 'Клиент'}</div>
                            <div className="small" style={{ fontSize: 12, opacity: .8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{c.email || '—'}</div>
                          </div>
                        </button>
                      );
                    })}
                    {clients.length === 0 && (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                        Нет клиентов
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {restrictedClientId && currentClient && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                padding: '6px 12px', 
                borderRadius: 8,
                background: isLightTheme ? '#e9ecef' : 'var(--surface-2)'
              }}>
                {getAvatarUrl(currentClient.avatarUrl || currentClient.profile?.avatarUrl, currentClient.id) ? (
                  <img
                    src={getAvatarUrl(currentClient.avatarUrl || currentClient.profile?.avatarUrl, currentClient.id) || ''}
                    key={`avatar-${currentClient.id}-${currentClient.avatarUrl || currentClient.profile?.avatarUrl || 'none'}`}
                    alt={currentClient.name || 'Аватар'}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid rgba(255,255,255,0.1)'
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.avatar-fallback')) {
                        const fallback = document.createElement('div');
                        fallback.className = 'avatar-fallback';
                        fallback.style.cssText = 'width: 24px; height: 24px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 700; font-size: 12px;';
                        fallback.textContent = (currentClient.name || '?').trim().charAt(0).toUpperCase();
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <div style={{ width: 24, height: 24, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0b0f1a', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>
                    {(currentClient.name || '?').trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{currentClient.name || 'Клиент'}</span>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <PsychologistTourHelpButton tourId="workArea" steps={PSYCHOLOGIST_WORK_AREA_TOUR_STEPS} userId={user?.id} role={user?.role} />
            {restrictedClientId && (
              <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>
                🔓 Режим админа
              </span>
            )}
          </div>
        </div>

        {/* Main Content Area: Sidebar (Tabs) + Editor */}
        <div style={{ 
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
                padding: '16px', 
                borderBottom: `1px solid ${ui.border}`,
                flexShrink: 0,
                overflow: 'hidden',
                opacity: expanded ? 0 : 1,
                transition: 'opacity 0.3s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                  <b style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', flex: 1 }}>Вкладки</b>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button 
                      className="button secondary" 
                      onClick={addCustomTab} 
                      style={{ 
                        padding: '4px 8px', 
                        fontSize: 12,
                        minWidth: 'auto',
                        lineHeight: 1
                      }}
                      title={t('workArea.addTab')}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '8px',
                minHeight: 0,
                opacity: expanded ? 0 : 1,
                transition: 'opacity 0.3s ease',
                overflow: expanded ? 'hidden' : 'auto'
              }}>
                {tabs.map(tab => {
                  const active = tab === activeTab;
                  const isDragged = draggedTab === tab;
                  const isDragOver = dragOverTab === tab;
                  return (
                    <div 
                      key={tab} 
                      style={{ 
                        marginBottom: 4,
                        opacity: isDragged ? 0.5 : 1,
                        transform: isDragOver ? 'translateX(4px)' : 'none',
                        transition: 'transform 0.2s'
                      }}
                      draggable
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
                          setActiveTab(tab);
                          if (isMobileView) {
                            setShowTabContent(true);
                          }
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
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ opacity: 0.5, fontSize: 12 }}>☰</span>
                            {tab}
                          </span>
                          <button 
                            title="Удалить вкладку" 
                            className="button secondary" 
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCustomTab(tab);
                            }} 
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 107, 107, 0.2)';
                              e.currentTarget.style.color = '#ff6b6b';
                              e.currentTarget.style.borderColor = 'rgba(255, 107, 107, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '';
                              e.currentTarget.style.color = '';
                              e.currentTarget.style.borderColor = '';
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
            {/* Tab header with title and buttons */}
            {(!isMobileView || showTabContent) && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 16px',
                background: ui.panel2,
                borderBottom: `1px solid ${ui.border}`,
                flexShrink: 0,
                position: 'relative'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  {isMobileView && (
                    <button
                      onClick={() => setShowTabContent(false)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        border: 'none',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        fontSize: 18,
                        flexShrink: 0
                      }}
                      title="Назад к вкладкам"
                    >
                      ←
                    </button>
                  )}
                  <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {activeTab}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }} />
              </div>
            )}
            {/* Mobile back button - removed, now in header above */}
            {false && isMobileView && showTabContent && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 16px',
                background: ui.panel2,
                borderBottom: `1px solid ${ui.border}`,
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <button
                    onClick={() => setShowTabContent(false)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      border: 'none',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      fontSize: 18,
                      flexShrink: 0
                    }}
                    title="Назад к вкладкам"
                  >
                    ←
                  </button>
                  <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {activeTab}
                  </div>
                </div>
                {/* Убрано: локальный переключатель темы рабочей области */}
              </div>
            )}

            {/* Toolbar (скрыт для вкладок без редактора) */}
            {activeTab !== 'Дневник клиента' && activeTab !== 'сны' && (
              <div style={{ 
                display: 'flex', 
                gap: 8, 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                flexShrink: 0, 
                background: ui.panel2, 
                borderBottom: `1px solid ${ui.border}`, 
                padding: '8px 12px',
                overflowX: 'auto',
                overflowY: 'visible',
                position: 'relative',
                zIndex: 5,
                boxShadow: isLightTheme ? '0 1px 0 rgba(15,23,42,0.05)' : '0 1px 0 rgba(255,255,255,0.05)'
              }}>
                {/* Группа: стиль и шрифт */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 6, borderRadius: 10, background: ui.panel, border: `1px solid ${ui.border}` }}>
                  <select
                    onChange={e => execBlock(e.target.value as any)}
                    defaultValue="P"
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: `1px solid ${ui.border}`,
                      background: ui.panel,
                      color: 'var(--text)',
                      fontSize: 13,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                    title="Стиль"
                  >
                    <option value="P">Обычный</option>
                    <option value="H1">Заголовок 1</option>
                    <option value="H2">Заголовок 2</option>
                    <option value="H3">Заголовок 3</option>
                    <option value="BLOCKQUOTE">Цитата</option>
                    <option value="PRE">Код</option>
                  </select>
                  <select
                    onChange={e => setFontFamily(e.target.value)}
                    defaultValue="Arial"
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: `1px solid ${ui.border}`,
                      background: ui.panel,
                      color: 'var(--text)',
                      fontSize: 13,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                    title="Шрифт"
                  >
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Trebuchet MS">Trebuchet MS</option>
                    <option value="Courier New">Courier New</option>
                  </select>
                </div>

                {/* Группа: начертание */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 6, borderRadius: 10, background: ui.panel, border: `1px solid ${ui.border}` }}>
                  <button className="button secondary" onClick={() => exec('bold')} style={{ padding: '6px 10px', fontSize: 13, fontWeight: 'bold' }} title="Жирный">B</button>
                  <button className="button secondary" onClick={() => exec('italic')} style={{ padding: '6px 10px', fontSize: 13, fontStyle: 'italic' }} title="Курсив">I</button>
                  <button className="button secondary" onClick={() => exec('underline')} style={{ padding: '6px 10px', fontSize: 13, textDecoration: 'underline' }} title="Подчёркнутый">U</button>
                  <button className="button secondary" onClick={() => exec('strikeThrough')} style={{ padding: '6px 10px', fontSize: 13, textDecoration: 'line-through' }} title="Зачёркнутый">S</button>
                </div>

                {/* Группа: списки и выравнивание */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 6, borderRadius: 10, background: ui.panel, border: `1px solid ${ui.border}` }}>
                  <button className="button secondary" onClick={() => exec('insertUnorderedList')} style={{ padding: '6px 10px', fontSize: 13 }} title="Маркированный список">•</button>
                  <button className="button secondary" onClick={() => exec('insertOrderedList')} style={{ padding: '6px 10px', fontSize: 13 }} title="Нумерованный список">1.</button>
                  <div style={{ width: 1, height: 22, background: ui.border, margin: '0 4px' }} />
                  <button className="button secondary" onClick={() => exec('justifyLeft')} style={{ padding: '6px 10px', fontSize: 13 }} title="По левому краю">⟸</button>
                  <button className="button secondary" onClick={() => exec('justifyCenter')} style={{ padding: '6px 10px', fontSize: 13 }} title="По центру">≡</button>
                  <button className="button secondary" onClick={() => exec('justifyRight')} style={{ padding: '6px 10px', fontSize: 13 }} title="По правому краю">⟹</button>
                  <button className="button secondary" onClick={() => exec('justifyFull')} style={{ padding: '6px 10px', fontSize: 13 }} title="По ширине">⟷</button>
                </div>

                {/* Группа: ссылки и цвет */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: 6, borderRadius: 10, background: ui.panel, border: `1px solid ${ui.border}` }}>
                  <button className="button secondary" onClick={insertLink} style={{ padding: '6px 10px', fontSize: 13 }} title="Вставить ссылку">🔗</button>
                  <button className="button secondary" onClick={removeLink} style={{ padding: '6px 10px', fontSize: 13 }} title="Удалить ссылку">🔗✕</button>
                  <div style={{ width: 1, height: 22, background: ui.border }} />
                  <button
                    ref={tablePickerButtonRef}
                    className="button secondary"
                    onClick={() => {
                      setTablePickerOpen(v => !v);
                      setTablePickerHover({ rows: 4, cols: 4 });
                      // позиция пересчитается эффектом при открытии
                    }}
                    style={{ padding: '6px 10px', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    title="Вставить таблицу"
                  >
                    Таблица <span style={{ opacity: 0.7 }}>▾</span>
                  </button>
                  <div style={{ width: 1, height: 22, background: ui.border }} />
                  <label className="small" style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    Текст
                    <input type="color" title="Цвет текста" onChange={e => setColor(e.target.value)} style={{ height: 28, width: 32, border: `1px solid ${ui.border}`, borderRadius: 8, cursor: 'pointer', background: ui.panel }} />
                  </label>
                  <label className="small" style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    Фон
                    <input type="color" title="Цвет фона" onChange={e => setBackColor(e.target.value)} style={{ height: 28, width: 32, border: `1px solid ${ui.border}`, borderRadius: 8, cursor: 'pointer', background: ui.panel }} />
                  </label>
                  <div style={{ width: 1, height: 22, background: ui.border }} />
                  <button className="button secondary" onClick={deleteCurrentTable} style={{ padding: '6px 10px', fontSize: 13 }} title="Удалить таблицу">
                    Удалить таблицу
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
                      <div className="small" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                        После вставки потяните за правый‑нижний угол, чтобы изменить размер таблицы.
                      </div>
                    </div>,
                    document.body
                  )}
                </div>

                {/* Группа: история и очистка */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 6, borderRadius: 10, background: ui.panel, border: `1px solid ${ui.border}` }}>
                  <button className="button secondary" onClick={() => exec('undo')} style={{ padding: '6px 10px', fontSize: 13 }} title="Отменить">↶</button>
                  <button className="button secondary" onClick={() => exec('redo')} style={{ padding: '6px 10px', fontSize: 13 }} title="Повторить">↷</button>
                  <div style={{ width: 1, height: 22, background: ui.border, margin: '0 4px' }} />
                  <button className="button secondary" onClick={clearFormatting} style={{ padding: '6px 10px', fontSize: 13, fontWeight: 600 }} title="Очистить формат">
                    Очистить формат
                  </button>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span
                    className="small"
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: 12,
                      minWidth: 92,
                      textAlign: 'right',
                      visibility: saving ? 'visible' : 'hidden'
                    }}
                  >
                    {t('workArea.saving')}
                  </span>
                  <button className="button" onClick={() => saveToAPI(true)} style={{ padding: '6px 12px', fontSize: 13 }}>{t('workArea.save')}</button>
                </div>
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
                  <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📔</div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Дневник клиента пуст</div>
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
                  <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🌙</div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Снов пока нет</div>
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
            ) : (
              <div style={{ 
                flex: 1, 
                minHeight: 0, 
                position: 'relative', 
                display: 'flex', 
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                {loading && (
                  <div style={{ 
                    position: 'absolute', 
                    top: 20, 
                    left: 24, 
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
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onMouseDown={onEditorMouseDown}
                  onContextMenu={onEditorContextMenu}
                  onKeyDown={onEditorKeyDown}
                  onInput={persistContent}
                  onPaste={handleEditorPaste}
                  className="workarea-editor"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    background: isLightTheme ? '#ffffff' : 'var(--surface-1)',
                    padding: '48px 60px',
                    lineHeight: 1.8,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    opacity: loading ? 0.5 : 1,
                    fontSize: 15,
                    color: isLightTheme ? '#1a1a1a' : 'var(--text)',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                    maxWidth: '100%',
                    wordWrap: 'break-word'
                  }}
                />
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
              </div>
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


