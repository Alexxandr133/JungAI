import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAppearance } from '../../context/AppearanceContext';
import { api } from '../../lib/api';
import { AdminNavbar } from '../../components/AdminNavbar';
import { AdminUserDetailModal } from '../../components/admin/AdminUserDetailModal';
import './admin.css';

const ROLE_LABELS: Record<string, string> = {
  psychologist: 'Психолог',
  client: 'Клиент',
  researcher: 'Исследователь',
  admin: 'Администратор',
  guest: 'Гость'
};

const ROLE_SORT_ORDER: Record<string, number> = {
  admin: 0,
  psychologist: 1,
  researcher: 2,
  client: 3,
  guest: 4,
};

type SortKey = 'name' | 'role' | 'lastSeen' | 'clients' | 'aiTokens' | 'createdAt';

function roleBadgeStyle(role: string, isLight: boolean): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap'
  };
  switch (role) {
    case 'admin':
      return { ...base, background: isLight ? 'rgba(220, 38, 38, 0.12)' : 'rgba(248, 113, 113, 0.16)', color: isLight ? '#b91c1c' : '#fca5a5' };
    case 'psychologist':
      return { ...base, background: isLight ? 'rgba(37, 99, 235, 0.1)' : 'rgba(59, 130, 246, 0.18)', color: '#3b82f6' };
    case 'client':
      return { ...base, background: isLight ? 'rgba(16, 185, 129, 0.1)' : 'rgba(52, 211, 153, 0.14)', color: '#059669' };
    case 'researcher':
      return { ...base, background: isLight ? 'rgba(124, 58, 237, 0.1)' : 'rgba(167, 139, 250, 0.16)', color: '#7c3aed' };
    case 'guest':
      return { ...base, background: isLight ? 'rgba(100, 116, 139, 0.12)' : 'rgba(148, 163, 184, 0.14)', color: '#64748b' };
    default:
      return { ...base, background: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' };
  }
}

type AdminUserRow = {
  id: string;
  email: string;
  role: string;
  aiTokenPlan: 'standard' | 'medium' | 'large';
  aiTokensUsed: number;
  aiTokensResetAt: string;
  aiModel: string | null;
  isVerified: boolean;
  createdAt: string;
  lastSeenAt?: string | null;
  profileName: string | null;
  clientCount?: number;
  linkedClient?: { id: string; name: string; psychologistId: string } | null;
};

type PsychOption = { id: string; email: string; name: string; isVerified: boolean };

type PlatformAiModelSettings = {
  model: string;
  options: string[];
};

type PlatformTranscriptionModelSettings = {
  model: string;
  options: Array<{ id: string; label: string; strategy: string }>;
};

function sortMarker(active: boolean, dir: 'asc' | 'desc') {
  if (!active) return ' ↕';
  return dir === 'asc' ? ' ↑' : ' ↓';
}

