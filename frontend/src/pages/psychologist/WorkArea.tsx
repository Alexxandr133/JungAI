import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';

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

type WorkAreaProps = {
  restrictedClientId?: string; // Если передан, показывать только этого клиента
  hideNavbar?: boolean; // Скрыть навбар (для использования внутри других компонентов)
  noPadding?: boolean; // Убрать padding (для использования внутри других компонентов)
};

export default function WorkArea({ restrictedClientId, hideNavbar = false, noPadding = false }: WorkAreaProps = {}) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [showClientsDropdown, setShowClientsDropdown] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [currentClientId, setCurrentClientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('Ведение клиента');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('workarea.theme') as any) || 'dark');
  const [expanded, setExpanded] = useState<boolean>(() => localStorage.getItem('workarea.expanded') === '1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const [journalEntries, setJournalEntries] = useState<Array<{ id: string; content: string; createdAt: string; updatedAt: string }>>([]);
  const [loadingJournal, setLoadingJournal] = useState(false);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);

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
      const demo: Client[] = [
        { id: 'c1', name: 'Иван Петров', email: 'ivan@example.com' },
        { id: 'c2', name: 'Анна Смирнова', email: 'anna@example.com' },
        { id: 'c3', name: 'Мария Коваль', email: 'maria@example.com' }
      ];
      if (!token) { setClients(demo); setCurrentClientId(prev => prev || demo[0].id); return; }
      try {
        const res = await api<{ items: any[] }>('/api/clients', { token: token ?? undefined });
        const items = (res.items || []).map(it => ({ 
          id: String(it.id), 
          name: it.name, 
          email: it.email,
          avatarUrl: it.avatarUrl || it.profile?.avatarUrl || null,
          profile: it.profile || null
        })) as any[];
        setClients(items.length ? items : demo);
        setCurrentClientId(prev => prev || (items[0]?.id || demo[0].id));
      } catch (error: any) {
        if (error.message?.includes('Verification required')) {
          setIsVerified(false);
          setClients([]);
        } else {
          setClients(demo);
          setCurrentClientId(prev => prev || demo[0].id);
        }
      }
    })();
  }, [token, restrictedClientId, isVerified]);

  // Preselect client from query parameter
  useEffect(() => {
    const url = new URL(window.location.href);
    const clientFromQuery = url.searchParams.get('client');
    if (!clientFromQuery) return;
    setCurrentClientId(prev => prev || clientFromQuery);
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

  // Load content when switching client/tab
  useEffect(() => {
    // Не загружаем контент, если не верифицирован
    if (isVerified === false) return;
    
    // Отменяем предыдущее сохранение при смене клиента/вкладки
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    // Пропускаем загрузку для вкладки "Дневник клиента"
    if (activeTab === 'Дневник клиента') return;
    
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

  function toggleTheme() {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('workarea.theme', next); } catch {}
      return next;
    });
  }

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
      height: noPadding ? '100%' : 'calc(100vh - 64px)', 
      position: 'relative' 
    }}>
        {/* Top Header Bar with Client Selector */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: 16, 
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'var(--surface)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--text)' }}>{t('workArea.title')}</h1>
            
            {/* Client Selector */}
            {!restrictedClientId && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                flex: 1, 
                minWidth: 0,
                maxWidth: 400
              }}>
                <span className="small" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t('workArea.clients')} ({clients.length}):</span>
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <input 
                    placeholder={`${t('common.search')} (${clients.length} клиентов)`} 
                    value={query} 
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => setShowClientsDropdown(true)}
                    onBlur={() => setTimeout(() => setShowClientsDropdown(false), 200)}
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      fontSize: 13, 
                      borderRadius: 8, 
                      border: '1px solid rgba(255,255,255,0.12)', 
                      background: 'var(--surface-2)', 
                      color: 'var(--text)',
                      outline: 'none',
                      cursor: 'pointer'
                    }} 
                  />
                  {showClientsDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8,
                      maxHeight: 400,
                      overflowY: 'auto',
                      zIndex: 100,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                      {clients
                        .filter(c => !query || (c.name || '').toLowerCase().includes(query.toLowerCase()) || (c.email || '').toLowerCase().includes(query.toLowerCase()))
                        .map(c => {
                        const active = c.id === currentClientId;
                        return (
                          <button 
                            key={c.id} 
                            onClick={() => {
                              setCurrentClientId(c.id);
                              setQuery('');
                              setShowClientsDropdown(false);
                            }} 
                            className={active ? 'button' : 'button secondary'} 
                            style={{ 
                              width: '100%',
                              justifyContent: 'flex-start', 
                              padding: '10px 12px', 
                              fontSize: 13, 
                              borderRadius: 0,
                              border: 'none',
                              borderBottom: '1px solid rgba(255,255,255,0.05)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                              {getAvatarUrl(c.avatarUrl || c.profile?.avatarUrl, c.id) ? (
                                <img
                                  src={getAvatarUrl(c.avatarUrl || c.profile?.avatarUrl, c.id) || ''}
                                  key={`avatar-${c.id}-${c.avatarUrl || c.profile?.avatarUrl || 'none'}`}
                                  alt={c.name || 'Аватар'}
                                  style={{
                                    width: 32,
                                    height: 32,
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
                                      fallback.style.cssText = 'width: 32px; height: 32px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 700; font-size: 14px; flex-shrink: 0;';
                                      fallback.textContent = (c.name || '?').trim().charAt(0).toUpperCase();
                                      parent.appendChild(fallback);
                                    }
                                  }}
                                />
                              ) : (
                                <div style={{ width: 32, height: 32, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0b0f1a', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                                  {(c.name || '?').trim().charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div style={{ minWidth: 0, textAlign: 'left', flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{c.name || 'Клиент'}</div>
                                <div className="small" style={{ fontSize: 12, opacity: .8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{c.email || '—'}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      {clients.filter(c => !query || (c.name || '').toLowerCase().includes(query.toLowerCase()) || (c.email || '').toLowerCase().includes(query.toLowerCase())).length === 0 && (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                          {query ? 'Клиенты не найдены' : 'Нет клиентов'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {currentClient && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  padding: '6px 12px', 
                  borderRadius: 8,
                  background: 'var(--surface-2)',
                  flexShrink: 0
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
                    <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--text)' }}>{currentClient.name || 'Клиент'}</span>
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
                background: theme === 'light' ? '#e9ecef' : 'var(--surface-2)'
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
            {restrictedClientId && (
              <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>
                🔓 Режим админа
              </span>
            )}
            <button className="button secondary" onClick={toggleTheme} style={{ padding: '8px 12px', fontSize: 13 }}>{theme === 'dark' ? '☀️' : '🌙'}</button>
            {!restrictedClientId && (
              <button className="button secondary" onClick={toggleExpanded} style={{ padding: '8px 12px', fontSize: 13 }}>{expanded ? '◀' : '▶'}</button>
            )}
          </div>
        </div>

        {/* Main Content Area: Sidebar (Tabs) + Editor */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: (expanded || restrictedClientId) ? '0 1fr' : '240px 1fr', 
          gap: 0, 
          flex: 1, 
          minHeight: 0, 
          overflow: 'hidden'
        }}>
          {/* Left Sidebar - Tabs */}
          {!restrictedClientId && (
            <div style={{ 
              display: expanded ? 'none' : 'flex',
              flexDirection: 'column',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              background: 'var(--surface-2)',
              overflow: 'hidden'
            }}>
              <div style={{ 
                padding: '16px', 
                borderBottom: theme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <b style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Вкладки</b>
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
              <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '8px',
                minHeight: 0
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
                      <button 
                        className={active ? 'button' : 'button secondary'} 
                        onClick={() => setActiveTab(tab)} 
                        style={{ 
                          width: '100%',
                          justifyContent: 'flex-start',
                          padding: '10px 12px', 
                          fontSize: 13,
                          textAlign: 'left',
                          position: 'relative',
                          borderRadius: 8,
                          cursor: isDragged ? 'grabbing' : 'grab',
                          border: isDragOver ? '2px dashed var(--primary)' : 'none'
                        }}
                      >
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
                            style={{ 
                              padding: '2px 6px', 
                              fontSize: 11,
                              minWidth: 'auto',
                              marginLeft: 8,
                              flexShrink: 0
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Right Side - Editor Area */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            minWidth: 0, 
            minHeight: 0, 
            overflow: 'hidden',
            background: 'var(--bg)'
          }}>

            {/* Toolbar (скрыт для вкладки "Дневник клиента") */}
            {activeTab !== 'Дневник клиента' && (
              <div style={{ 
                display: 'flex', 
                gap: 4, 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                flexShrink: 0, 
                background: 'var(--surface-2)', 
                borderBottom: '1px solid rgba(255,255,255,0.08)', 
                padding: '8px 12px',
                overflowX: 'auto'
              }}>
                <select 
                  onChange={e => execBlock(e.target.value as any)} 
                  defaultValue="P" 
                  style={{ 
                    padding: '6px 10px', 
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 13,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="P">Обычный</option>
                  <option value="H1">Заголовок 1</option>
                  <option value="H2">Заголовок 2</option>
                  <option value="H3">Заголовок 3</option>
                </select>
                <select 
                  onChange={e => setFontFamily(e.target.value)} 
                  defaultValue="Arial" 
                  style={{ 
                    padding: '6px 10px', 
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 13,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                  title="Шрифт"
                >
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Comic Sans MS">Comic Sans MS</option>
                  <option value="Trebuchet MS">Trebuchet MS</option>
                  <option value="Impact">Impact</option>
                </select>
              <button className="button secondary" onClick={() => exec('bold')} style={{ padding: '6px 10px', fontSize: 13, fontWeight: 'bold' }} title="Жирный">B</button>
              <button className="button secondary" onClick={() => exec('italic')} style={{ padding: '6px 10px', fontSize: 13, fontStyle: 'italic' }} title="Курсив">I</button>
              <button className="button secondary" onClick={() => exec('underline')} style={{ padding: '6px 10px', fontSize: 13, textDecoration: 'underline' }} title="Подчеркнутый">U</button>
              <button className="button secondary" onClick={() => exec('strikeThrough')} style={{ padding: '6px 10px', fontSize: 13, textDecoration: 'line-through' }} title="Зачеркнутый">S</button>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
              <button className="button secondary" onClick={() => exec('insertUnorderedList')} style={{ padding: '6px 10px', fontSize: 13 }} title="Маркированный список">•</button>
              <button className="button secondary" onClick={() => exec('insertOrderedList')} style={{ padding: '6px 10px', fontSize: 13 }} title="Нумерованный список">1.</button>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
              <button className="button secondary" onClick={() => execBlock('BLOCKQUOTE')} style={{ padding: '6px 10px', fontSize: 13 }}>“Цитата”</button>
              <button className="button secondary" onClick={() => execBlock('PRE')} style={{ padding: '6px 10px', fontSize: 13 }} title="Код">&lt;/&gt;</button>
              <button className="button secondary" onClick={() => exec('removeFormat')} style={{ padding: '6px 10px', fontSize: 13 }} title="Очистить форматирование">✕</button>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
              <button className="button secondary" onClick={() => exec('justifyLeft')} style={{ padding: '6px 10px', fontSize: 13 }} title="По левому краю">⟸</button>
              <button className="button secondary" onClick={() => exec('justifyCenter')} style={{ padding: '6px 10px', fontSize: 13 }} title="По центру">≡</button>
              <button className="button secondary" onClick={() => exec('justifyRight')} style={{ padding: '6px 10px', fontSize: 13 }} title="По правому краю">⟹</button>
              <button className="button secondary" onClick={() => exec('justifyFull')} style={{ padding: '6px 10px', fontSize: 13 }} title="По ширине">⟷</button>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
              <button className="button secondary" onClick={insertLink} style={{ padding: '6px 10px', fontSize: 13 }} title="Вставить ссылку">🔗</button>
              <button className="button secondary" onClick={removeLink} style={{ padding: '6px 10px', fontSize: 13 }} title="Удалить ссылку">🔗✕</button>
              <input type="color" title="Цвет текста" onChange={e => setColor(e.target.value)} style={{ height: 28, width: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
              <input type="color" title="Цвет фона" onChange={e => setBackColor(e.target.value)} style={{ height: 28, width: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
              <button className="button secondary" onClick={() => exec('undo')} style={{ padding: '6px 10px', fontSize: 13 }} title="Отменить">↶</button>
              <button className="button secondary" onClick={() => exec('redo')} style={{ padding: '6px 10px', fontSize: 13 }} title="Повторить">↷</button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                {saving && <span className="small" style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('workArea.saving')}</span>}
                <button className="button" onClick={() => saveToAPI(true)} style={{ padding: '6px 12px', fontSize: 13 }}>{t('workArea.save')}</button>
              </div>
            </div>
            )}

            {/* Editor or Journal Entries */}
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
                  onInput={persistContent}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    background: theme === 'light' ? '#ffffff' : 'var(--surface-1)',
                    padding: theme === 'light' ? '48px 60px' : '48px 60px',
                    lineHeight: 1.8,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    opacity: loading ? 0.5 : 1,
                    fontSize: 15,
                    color: theme === 'light' ? '#1a1a1a' : 'var(--text)',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                    maxWidth: '100%',
                    wordWrap: 'break-word'
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </main>
  );

  if (hideNavbar) {
    return content;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      {content}
    </div>
  );
}


