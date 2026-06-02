import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';
import { readableTextOnBackground } from '../../lib/colorContrast';
import { usePsychologistPlatformTour } from '../../hooks/usePsychologistPlatformTour';
import { PSYCHOLOGIST_CLIENTS_TOUR_STEPS } from '../../lib/psychologistPlatformTourSteps';
import { PsychologistTourHelpButton } from '../../components/PsychologistTourHelpButton';

const fieldBorder = '1px solid var(--navbar-edge)';

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s ?? '').trim());
}

export default function ClientsList() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [tags, setTags] = useState<{ label: string; color: string }[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagColor, setTagColor] = useState('#7c5cff');
  const [showModal, setShowModal] = useState(false);
  const [clientView, setClientView] = useState<'active' | 'archive'>('active');
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editTags, setEditTags] = useState<{ label: string; color: string }[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [editTagColor, setEditTagColor] = useState('#7c5cff');
  const [savingEdit, setSavingEdit] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createdClientLink, setCreatedClientLink] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const location = useLocation();
  function saveItemsToStorage(data: any[]) {
    try { localStorage.setItem('clients.items', JSON.stringify(data)); } catch {}
  }
  function readItemsFromStorage(): any[] {
    try {
      const raw = localStorage.getItem('clients.items');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  function readOverrides(): Record<string, any> {
    try { const raw = localStorage.getItem('clients.overrides'); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  }
  function saveOverrides(map: Record<string, any>) {
    try { localStorage.setItem('clients.overrides', JSON.stringify(map)); } catch {}
  }
  function saveDeletedToStorage(ids: string[]) {
    try { localStorage.setItem('clients.deletedIds', JSON.stringify(ids)); } catch {}
  }
  function readDeletedFromStorage(): string[] {
    try {
      const raw = localStorage.getItem('clients.deletedIds');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch { return []; }
  }

  // Tag system: presets, selection and mode
  const PRESET_TAGS: { label: string; color: string }[] = [
    { label: 'Тревога', color: '#ffcc66' },
    { label: 'PTSD', color: '#ff6b6b' },
    { label: 'Сноведение', color: '#19e0ff' },
    { label: 'Депрессия', color: '#7c5cff' },
    { label: 'Анима', color: '#00d1b2' },
    { label: 'Тень', color: '#ff8b94' },
  ];
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  function hashColorFromLabel(label: string): string {
    const palette = ['#ff6b6b', '#ffcc66', '#19e0ff', '#7c5cff', '#3ddc97', '#f08cff', '#ffd166'];
    let h = 0;
    for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }
  function getColorForLabel(label: string): string {
    const preset = PRESET_TAGS.find(t => t.label.toLowerCase() === label.trim().toLowerCase());
    return preset?.color || hashColorFromLabel(label);
  }

  function isArchivedClient(c: any) {
    return Boolean(c.therapyEndedAt);
  }

  async function load(view: 'active' | 'archive' = clientView) {
    const demo: any[] = [
      { id: 'c1', name: 'Иван Петров', email: 'ivan@example.com', phone: '+7 900 111-22-33', age: 34, city: 'Москва', tags: [{ label: 'PTSD', color: '#ff6b6b' }, { label: 'Сноведение', color: '#19e0ff' }] },
      { id: 'c2', name: 'Анна Смирнова', email: 'anna@example.com', phone: '+7 900 222-33-44', age: 29, city: 'СПб', tags: [{ label: 'Тревога', color: '#ffcc66' }] },
      { id: 'c3', name: 'Мария Коваль', email: 'maria@example.com', phone: '+7 900 333-44-55', age: 41, city: 'Казань', tags: [{ label: 'Депрессия', color: '#7c5cff' }] },
    ];
    const stored = readItemsFromStorage();
    const deletedIds = new Set(readDeletedFromStorage());
    if (!token) {
      const local = (stored.length > 0 ? stored : demo)
        .filter(c => !deletedIds.has(String(c.id)))
        .filter(c => view === 'archive' ? isArchivedClient(c) : !isArchivedClient(c));
      setItems(local);
      setError(null);
      return;
    }
    try {
      const res = await api<{ items: any[] }>(`/api/clients?status=${view}`, { token });
      const enriched = (res.items || []).map((c) => ({
        ...c,
        tags: Array.isArray(c.tags) ? c.tags : []
      }));
      // apply local overrides (e.g., custom tags) for server ids
      const overrides = readOverrides();
      const withOverrides = enriched.map(c => overrides[c.id] ? { ...c, ...overrides[c.id] } : c);
      // merge stored local clients (created offline) with server ones by id
      // Приоритет у данных с сервера - они идут первыми
      const serverIds = new Set(withOverrides.map(c => String(c.id)));
      const byId: Record<string, any> = {};
      // Сначала добавляем данные с сервера (приоритет)
      withOverrides.forEach(it => { byId[String(it.id)] = it; });
      // Затем добавляем только локальные клиенты, которых нет на сервере (созданные оффлайн)
      stored.forEach(it => {
        if (!serverIds.has(String(it.id))) {
          const archived = isArchivedClient(it);
          if (view === 'archive' ? archived : !archived) {
            byId[String(it.id)] = it;
          }
        }
      });
      const combined = Object.values(byId)
        .filter(it => !deletedIds.has(String(it.id)))
        .filter(it => (view === 'archive' ? isArchivedClient(it) : !isArchivedClient(it)));
      setItems(combined.length > 0 ? combined : (view === 'archive' ? [] : demo));
      setError(null);
    } catch (e: any) {
      // backend not reachable or 404 -> show demo data
      const local = (stored.length > 0 ? stored : demo).filter(c => !deletedIds.has(String(c.id)));
      setItems(local);
      setError(null);
    }
  }

  // Check verification status
  useEffect(() => {
    if (!token) {
      setIsVerified(null);
      return;
    }
    
    checkVerification(token).then(result => {
      setIsVerified(result.isVerified);
      setVerificationStatus(result.status);
    });
  }, [token]);

  useEffect(() => {
    const updateViewport = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsNarrow(window.innerWidth <= 420);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (isVerified !== false) {
      load(clientView);
    }
  }, [token, isVerified, clientView]);

  // Обновление данных при возврате на страницу
  useEffect(() => {
    if (isVerified !== false) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isVerified]);

  // Обновление данных при фокусе окна (когда пользователь возвращается на вкладку)
  useEffect(() => {
    const handleFocus = () => {
      if (isVerified !== false && token) {
        load();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isVerified]);

  // Initialize tag filters from URL or localStorage
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlTags = params.get('tags');
    const stored = localStorage.getItem('clients.tagFilter');
    if (urlTags) setSelectedTags(urlTags.split(',').filter(Boolean));
    else if (stored) {
      try { const parsed = JSON.parse(stored); if (Array.isArray(parsed?.tags)) setSelectedTags(parsed.tags); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist tag filters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (selectedTags.length > 0) params.set('tags', selectedTags.join(',')); else params.delete('tags');
    const qs = params.toString();
    window.history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}`);
    localStorage.setItem('clients.tagFilter', JSON.stringify({ tags: selectedTags }));
  }, [selectedTags, location.pathname, location.search]);

  usePsychologistPlatformTour({
    tourId: 'clients',
    userId: user?.id,
    role: user?.role,
    enabled: Boolean(token && user?.role === 'psychologist' && isVerified === true),
    steps: PSYCHOLOGIST_CLIENTS_TOUR_STEPS
  });

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalizedTags = tags.map(t => ({ label: t.label.trim(), color: t.color }));
    const newClient = { id: Math.random().toString(36).slice(2), name, email, phone, age: age ? Number(age) : undefined, city, tags: normalizedTags };
    if (!token) {
      if (!isValidEmail(email)) {
        setError('Укажите корректный email');
        return;
      }
      // local add in demo mode
      setItems(prev => { const next = [newClient, ...prev]; saveItemsToStorage(next); return next; });
      // ensure new id is not considered deleted
      const ids = readDeletedFromStorage().filter(x => x !== newClient.id);
      saveDeletedToStorage(ids);
      setName(''); setEmail(''); setPhone(''); setAge(''); setCity(''); setTags([]); setTagInput('');
      setShowModal(false);
      return;
    }
    if (!isValidEmail(email)) {
      setError('Укажите корректный email — клиент войдёт в аккаунт по этой почте');
      return;
    }
    try {
      const created = await api<any>('/api/clients', { method: 'POST', token: token, body: { name, email, phone, age: age ? Number(age) : undefined, city, tags: normalizedTags } });
      const serverId = created?.id || newClient.id;
      const clientFinal = {
        ...newClient,
        id: serverId,
        email: created?.email ?? email,
        registrationPending: Boolean(created?.registrationToken),
        registrationLink: created?.registrationLink ?? null,
        platformRegistered: false
      };
      setItems(prev => { const next = [clientFinal, ...prev.filter(c => c.id !== serverId)]; saveItemsToStorage(next); return next; });
      const ids = readDeletedFromStorage().filter(x => x !== serverId);
      saveDeletedToStorage(ids);
      // store overrides for server entity (e.g., tags, city, age) to prevent fallback overwriting
      const overrides = readOverrides();
      overrides[serverId] = { tags: normalizedTags, city, age: age ? Number(age) : undefined };
      saveOverrides(overrides);
      setName(''); setEmail(''); setPhone(''); setAge(''); setCity(''); setTags([]); setTagInput('');
      setShowModal(false);
      
      // Показываем ссылку для регистрации
      if (created?.registrationLink) {
        setCreatedClientLink(created.registrationLink);
        setShowLinkModal(true);
      }
    } catch (e: any) {
      setError(e?.message || 'Не удалось создать клиента');
    }
  }

  async function copyText(text: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const input = document.createElement('input');
        input.value = text;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
    } catch {
      // ignore
    }
  }

  async function endTherapy(id: string, name?: string) {
    const label = name ? `«${name}»` : 'этого клиента';
    if (!confirm(`Завершить терапию с клиентом ${label}?\n\nКлиент останется на платформе и будет перенесён в архив. Его можно будет вернуть из архива.`)) {
      return;
    }
    if (!token) {
      setItems(prev => {
        const next = prev.map(c => c.id === id ? { ...c, therapyEndedAt: new Date().toISOString() } : c);
        saveItemsToStorage(next);
        return next.filter(c => clientView === 'archive' ? isArchivedClient(c) : !isArchivedClient(c));
      });
      return;
    }
    try {
      await api(`/api/clients/${id}/end-therapy`, { method: 'POST', token });
      const endedAt = new Date().toISOString();
      const stored = readItemsFromStorage();
      if (stored.some(c => String(c.id) === String(id))) {
        saveItemsToStorage(
          stored.map(c => (String(c.id) === String(id) ? { ...c, therapyEndedAt: endedAt } : c))
        );
      }
      setClientView('archive');
      await load('archive');
    } catch (e: any) {
      setError(e?.message || 'Не удалось завершить терапию');
    }
  }

  async function restoreTherapy(id: string, name?: string) {
    const label = name ? `«${name}»` : 'этого клиента';
    if (!confirm(`Вернуть клиента ${label} в активные?`)) return;
    if (!token) {
      setItems(prev => {
        const next = prev.map(c => c.id === id ? { ...c, therapyEndedAt: null } : c);
        saveItemsToStorage(next);
        return next.filter(c => clientView === 'archive' ? isArchivedClient(c) : !isArchivedClient(c));
      });
      return;
    }
    try {
      await api(`/api/clients/${id}/restore-therapy`, { method: 'POST', token });
      const stored = readItemsFromStorage();
      if (stored.some(c => String(c.id) === String(id))) {
        saveItemsToStorage(
          stored.map(c => (String(c.id) === String(id) ? { ...c, therapyEndedAt: null } : c))
        );
      }
      setClientView('active');
      await load('active');
    } catch (e: any) {
      setError(e?.message || 'Не удалось вернуть клиента');
    }
  }

  function openEditClient(c: any) {
    setEditingClient(c);
    setEditName(c.name || '');
    setEditPhone(c.phone || '');
    setEditAge(c.age != null ? String(c.age) : '');
    setEditCity(c.city || '');
    setEditTags(Array.isArray(c.tags) ? c.tags.map((t: any) => ({ label: String(t.label), color: t.color || getColorForLabel(String(t.label)) })) : []);
    setEditTagInput('');
  }

  function closeEditClient() {
    setEditingClient(null);
    setSavingEdit(false);
  }

  function addEditTag(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = editTagInput.trim();
    if (!trimmed) return;
    const color = editTagColor || getColorForLabel(trimmed);
    setEditTags(prev => [...prev, { label: trimmed, color }]);
    setEditTagInput('');
  }

  function removeEditTag(index: number) {
    setEditTags(prev => prev.filter((_, i) => i !== index));
  }

  async function saveEditClient(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClient) return;
    const normalizedTags = editTags.map(t => ({ label: t.label.trim(), color: t.color }));
    const body = {
      name: editName.trim(),
      phone: editPhone.trim() || null,
      age: editAge ? Number(editAge) : null,
      city: editCity.trim() || null,
      tags: normalizedTags
    };
    if (!body.name) {
      setError('Укажите имя клиента');
      return;
    }
    setSavingEdit(true);
    setError(null);
    if (!token) {
      setItems(prev => {
        const next = prev.map(c => c.id === editingClient.id ? { ...c, ...body } : c);
        saveItemsToStorage(next);
        const overrides = readOverrides();
        overrides[editingClient.id] = { tags: normalizedTags, city: body.city, age: body.age };
        saveOverrides(overrides);
        return next;
      });
      closeEditClient();
      return;
    }
    try {
      const updated = await api<any>(`/api/clients/${editingClient.id}`, {
        method: 'PATCH',
        token,
        body
      });
      setItems(prev => prev.map(c => c.id === editingClient.id ? { ...c, ...updated, tags: normalizedTags } : c));
      const overrides = readOverrides();
      overrides[editingClient.id] = { tags: normalizedTags, city: body.city, age: body.age };
      saveOverrides(overrides);
      closeEditClient();
    } catch (err: any) {
      setError(err?.message || 'Не удалось сохранить изменения');
    } finally {
      setSavingEdit(false);
    }
  }

  function addTag(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    const color = tagColor || getColorForLabel(trimmed);
    setTags(prev => [...prev, { label: trimmed, color }]);
    setTagInput('');
  }

  function removeTag(index: number) {
    setTags(prev => prev.filter((_, i) => i !== index));
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    // Search is handled by the query state and filteredItems logic below
  }

  // Derived: all tags in dataset and filtered items
  const allExistingTags: string[] = Array.from(new Set(items.flatMap(c => (Array.isArray(c.tags) ? c.tags.map((t: any) => String(t.label)) : []))));
  const filtersToUse = Array.from(new Set([...selectedTags]));
  const queryLower = query.toLowerCase().trim();
  const filteredItems = items.filter(c => {
    // Filter by tags
    if (filtersToUse.length > 0) {
      const labels: string[] = Array.isArray(c.tags) ? c.tags.map((t: any) => String(t.label)) : [];
      if (!filtersToUse.some(t => labels.includes(t))) return false;
    }
    // Filter by query (search in name, email, phone, city)
    if (queryLower) {
      const searchable = [
        c.name || '',
        c.email || '',
        c.phone || '',
        c.city || '',
        ...(Array.isArray(c.tags) ? c.tags.map((t: any) => String(t.label)) : [])
      ].join(' ').toLowerCase();
      if (!searchable.includes(queryLower)) return false;
    }
    return true;
  });

  // Show verification required message
  if (token && isVerified === false) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PsychologistNavbar />
        <VerificationRequired verificationStatus={verificationStatus} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      <main style={{ flex: 1, padding: isNarrow ? '12px 12px 16px' : isMobile ? '16px 16px 20px' : '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', alignItems: 'center', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 14 : 32 }}>
          <div data-tour="clients-header">
            <h1 style={{ margin: 0, fontSize: isNarrow ? 22 : isMobile ? 26 : 32, fontWeight: 800, marginBottom: isMobile ? 4 : 8 }}>Мои клиенты</h1>
            <form onSubmit={onSearch} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: isMobile ? 8 : 12, maxWidth: isMobile ? '100%' : 600 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 10, top: isMobile ? 8 : 10, opacity: .7 }}>🔎</span>
                <input style={{ width: '100%', padding: isMobile ? '8px 10px 8px 30px' : '10px 12px 10px 34px', borderRadius: 12, border: fieldBorder, background: 'var(--surface-2)', color: 'var(--text)', minWidth: 0, fontSize: isMobile ? 14 : 15 }} placeholder="Поиск: клиенты, сны, архетипы" value={query} onChange={e => setQuery(e.target.value)} />
              </div>
            </form>
          </div>
          <div data-tour="clients-add" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
            <PsychologistTourHelpButton tourId="clients" steps={PSYCHOLOGIST_CLIENTS_TOUR_STEPS} userId={user?.id} role={user?.role} />
            <button className={isMobile ? 'button secondary' : 'button secondary'} onClick={() => load()} style={{ padding: isMobile ? '8px 10px' : '10px 20px', minWidth: isMobile ? 44 : undefined }} title="Обновить данные">🔄</button>
            {clientView === 'active' && (
              <button className="button" onClick={() => setShowModal(true)} style={{ padding: isMobile ? '8px 12px' : '10px 20px', fontSize: isMobile ? 14 : 15 }}>Добавить клиента</button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={clientView === 'active' ? 'button' : 'button secondary'}
              onClick={() => setClientView('active')}
              style={{ padding: '8px 14px', fontSize: 13 }}
            >
              Активные
            </button>
            <button
              type="button"
              className={clientView === 'archive' ? 'button' : 'button secondary'}
              onClick={() => setClientView('archive')}
              style={{ padding: '8px 14px', fontSize: 13 }}
            >
              Архив
            </button>
          </div>
          <span className="small" style={{ color: 'var(--text-muted)' }}>
            {clientView === 'archive' ? 'Архив' : 'Активные'}: {filteredItems.length}
            <span style={{ opacity: .6 }}> / {items.length}</span>
          </span>
        </div>
        {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}

        {/* Tag filters */}
        <div data-tour="clients-tags" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, flexWrap: 'wrap' }}>
          <div className="small" style={{ opacity: .8, color: 'var(--text-muted)' }}>Фильтр по тегам:</div>
          {[...PRESET_TAGS, ...allExistingTags.filter(l => !PRESET_TAGS.some(p => p.label === l)).map(l => ({ label: l, color: getColorForLabel(l) }))].slice(0, 24).map(t => {
            const active = selectedTags.includes(t.label);
            const onColor = readableTextOnBackground(t.color);
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => setSelectedTags(prev => active ? prev.filter(x => x !== t.label) : [...prev, t.label])}
                style={{
                  padding: isMobile ? '4px 10px' : '5px 11px',
                  fontSize: isMobile ? 11 : 12,
                  fontWeight: 600,
                  borderRadius: 999,
                  cursor: 'pointer',
                  border: `2px solid ${t.color}`,
                  background: active ? t.color : 'var(--surface-2)',
                  color: active ? onColor : 'var(--text)',
                  boxShadow: active ? `0 2px 10px ${t.color}40` : 'none'
                }}
              >
                {t.label}
              </button>
            );
          })}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {selectedTags.length > 0 && <button className="button danger" onClick={() => setSelectedTags([])} style={{ padding: '4px 8px', fontSize: 12 }}>Сбросить</button>}
          </div>
        </div>

        <div data-tour="clients-grid" style={{ marginTop: 12, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: isMobile ? 10 : 14 }}>
          {filteredItems.map(c => (
            <div key={c.id} className="card" style={{ padding: isMobile ? 12 : 16, display: 'grid', gap: isMobile ? 8 : 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'center' }}>
                {getAvatarUrl(c.avatarUrl || c.profile?.avatarUrl, c.id) ? (
                  <img
                    src={getAvatarUrl(c.avatarUrl || c.profile?.avatarUrl, c.id) || ''}
                    key={`avatar-${c.id}-${c.avatarUrl || c.profile?.avatarUrl || 'none'}`}
                    alt={c.name || 'Аватар'}
                    style={{
                      width: isMobile ? 42 : 48,
                      height: isMobile ? 42 : 48,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: `2px solid var(--navbar-edge)`
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.avatar-fallback')) {
                        const fallback = document.createElement('div');
                        fallback.className = 'avatar-fallback';
                        fallback.style.cssText = 'width: 48px; height: 48px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #f8fafc; text-shadow: 0 1px 2px rgba(0,0,0,0.3); display: grid; place-items: center; font-weight: 800;';
                        fallback.textContent = (c.name || '?').trim().charAt(0).toUpperCase();
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <div style={{ width: isMobile ? 42 : 48, height: isMobile ? 42 : 48, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#f8fafc', textShadow: '0 1px 2px rgba(0,0,0,0.3)', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
                    {(c.name || '?').trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflowWrap: 'anywhere', fontSize: isMobile ? 21 : undefined }}>{c.name}</div>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>{c.city || '—'}{c.age ? ` • ${c.age} лет` : ''}</div>
                </div>
              </div>
              {c.registrationPending && c.registrationLink && (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    background: 'rgba(250, 204, 21, 0.14)',
                    border: '1px solid rgba(234, 179, 8, 0.45)'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: 'var(--text)' }}>Ожидает регистрации</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      readOnly
                      value={c.registrationLink}
                      title={c.registrationLink}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: fieldBorder,
                        background: 'var(--surface-2)',
                        color: 'var(--text)',
                        fontSize: 11
                      }}
                    />
                    <button
                      type="button"
                      className="button secondary"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      onClick={() => copyText(c.registrationLink)}
                    >
                      Копировать
                    </button>
                  </div>
                </div>
              )}
              {c.platformRegistered && !c.registrationPending && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.45)',
                    color: 'var(--text)'
                  }}
                >
                  Авторизован
                </div>
              )}
              {c.email && <div className="small" style={{ wordBreak: 'break-word', color: 'var(--text-muted)' }}>{c.email}</div>}
              {c.phone && <div className="small" style={{ color: 'var(--text-muted)' }}>{c.phone}</div>}
              {Array.isArray(c.tags) && c.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {c.tags.map((t: any, idx: number) => {
                    const hex = typeof t.color === 'string' && t.color.startsWith('#') ? t.color : getColorForLabel(String(t.label));
                    return (
                      <span
                        key={idx}
                        style={{
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontWeight: 600,
                          fontSize: 12,
                          color: 'var(--text)',
                          background: `color-mix(in srgb, ${hex} 20%, var(--surface-2))`,
                          border: `1px solid color-mix(in srgb, ${hex} 50%, var(--navbar-edge))`
                        }}
                      >
                        {t.label}
                      </span>
                    );
                  })}
                </div>
              )}
              {clientView === 'archive' && c.therapyEndedAt && (
                <div className="small" style={{ color: 'var(--text-muted)' }}>
                  Терапия завершена: {new Date(c.therapyEndedAt).toLocaleDateString('ru-RU')}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <Link to={`/clients/${c.id}/profile`} className="button secondary" style={{ padding: '6px 10px', fontSize: 13 }}>Профиль</Link>
                {clientView === 'active' && (
                  <Link to={`/psychologist/work-area?client=${c.id}`} className="button" style={{ padding: '6px 10px', fontSize: 13 }}>Рабочая область</Link>
                )}
                <button type="button" onClick={() => openEditClient(c)} className="button secondary" style={{ padding: '6px 10px', fontSize: 13 }}>
                  Изменить
                </button>
                {clientView === 'active' ? (
                  <button
                    type="button"
                    onClick={() => endTherapy(c.id, c.name)}
                    className="button secondary"
                    style={{ padding: '6px 10px', marginLeft: isMobile ? 0 : 'auto', fontSize: 13, borderColor: 'rgba(234, 179, 8, 0.5)' }}
                  >
                    Завершить терапию
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => restoreTherapy(c.id, c.name)}
                    className="button"
                    style={{ padding: '6px 10px', marginLeft: isMobile ? 0 : 'auto', fontSize: 13 }}
                  >
                    Вернуть в активные
                  </button>
                )}
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                {clientView === 'archive' ? 'Архив пуст' : 'Пока нет клиентов'}
              </div>
              <div className="small">
                {clientView === 'archive'
                  ? 'Здесь появятся клиенты, у которых вы завершили терапию.'
                  : 'Добавьте первого клиента с помощью кнопки «Добавить клиента».'}
              </div>
            </div>
          )}
        </div>

        {/* Modal for showing registration link */}
        {showLinkModal && createdClientLink && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.75)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', zIndex: 1001, padding: 16 }}>
            <div className="card" style={{ width: 'min(600px, 94vw)', padding: 24, border: fieldBorder, boxShadow: '0 20px 60px rgba(0,0,0,0.45)', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 20 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Клиент создан!</div>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>Отправьте эту ссылку клиенту для регистрации</div>
                </div>
                <button className="button secondary" onClick={() => { setShowLinkModal(false); setCreatedClientLink(null); }} style={{ padding: '6px 10px', fontSize: 13 }}>✕</button>
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <div className="small" style={{ marginBottom: 8, color: 'var(--text-muted)' }}>Ссылка для регистрации:</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input 
                    readOnly
                    value={createdClientLink}
                    style={{ 
                      flex: 1, 
                      padding: '12px 16px', 
                      borderRadius: 10, 
                      border: fieldBorder, 
                      background: 'var(--surface-2)', 
                      color: 'var(--text)',
                      fontSize: 13,
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        // Пробуем использовать современный Clipboard API
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                          await navigator.clipboard.writeText(createdClientLink);
                          alert('Ссылка скопирована!');
                        } else {
                          // Fallback для старых браузеров
                          const input = document.createElement('input');
                          input.value = createdClientLink;
                          input.style.position = 'fixed';
                          input.style.opacity = '0';
                          document.body.appendChild(input);
                          input.select();
                          input.setSelectionRange(0, 99999);
                          document.execCommand('copy');
                          document.body.removeChild(input);
                          alert('Ссылка скопирована!');
                        }
                      } catch (err) {
                        console.error('Failed to copy:', err);
                        alert('Не удалось скопировать ссылку. Скопируйте её вручную из поля выше.');
                      }
                    }}
                    style={{ padding: '12px 20px', fontSize: 13, whiteSpace: 'nowrap' }}
                  >
                    Копировать
                  </button>
                </div>
              </div>
              
              <div style={{ padding: 12, background: 'rgba(91, 124, 250, 0.1)', borderRadius: 10, border: '1px solid rgba(91, 124, 250, 0.2)' }}>
                <div className="small" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  <strong>Важно:</strong> Клиент должен пройти регистрацию по этой ссылке, чтобы получить доступ к своему профилю. 
                  Ссылка действительна 7 дней.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal for editing client */}
        {editingClient && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.75)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
            <div
              className="card"
              style={{
                width: 'min(720px, 96vw)',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: isMobile ? 14 : 20,
                border: fieldBorder,
                borderRadius: 16
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontWeight: 800 }}>Изменить карточку клиента</div>
                <button type="button" className="button secondary" onClick={closeEditClient} style={{ padding: '6px 10px', fontSize: 13 }}>Закрыть</button>
              </div>
              {editingClient.email && (
                <div className="small" style={{ marginTop: 8, color: 'var(--text-muted)' }}>
                  Email (нельзя изменить): <strong style={{ color: 'var(--text)' }}>{editingClient.email}</strong>
                </div>
              )}
              <form onSubmit={saveEditClient} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                  <input placeholder="Имя *" value={editName} onChange={e => setEditName(e.target.value)} required style={{ padding: '10px 12px', borderRadius: 10, border: fieldBorder, background: 'var(--surface-2)', color: 'var(--text)' }} />
                  <input placeholder="Город" value={editCity} onChange={e => setEditCity(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: fieldBorder, background: 'var(--surface-2)', color: 'var(--text)' }} />
                  <input placeholder="Телефон" value={editPhone} onChange={e => setEditPhone(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: fieldBorder, background: 'var(--surface-2)', color: 'var(--text)' }} />
                  <input placeholder="Возраст" value={editAge} onChange={e => setEditAge(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: fieldBorder, background: 'var(--surface-2)', color: 'var(--text)' }} />
                </div>
                <div>
                  <div className="small" style={{ marginBottom: 6 }}>Теги</div>
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', alignItems: 'center' }}>
                    <input placeholder="Новый тег" value={editTagInput} onChange={e => setEditTagInput(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: fieldBorder, background: 'var(--surface-2)', color: 'var(--text)' }} />
                    <input type="color" value={editTagColor} onChange={e => setEditTagColor(e.target.value)} style={{ width: isMobile ? '100%' : 56, height: 38, padding: 0, border: 'none', background: 'transparent' }} />
                    <button type="button" className="button secondary" onClick={addEditTag} style={{ padding: '6px 10px', fontSize: 13 }}>Добавить тег</button>
                  </div>
                  {editTags.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {editTags.map((t, i) => (
                        <span key={`${t.label}-${i}`} style={{ padding: '4px 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text)', background: `color-mix(in srgb, ${t.color} 20%, var(--surface-2))`, border: `1px solid color-mix(in srgb, ${t.color} 50%, var(--navbar-edge))` }}>
                          {t.label}
                          <button type="button" onClick={() => removeEditTag(i)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button type="button" className="button secondary" onClick={closeEditClient} style={{ padding: '8px 12px', fontSize: 13 }}>Отмена</button>
                  <button className="button" type="submit" disabled={savingEdit} style={{ padding: '8px 12px', fontSize: 13 }}>
                    {savingEdit ? 'Сохранение…' : 'Сохранить'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal for adding client */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.75)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
            <div
              className="card"
              style={{
                width: 'min(720px, 96vw)',
                maxHeight: '90vh',
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: isMobile ? 14 : 20,
                border: fieldBorder,
                boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
                borderRadius: 16
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontWeight: 800 }}>Добавить клиента</div>
                <button className="button secondary" onClick={() => setShowModal(false)} style={{ padding: '6px 10px', fontSize: 13 }}>Закрыть</button>
              </div>
              <form onSubmit={createClient} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                <div>
                  <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Email *</div>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="client@mail.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: fieldBorder, background: 'var(--surface-2)', color: 'var(--text)' }}
                  />
                  <div className="small" style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                    По этой почте клиент зарегистрируется и будет входить в аккаунт
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                  <input placeholder="Имя *" value={name} onChange={e => setName(e.target.value)} required style={{ padding: '10px 12px', borderRadius: 10, border: fieldBorder, background: 'var(--surface-2)', color: 'var(--text)' }} />
                  <input placeholder="Город" value={city} onChange={e => setCity(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: fieldBorder, background: 'var(--surface-2)', color: 'var(--text)' }} />
                  <input placeholder="Телефон" value={phone} onChange={e => setPhone(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: fieldBorder, background: 'var(--surface-2)', color: 'var(--text)' }} />
                  <input placeholder="Возраст" value={age} onChange={e => setAge(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: fieldBorder, background: 'var(--surface-2)', color: 'var(--text)' }} />
                </div>
                <div>
                  <div className="small" style={{ marginBottom: 6 }}>Теги</div>
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', alignItems: 'center' }}>
                    <input placeholder="Новый тег" value={tagInput} onChange={e => setTagInput(e.target.value)} style={{ width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: 10, border: fieldBorder, background: 'var(--surface-2)', color: 'var(--text)' }} />
                    <input type="color" value={tagColor} onChange={e => setTagColor(e.target.value)} title="Цвет тега" style={{ width: isMobile ? '100%' : 56, height: 38, padding: 0, border: 'none', background: 'transparent' }} />
                    <button type="button" className="button secondary" onClick={addTag} style={{ padding: '6px 10px', fontSize: 13, width: isMobile ? '100%' : 'auto' }}>Добавить тег</button>
                  </div>
                  {/* Suggestions */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {PRESET_TAGS.map(s => (
                      <button
                        key={s.label}
                        type="button"
                        style={{
                          padding: '4px 10px',
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 999,
                          cursor: 'pointer',
                          border: `2px solid ${s.color}`,
                          background: 'var(--surface-2)',
                          color: 'var(--text)'
                        }}
                        onClick={() => { setTags(prev => [...prev, { label: s.label, color: s.color }]); }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {tags.map((t, i) => (
                        <span
                          key={`${t.label}-${i}`}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--text)',
                            background: `color-mix(in srgb, ${t.color} 20%, var(--surface-2))`,
                            border: `1px solid color-mix(in srgb, ${t.color} 50%, var(--navbar-edge))`
                          }}
                        >
                          {t.label}
                          <button type="button" onClick={() => removeTag(i)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                  <button type="button" className="button secondary" onClick={() => setShowModal(false)} style={{ padding: '8px 12px', fontSize: 13, width: isMobile ? '100%' : 'auto' }}>Отмена</button>
                  <button className="button" type="submit" style={{ padding: '8px 12px', fontSize: 13, width: isMobile ? '100%' : 'auto' }}>Создать</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