export default function AdminUserManagement() {
  const { token, user: me } = useAuth();
  const { appearance } = useAppearance();
  const isLight = appearance.colorMode === 'light';
  const borderSubtle = isLight ? '1px solid rgba(15, 23, 42, 0.1)' : '1px solid rgba(255, 255, 255, 0.1)';
  const borderInput = isLight ? '1px solid rgba(15, 23, 42, 0.14)' : '1px solid rgba(255, 255, 255, 0.12)';
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [psychOptions, setPsychOptions] = useState<PsychOption[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('lastSeen');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [pwdUser, setPwdUser] = useState<AdminUserRow | null>(null);
  const [pwd1, setPwd1] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [emailUser, setEmailUser] = useState<AdminUserRow | null>(null);
  const [emailDraft, setEmailDraft] = useState('');

  const [delUser, setDelUser] = useState<AdminUserRow | null>(null);
  const [transferTo, setTransferTo] = useState('');

  const [validateBusy, setValidateBusy] = useState(false);
  const [validateOk, setValidateOk] = useState<string | null>(null);
  const [platformAiModel, setPlatformAiModel] = useState('');
  const [platformAiOptions, setPlatformAiOptions] = useState<string[]>([]);
  const [platformAiBusy, setPlatformAiBusy] = useState(false);
  const [platformSttModel, setPlatformSttModel] = useState('');
  const [platformSttOptions, setPlatformSttOptions] = useState<PlatformTranscriptionModelSettings['options']>([]);
  const [platformSttBusy, setPlatformSttBusy] = useState(false);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const [qDebounced, setQDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 320);
    return () => clearTimeout(t);
  }, [q]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'role' ? 'asc' : 'desc');
    }
  }

  const sortedUsers = useMemo(() => {
    const list = [...users];
    const mul = sortDir === 'asc' ? 1 : -1;
    const nameOf = (u: AdminUserRow) => (u.profileName || u.email || '').toLocaleLowerCase('ru');
    const clientsOf = (u: AdminUserRow) => {
      if (u.role === 'psychologist' || u.role === 'admin') return u.clientCount ?? 0;
      return u.linkedClient ? 1 : 0;
    };
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = nameOf(a).localeCompare(nameOf(b), 'ru');
          break;
        case 'role':
          cmp = (ROLE_SORT_ORDER[a.role] ?? 99) - (ROLE_SORT_ORDER[b.role] ?? 99);
          if (cmp === 0) cmp = nameOf(a).localeCompare(nameOf(b), 'ru');
          break;
        case 'lastSeen': {
          const ta = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
          const tb = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
          cmp = ta - tb;
          break;
        }
        case 'clients':
          cmp = clientsOf(a) - clientsOf(b);
          break;
        case 'aiTokens':
          cmp = (a.aiTokensUsed || 0) - (b.aiTokensUsed || 0);
          if (cmp === 0) cmp = String(a.aiTokenPlan).localeCompare(String(b.aiTokenPlan));
          break;
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        default:
          cmp = 0;
      }
      return cmp * mul;
    });
    return list;
  }, [users, sortKey, sortDir]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (roleFilter) params.set('role', roleFilter);
        if (qDebounced.trim()) params.set('q', qDebounced.trim());
        const [u, p, modelSettings, sttSettings] = await Promise.all([
          api<{ items: AdminUserRow[] }>(`/api/admin/users?${params.toString()}`, { token }),
          api<{ items: PsychOption[] }>('/api/admin/users/psychologists-options', { token }),
          api<PlatformAiModelSettings>('/api/admin/users/settings/ai-model', { token }),
          api<PlatformTranscriptionModelSettings>('/api/admin/users/settings/transcription-model', { token })
        ]);
        if (cancelled) return;
        setUsers(u.items || []);
        setPsychOptions(p.items || []);
        setPlatformAiModel(modelSettings.model || '');
        setPlatformAiOptions(modelSettings.options || []);
        setPlatformSttModel(sttSettings.model || '');
        setPlatformSttOptions(sttSettings.options || []);
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error).message || 'Ошибка загрузки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, roleFilter, qDebounced]);

  async function refreshAll() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set('role', roleFilter);
      if (qDebounced.trim()) params.set('q', qDebounced.trim());
      const [u, p, modelSettings, sttSettings] = await Promise.all([
        api<{ items: AdminUserRow[] }>(`/api/admin/users?${params.toString()}`, { token }),
        api<{ items: PsychOption[] }>('/api/admin/users/psychologists-options', { token }),
        api<PlatformAiModelSettings>('/api/admin/users/settings/ai-model', { token }),
        api<PlatformTranscriptionModelSettings>('/api/admin/users/settings/transcription-model', { token })
      ]);
      setUsers(u.items || []);
      setPsychOptions(p.items || []);
      setPlatformAiModel(modelSettings.model || '');
      setPlatformAiOptions(modelSettings.options || []);
      setPlatformSttModel(sttSettings.model || '');
      setPlatformSttOptions(sttSettings.options || []);
    } catch (e: unknown) {
      setError((e as Error).message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  async function validateDreamSymbolsNow() {
    if (!token) return;
    setValidateBusy(true);
    setValidateOk(null);
    setError(null);
    try {
      const r = await api<{ success: boolean; sourceDreams: number }>(`/api/admin/dreams/validate-symbols`, {
        method: 'POST',
        token
      });
      setValidateOk(`Готово: обработано снов за сегодня: ${r.sourceDreams ?? 0}`);
    } catch (e: unknown) {
      setError((e as Error).message || 'Не удалось валидировать');
    } finally {
      setValidateBusy(false);
    }
  }

  async function updatePlatformAiModel(model: string) {
    if (!token || !model || model === platformAiModel) return;
    setPlatformAiBusy(true);
    setError(null);
    try {
      await api('/api/admin/users/settings/ai-model', {
        method: 'PATCH',
        token,
        body: { model }
      });
      setPlatformAiModel(model);
    } catch (e: unknown) {
      setError((e as Error).message || 'Не удалось изменить модель AI');
    } finally {
      setPlatformAiBusy(false);
    }
  }

  async function updatePlatformSttModel(model: string) {
    if (!token || !model || model === platformSttModel) return;
    setPlatformSttBusy(true);
    setError(null);
    try {
      await api('/api/admin/users/settings/transcription-model', {
        method: 'PATCH',
        token,
        body: { model }
      });
      setPlatformSttModel(model);
    } catch (e: unknown) {
      setError((e as Error).message || 'Не удалось изменить модель транскрибации');
    } finally {
      setPlatformSttBusy(false);
    }
  }

  async function submitPassword() {
    if (!token || !pwdUser) return;
    if (pwd1.length < 8) {
      setError('Пароль не короче 8 символов');
      return;
    }
    if (pwd1 !== pwd2) {
      setError('Пароли не совпадают');
      return;
    }
    setError(null);
    try {
      await api(`/api/admin/users/${pwdUser.id}/password`, {
        method: 'PATCH',
        token,
        body: { password: pwd1 }
      });
      setPwdUser(null);
      setPwd1('');
      setPwd2('');
    } catch (e: unknown) {
      setError((e as Error).message || 'Ошибка смены пароля');
    }
  }

  async function submitEmail() {
    if (!token || !emailUser) return;
    const nextEmail = emailDraft.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError('Укажите корректный email');
      return;
    }
    setError(null);
    try {
      await api(`/api/admin/users/${emailUser.id}/email`, {
        method: 'PATCH',
        token,
        body: { email: nextEmail }
      });
      setEmailUser(null);
      setEmailDraft('');
      await refreshAll();
    } catch (e: unknown) {
      setError((e as Error).message || 'Ошибка смены email');
    }
  }

  async function confirmDelete() {
    if (!token || !delUser) return;
    setError(null);
    setBusyId(delUser.id);
    try {
      const body: { transferClientsTo?: string } = {};
      if ((delUser.clientCount ?? 0) > 0 && transferTo) {
        body.transferClientsTo = transferTo;
      }
      await api(`/api/admin/users/${delUser.id}`, {
        method: 'DELETE',
        token,
        body: Object.keys(body).length ? body : undefined
      });
      setDelUser(null);
      setTransferTo('');
      await refreshAll();
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      if (msg.includes('переназначьте') || msg.includes('TRANSFER')) {
        setError('Укажите психолога для переноса клиентов или переназначьте их в карточке пользователя.');
      } else {
        setError(msg || 'Ошибка удаления');
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-shell">
      <AdminNavbar />
      <main className="admin-main">
        <header className="admin-head">
          <div>
            <p className="admin-head__eyebrow">Люди</p>
            <h1 className="admin-head__title">Пользователи</h1>
            <p className="admin-head__lead">
              Клик по пользователю — карточка со статистикой, клиентами и действиями
            </p>
          </div>
          <div className="admin-head__actions">
            <Link to="/admin" className="button secondary">
              ← Обзор
            </Link>
            <button type="button" className="button secondary" onClick={() => refreshAll()}>
              Обновить
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={validateBusy}
              onClick={() => validateDreamSymbolsNow()}
              title="Запустить ежедневную валидацию символов раньше 18:00"
            >
              Валидировать сны
            </button>
          </div>
        </header>

        <div className="card" style={{ padding: 14, marginBottom: 16, borderRadius: 12, border: borderSubtle }}>
          <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
            Модель AI по умолчанию для всей платформы
          </label>
          <select
            value={platformAiModel}
            onChange={(e) => void updatePlatformAiModel(e.target.value)}
            disabled={platformAiBusy}
            style={{
              width: '100%',
              maxWidth: 520,
              padding: '10px 12px',
              borderRadius: 10,
              border: borderInput,
              background: 'var(--surface-2)',
              color: 'var(--text)',
              fontSize: 14
            }}
          >
            {platformAiOptions.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        <div className="card" style={{ padding: 14, marginBottom: 16, borderRadius: 12, border: borderSubtle }}>
          <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
            Модель транскрибации (аудио → текст)
          </label>
          <select
            value={platformSttModel}
            onChange={(e) => void updatePlatformSttModel(e.target.value)}
            disabled={platformSttBusy}
            style={{
              width: '100%',
              maxWidth: 520,
              padding: '10px 12px',
              borderRadius: 10,
              border: borderInput,
              background: 'var(--surface-2)',
              color: 'var(--text)',
              fontSize: 14
            }}
          >
            {platformSttOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <p className="small" style={{ margin: '8px 0 0', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Whisper рекомендуется для длинных записей (1–3 ч). Gemini — для коротких с разметкой спикеров.
          </p>
        </div>

        {validateOk && (
          <div
            className="card"
            style={{
              padding: 12,
              marginBottom: 16,
              background: 'rgba(16, 185, 129, 0.10)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#10b981',
              borderRadius: 12
            }}
          >
            {validateOk}
          </div>
        )}

        {error && (
          <div
            className="card"
            style={{
              padding: 12,
              marginBottom: 16,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#ef4444',
              borderRadius: 12
            }}
          >
            {error}
          </div>
        )}

        <section className="admin-table-wrap" style={{ marginBottom: 24 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', background: 'var(--paper-soft)' }}>
            <h2 className="admin-panel__title" style={{ margin: 0 }}>Пользователи</h2>
            <p className="admin-section__sub" style={{ marginTop: 4 }}>
              Клик по заголовку — сортировка · клик по строке — карточка
            </p>
          </div>
          <div style={{ padding: '14px 16px 16px' }}>
          <div className="admin-filters" style={{ marginBottom: 14 }}>
            <input
              className="admin-filters__search"
              placeholder="Поиск по email, имени или id"
              value={q}
              onChange={e => setQ(e.target.value)}
              type="search"
            />
            <select
              className="admin-filters__search"
              style={{ flex: '0 0 180px' }}
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="">Все роли</option>
              <option value="psychologist">Психолог</option>
              <option value="client">Клиент</option>
              <option value="researcher">Исследователь</option>
              <option value="admin">Админ</option>
              <option value="guest">Гость</option>
            </select>
          </div>

          {loading ? (
            <div className="admin-loading">Загрузка…</div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--line)' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>
                      <button type="button" className="admin-sort-th" onClick={() => toggleSort('name')}>
                        Пользователь{sortMarker(sortKey === 'name', sortDir)}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="admin-sort-th" onClick={() => toggleSort('role')}>
                        Роль{sortMarker(sortKey === 'role', sortDir)}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="admin-sort-th" onClick={() => toggleSort('lastSeen')}>
                        Заход{sortMarker(sortKey === 'lastSeen', sortDir)}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="admin-sort-th" onClick={() => toggleSort('clients')}>
                        Клиенты{sortMarker(sortKey === 'clients', sortDir)}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="admin-sort-th" onClick={() => toggleSort('aiTokens')}>
                        AI{sortMarker(sortKey === 'aiTokens', sortDir)}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="admin-sort-th" onClick={() => toggleSort('createdAt')}>
                        Рег.{sortMarker(sortKey === 'createdAt', sortDir)}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map(u => (
                    <tr
                      key={u.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setDetailUserId(u.id)}
                    >
                      <td>
                        <div style={{ fontWeight: 700 }}>{u.profileName || u.email}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-muted)', wordBreak: 'break-all' }}>{u.email}</div>
                      </td>
                      <td>
                        <span style={roleBadgeStyle(u.role, isLight)}>{ROLE_LABELS[u.role] || u.role}</span>
                        {(u.role === 'psychologist' || u.role === 'admin') && (
                          <div style={{ marginTop: 4, fontSize: 11, color: u.isVerified ? 'var(--sage)' : 'var(--ink-muted)' }}>
                            {u.isVerified ? 'верифицирован' : 'без верификации'}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                        {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString('ru-RU') : '—'}
                      </td>
                      <td>
                        {u.role === 'psychologist' || u.role === 'admin' ? u.clientCount ?? 0 : u.linkedClient ? u.linkedClient.name : '—'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                        {u.aiTokenPlan} · {(u.aiTokensUsed || 0).toLocaleString('ru-RU')}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!sortedUsers.length && <div className="admin-empty">Нет записей</div>}
            </div>
          )}
          </div>
        </section>

        {detailUserId && token ? (
          <AdminUserDetailModal
            userId={detailUserId}
            token={token}
            meId={me?.id}
            platformAiModel={platformAiModel}
            platformAiOptions={platformAiOptions}
            onClose={() => setDetailUserId(null)}
            onChanged={() => void refreshAll()}
            onOpenPassword={(u) => {
              setPwdUser(u);
              setPwd1('');
              setPwd2('');
            }}
            onOpenEmail={(u) => {
              setEmailUser(u);
              setEmailDraft(u.email);
            }}
            onOpenDelete={(u) => {
              setDelUser(u);
              setTransferTo('');
            }}
          />
        ) : null}

      </main>

      {pwdUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 2000,
            padding: 16
          }}
          onClick={() => setPwdUser(null)}
        >
          <div className="card" style={{ padding: 24, maxWidth: 400, width: '100%', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Новый пароль</div>
            <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              {pwdUser.email}
            </div>
            <input
              type="password"
              placeholder="Не короче 8 символов"
              value={pwd1}
              onChange={e => setPwd1(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                marginBottom: 10,
                borderRadius: 10,
                border: borderInput,
                background: 'var(--surface)',
                color: 'var(--text)'
              }}
            />
            <input
              type="password"
              placeholder="Повтор пароля"
              value={pwd2}
              onChange={e => setPwd2(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                marginBottom: 16,
                borderRadius: 10,
                border: borderInput,
                background: 'var(--surface)',
                color: 'var(--text)'
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="button secondary" onClick={() => setPwdUser(null)}>
                Отмена
              </button>
              <button type="button" className="button" onClick={() => submitPassword()}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {emailUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 2000,
            padding: 16
          }}
          onClick={() => setEmailUser(null)}
        >
          <div className="card" style={{ padding: 24, maxWidth: 440, width: '100%', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Сменить email</div>
            <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
              Пользователь: {emailUser.email}
            </div>
            <input
              type="email"
              placeholder="Новый email"
              value={emailDraft}
              onChange={e => setEmailDraft(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                marginBottom: 16,
                borderRadius: 10,
                border: borderInput,
                background: 'var(--surface)',
                color: 'var(--text)'
              }}
            />
            <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              Для `example.com` и `jung-ai` подтверждение почты не требуется.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="button secondary" onClick={() => setEmailUser(null)}>
                Отмена
              </button>
              <button type="button" className="button" onClick={() => submitEmail()}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {delUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 2000,
            padding: 16
          }}
          onClick={() => setDelUser(null)}
        >
          <div className="card" style={{ padding: 24, maxWidth: 440, width: '100%', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, marginBottom: 8, color: '#f87171' }}>Удалить пользователя?</div>
            <div style={{ marginBottom: 12 }}>{delUser.email}</div>
            <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
              Для психолога с клиентами укажите, кому передать CRM-клиентов, или переназначьте их в карточке пользователя.
            </div>
            {(delUser.clientCount ?? 0) > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="small" style={{ marginBottom: 6 }}>
                  Передать {delUser.clientCount} клиент(ов) психологу:
                </div>
                <select
                  value={transferTo}
                  onChange={e => setTransferTo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 10,
                    border: borderInput,
                    background: 'var(--surface)',
                    color: 'var(--text)'
                  }}
                >
                  <option value="">— выберите —</option>
                  {psychOptions.filter(p => p.id !== delUser.id).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="button secondary" onClick={() => setDelUser(null)}>
                Отмена
              </button>
              <button
                type="button"
                className="button"
                style={{ background: '#dc2626', color: '#fff' }}
                disabled={
                  busyId === delUser.id || ((delUser.clientCount ?? 0) > 0 && !transferTo)
                }
                onClick={() => confirmDelete()}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
