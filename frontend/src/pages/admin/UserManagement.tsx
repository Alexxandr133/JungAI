import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';

type AdminUserRow = {
  id: string;
  email: string;
  role: string;
  isVerified: boolean;
  createdAt: string;
  profileName: string | null;
  clientCount?: number;
  linkedClient?: { id: string; name: string; psychologistId: string } | null;
};

type PsychOption = { id: string; email: string; name: string; isVerified: boolean };

type CrmClient = {
  id: string;
  name: string;
  email: string | null;
  psychologistId: string;
  psychologistEmail: string | null;
  psychologistName: string | null;
  createdAt: string;
};

const DND_MIME = 'application/jungai-client-id';

export default function AdminUserManagement() {
  const { token, user: me } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [psychOptions, setPsychOptions] = useState<PsychOption[]>([]);
  const [clientsCrm, setClientsCrm] = useState<CrmClient[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [pwdUser, setPwdUser] = useState<AdminUserRow | null>(null);
  const [pwd1, setPwd1] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [emailUser, setEmailUser] = useState<AdminUserRow | null>(null);
  const [emailDraft, setEmailDraft] = useState('');

  const [delUser, setDelUser] = useState<AdminUserRow | null>(null);
  const [transferTo, setTransferTo] = useState('');

  const [dragOverPsych, setDragOverPsych] = useState<string | null>(null);
  const [validateBusy, setValidateBusy] = useState(false);
  const [validateOk, setValidateOk] = useState<string | null>(null);

  const [qDebounced, setQDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 320);
    return () => clearTimeout(t);
  }, [q]);

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
        const [u, p, c] = await Promise.all([
          api<{ items: AdminUserRow[] }>(`/api/admin/users?${params.toString()}`, { token }),
          api<{ items: PsychOption[] }>('/api/admin/users/psychologists-options', { token }),
          api<{ items: CrmClient[] }>('/api/admin/users/clients-crm', { token })
        ]);
        if (cancelled) return;
        setUsers(u.items || []);
        setPsychOptions(p.items || []);
        setClientsCrm(c.items || []);
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
      const [u, p, c] = await Promise.all([
        api<{ items: AdminUserRow[] }>(`/api/admin/users?${params.toString()}`, { token }),
        api<{ items: PsychOption[] }>('/api/admin/users/psychologists-options', { token }),
        api<{ items: CrmClient[] }>('/api/admin/users/clients-crm', { token })
      ]);
      setUsers(u.items || []);
      setPsychOptions(p.items || []);
      setClientsCrm(c.items || []);
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

  const clientsByPsych = useMemo(() => {
    const m = new Map<string, CrmClient[]>();
    for (const c of clientsCrm) {
      const arr = m.get(c.psychologistId) || [];
      arr.push(c);
      m.set(c.psychologistId, arr);
    }
    return m;
  }, [clientsCrm]);

  async function reassignClient(clientId: string, psychologistId: string) {
    if (!token) return;
    setBusyId(clientId);
    setError(null);
    try {
      await api(`/api/admin/users/clients-crm/${clientId}/psychologist`, {
        method: 'PATCH',
        token,
        body: { psychologistId }
      });
      await refreshAll();
    } catch (e: unknown) {
      setError((e as Error).message || 'Не удалось переназначить');
    } finally {
      setBusyId(null);
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

  async function revokeVerification(u: AdminUserRow) {
    if (!token) return;
    if (!window.confirm(`Снять верификацию у ${u.email}?`)) return;
    setBusyId(u.id);
    setError(null);
    try {
      await api(`/api/admin/users/${u.id}/revoke-verification`, { method: 'POST', token });
      await refreshAll();
    } catch (e: unknown) {
      setError((e as Error).message || 'Ошибка');
    } finally {
      setBusyId(null);
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
        setError('Укажите психолога для переноса клиентов или переназначьте клиентов вручную ниже.');
      } else {
        setError(msg || 'Ошибка удаления');
      }
    } finally {
      setBusyId(null);
    }
  }

  function onDragStartClient(e: React.DragEvent, clientId: string) {
    e.dataTransfer.setData(DND_MIME, clientId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOverPsych(e: React.DragEvent, psychId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPsych(psychId);
  }

  function onDragLeavePsych() {
    setDragOverPsych(null);
  }

  async function onDropOnPsych(e: React.DragEvent, targetPsychId: string) {
    e.preventDefault();
    setDragOverPsych(null);
    const clientId = e.dataTransfer.getData(DND_MIME);
    if (!clientId) return;
    const c = clientsCrm.find(x => x.id === clientId);
    if (c?.psychologistId === targetPsychId) return;
    await reassignClient(clientId, targetPsychId);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
          overflowX: 'hidden'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Управление пользователями</h1>
            <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              Пароли, верификация, удаление; перенос CRM-клиентов между психологами
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/admin" className="button secondary" style={{ padding: '8px 16px', fontSize: 14 }}>
              ← Дашборд
            </Link>
            <button type="button" className="button secondary" onClick={() => refreshAll()} style={{ padding: '8px 16px', fontSize: 14 }}>
              Обновить
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={validateBusy}
              onClick={() => validateDreamSymbolsNow()}
              style={{ padding: '8px 16px', fontSize: 14 }}
              title="Запустить ежедневную валидацию символов (теги -> AI -> нормализация) раньше 18:00"
            >
              Валидировать сны
            </button>
          </div>
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

        <section className="card" style={{ padding: 20, marginBottom: 24, borderRadius: 12 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Пользователи</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <input
              placeholder="Поиск по email или id"
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{
                flex: '1 1 200px',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 14
              }}
            />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 14
              }}
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
            <div style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>Загрузка…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '10px 8px' }}>Email</th>
                    <th style={{ padding: '10px 8px' }}>Роль</th>
                    <th style={{ padding: '10px 8px' }}>Имя</th>
                    <th style={{ padding: '10px 8px' }}>Вериф.</th>
                    <th style={{ padding: '10px 8px' }}>Клиенты</th>
                    <th style={{ padding: '10px 8px' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '10px 8px', wordBreak: 'break-all' }}>{u.email}</td>
                      <td style={{ padding: '10px 8px' }}>{u.role}</td>
                      <td style={{ padding: '10px 8px' }}>{u.profileName || '—'}</td>
                      <td style={{ padding: '10px 8px' }}>
                        {(u.role === 'psychologist' || u.role === 'admin') && (
                          <span style={{ color: u.isVerified ? '#10b981' : 'var(--text-muted)' }}>
                            {u.isVerified ? 'да' : 'нет'}
                          </span>
                        )}
                        {u.role === 'client' && u.linkedClient && (
                          <span className="small" style={{ color: 'var(--text-muted)' }}>
                            CRM: {u.linkedClient.name}
                          </span>
                        )}
                        {u.role === 'client' && !u.linkedClient && <span className="small">—</span>}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {u.role === 'psychologist' || u.role === 'admin' ? u.clientCount ?? 0 : '—'}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <button
                            type="button"
                            className="button secondary"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            onClick={() => {
                              setEmailUser(u);
                              setEmailDraft(u.email);
                            }}
                          >
                            Email
                          </button>
                          <button
                            type="button"
                            className="button secondary"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            onClick={() => {
                              setPwdUser(u);
                              setPwd1('');
                              setPwd2('');
                            }}
                          >
                            Пароль
                          </button>
                          {(u.role === 'psychologist' || u.role === 'admin') && u.isVerified && (
                            <button
                              type="button"
                              className="button secondary"
                              style={{ padding: '4px 10px', fontSize: 12 }}
                              disabled={busyId === u.id}
                              onClick={() => revokeVerification(u)}
                            >
                              Снять вериф.
                            </button>
                          )}
                          {u.id !== me?.id && (
                            <button
                              type="button"
                              className="button secondary"
                              style={{ padding: '4px 10px', fontSize: 12, color: '#f87171' }}
                              disabled={busyId === u.id}
                              onClick={() => {
                                setDelUser(u);
                                setTransferTo('');
                              }}
                            >
                              Удалить
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!users.length && <div className="small" style={{ padding: 16, color: 'var(--text-muted)' }}>Нет записей</div>}
            </div>
          )}
        </section>

        <section className="card" style={{ padding: 20, marginBottom: 24, borderRadius: 12 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Клиенты по психологам</h2>
          <p className="small" style={{ color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
            Перетащите карточку клиента на другого психолога или выберите психолога в списке. Обновляются CRM, вкладки и документы с прежним психологом.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16
            }}
          >
            {psychOptions.map(p => {
              const list = clientsByPsych.get(p.id) || [];
              const isOver = dragOverPsych === p.id;
              return (
                <div
                  key={p.id}
                  onDragOver={e => onDragOverPsych(e, p.id)}
                  onDragLeave={onDragLeavePsych}
                  onDrop={e => onDropOnPsych(e, p.id)}
                  style={{
                    borderRadius: 12,
                    border: `2px dashed ${isOver ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                    background: isOver ? 'rgba(91, 124, 250, 0.08)' : 'var(--surface-2)',
                    padding: 12,
                    minHeight: 120,
                    transition: 'border-color 0.15s, background 0.15s'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    {p.isVerified && (
                      <span style={{ fontSize: 10, color: '#10b981', flexShrink: 0 }}>✓ вериф.</span>
                    )}
                  </div>
                  <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 10, wordBreak: 'break-all' }}>
                    {p.email}
                  </div>
                  <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
                    Клиентов: {list.length}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {list.map(c => (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={e => onDragStartClient(e, c.id)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'var(--surface)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          cursor: 'grab',
                          fontSize: 13,
                          opacity: busyId === c.id ? 0.5 : 1
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        {c.email && <div className="small" style={{ color: 'var(--text-muted)' }}>{c.email}</div>}
                      </div>
                    ))}
                    {!list.length && (
                      <div className="small" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Нет клиентов — можно бросить сюда
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card" style={{ padding: 20, borderRadius: 12 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Все клиенты (таблица)</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '8px' }}>Клиент</th>
                  <th style={{ padding: '8px' }}>Email</th>
                  <th style={{ padding: '8px' }}>Психолог</th>
                  <th style={{ padding: '8px' }}>Переназначить</th>
                </tr>
              </thead>
              <tbody>
                {clientsCrm.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '8px' }}>{c.name}</td>
                    <td style={{ padding: '8px', wordBreak: 'break-all' }}>{c.email || '—'}</td>
                    <td style={{ padding: '8px' }}>{c.psychologistName || c.psychologistEmail || c.psychologistId}</td>
                    <td style={{ padding: '8px' }}>
                      <select
                        value=""
                        onChange={e => {
                          const v = e.target.value;
                          e.target.value = '';
                          if (v) void reassignClient(c.id, v);
                        }}
                        disabled={busyId === c.id}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: 'var(--surface)',
                          color: 'var(--text)',
                          fontSize: 12,
                          maxWidth: 220
                        }}
                      >
                        <option value="">Выбрать…</option>
                        {psychOptions.filter(p => p.id !== c.psychologistId).map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.email})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!clientsCrm.length && <div className="small" style={{ padding: 16, color: 'var(--text-muted)' }}>Нет CRM-клиентов</div>}
          </div>
        </section>
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
                border: '1px solid rgba(255,255,255,0.12)',
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
                border: '1px solid rgba(255,255,255,0.12)',
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
                border: '1px solid rgba(255,255,255,0.12)',
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
              Для психолога с клиентами укажите, кому передать CRM-клиентов, или переназначьте их вручную в таблице выше.
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
                    border: '1px solid rgba(255,255,255,0.12)',
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
