import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import '../../pages/admin/admin.css';

export type AdminUserRow = {
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

type DetailPayload = {
  user: AdminUserRow & {
    avatarUrl?: string | null;
    bio?: string | null;
    phone?: string | null;
    specialization?: string | null;
    acceptingClients?: boolean;
  };
  crmClients: Array<{
    id: string;
    name: string;
    email: string | null;
    psychologistId: string;
    createdAt: string;
    therapyEndedAt: string | null;
  }>;
  linkedClient: {
    id: string;
    name: string;
    psychologistId: string;
    psychologistName: string | null;
  } | null;
  psychOptions: Array<{ id: string; email: string; name: string; isVerified: boolean }>;
  usage: {
    days: number;
    totalVisits: number;
    totalDurationMs: number;
    pages: Array<{
      pathKey: string;
      label: string;
      area: string;
      visits: number;
      durationMs: number;
      avgDurationMs: number;
    }>;
  };
};

const ROLE_LABELS: Record<string, string> = {
  psychologist: 'Психолог',
  client: 'Клиент',
  researcher: 'Исследователь',
  admin: 'Администратор',
  guest: 'Гость',
};

const AREA_LABELS: Record<string, string> = {
  client: 'Клиент',
  psychologist: 'Психолог',
  researcher: 'Исследователь',
  admin: 'Админ',
  shared: 'Общее',
  marketing: 'Публичное',
  auth: 'Авторизация',
  other: 'Прочее',
};

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m} мин ${rem} с` : `${m} мин`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h} ч ${rm} мин` : `${h} ч`;
}

function formatSeen(iso: string | null | undefined): string {
  if (!iso) return 'нет данных';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'нет данных';
  const diff = Date.now() - t;
  if (diff < 60_000) return 'только что';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} мин назад`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} ч назад`;
  return new Date(iso).toLocaleString('ru-RU');
}

type Props = {
  userId: string;
  token: string;
  meId?: string;
  platformAiModel: string;
  platformAiOptions: string[];
  onClose: () => void;
  onChanged: () => void;
  onOpenPassword: (u: AdminUserRow) => void;
  onOpenEmail: (u: AdminUserRow) => void;
  onOpenDelete: (u: AdminUserRow) => void;
};

export function AdminUserDetailModal({
  userId,
  token,
  meId,
  platformAiModel,
  platformAiOptions,
  onClose,
  onChanged,
  onOpenPassword,
  onOpenEmail,
  onOpenDelete,
}: Props) {
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [busy, setBusy] = useState(false);
  const [transferMap, setTransferMap] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api<DetailPayload>(`/api/admin/users/${userId}/detail?days=${days}`, { token });
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token, days]);

  const u = data?.user;
  const maxPageDur = useMemo(
    () => Math.max(1, ...(data?.usage.pages.map((p) => p.durationMs) || [1])),
    [data]
  );

  async function updateAiPlan(plan: 'standard' | 'medium' | 'large') {
    if (!u) return;
    setBusy(true);
    try {
      await api(`/api/admin/users/${u.id}/ai-token-plan`, { method: 'PATCH', token, body: { plan } });
      await load();
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  async function updateAiModel(model: string) {
    if (!u) return;
    setBusy(true);
    try {
      await api(`/api/admin/users/${u.id}/ai-model`, {
        method: 'PATCH',
        token,
        body: { model: model === 'default' ? null : model },
      });
      await load();
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  async function revokeVerification() {
    if (!u || !confirm('Снять верификацию?')) return;
    setBusy(true);
    try {
      await api(`/api/admin/users/${u.id}/revoke-verification`, { method: 'POST', token });
      await load();
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  async function reassignClient(clientId: string, psychologistId: string) {
    if (!psychologistId) return;
    setBusy(true);
    try {
      await api(`/api/admin/users/clients-crm/${clientId}/psychologist`, {
        method: 'PATCH',
        token,
        body: { psychologistId },
      });
      await load();
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось переназначить');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(33, 30, 43, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="admin-panel"
        style={{
          width: 'min(920px, 96vw)',
          maxHeight: '92vh',
          overflow: 'auto',
          padding: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'flex-start',
            position: 'sticky',
            top: 0,
            background: 'var(--card)',
            zIndex: 1,
          }}
        >
          <div>
            <p className="admin-head__eyebrow" style={{ marginBottom: 4 }}>
              Карточка пользователя
            </p>
            <h2 className="admin-section__title" style={{ fontSize: 22 }}>
              {u?.profileName || u?.email || '…'}
            </h2>
            {u ? (
              <p className="admin-list__meta" style={{ marginTop: 4 }}>
                {ROLE_LABELS[u.role] || u.role} · {u.email} · заход: {formatSeen(u.lastSeenAt)}
              </p>
            ) : null}
          </div>
          <button type="button" className="button secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {error ? <div className="admin-alert admin-alert--err">{error}</div> : null}
          {loading && !data ? <div className="admin-loading">Загрузка…</div> : null}

          {u ? (
            <>
              <section className="admin-section" style={{ marginBottom: 20 }}>
                <h3 className="admin-panel__title">Действия</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  <button type="button" className="button secondary" onClick={() => onOpenEmail(u)}>
                    Сменить email
                  </button>
                  <button type="button" className="button secondary" onClick={() => onOpenPassword(u)}>
                    Сменить пароль
                  </button>
                  {(u.role === 'psychologist' || u.role === 'admin') && u.isVerified ? (
                    <button type="button" className="button secondary" disabled={busy} onClick={() => void revokeVerification()}>
                      Снять верификацию
                    </button>
                  ) : null}
                  {u.id !== meId ? (
                    <button type="button" className="button danger" onClick={() => onOpenDelete(u)}>
                      Удалить
                    </button>
                  ) : null}
                </div>
                <div className="admin-kpi-grid">
                  <label className="admin-kpi">
                    <span className="admin-kpi__label">AI-план</span>
                    <select
                      className="admin-filters__search"
                      value={u.aiTokenPlan}
                      disabled={busy}
                      onChange={(e) => void updateAiPlan(e.target.value as 'standard' | 'medium' | 'large')}
                    >
                      <option value="standard">standard</option>
                      <option value="medium">medium</option>
                      <option value="large">large</option>
                    </select>
                    <span className="admin-kpi__hint">{u.aiTokensUsed.toLocaleString('ru-RU')} ток.</span>
                  </label>
                  <label className="admin-kpi">
                    <span className="admin-kpi__label">ИИ-модель</span>
                    <select
                      className="admin-filters__search"
                      value={u.aiModel || 'default'}
                      disabled={busy || !platformAiOptions.length}
                      onChange={(e) => void updateAiModel(e.target.value)}
                    >
                      <option value="default">Платформенная ({platformAiModel || 'default'})</option>
                      {platformAiOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="admin-kpi">
                    <div className="admin-kpi__label">Регистрация</div>
                    <div className="admin-kpi__value" style={{ fontSize: 16 }}>
                      {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <div className="admin-kpi">
                    <div className="admin-kpi__label">Последний заход</div>
                    <div className="admin-kpi__value" style={{ fontSize: 16 }}>
                      {formatSeen(u.lastSeenAt)}
                    </div>
                  </div>
                </div>
              </section>

              {(u.role === 'psychologist' || u.role === 'admin') && (
                <section className="admin-section" style={{ marginBottom: 20 }}>
                  <div className="admin-section__head">
                    <h3 className="admin-section__title" style={{ fontSize: 18 }}>
                      Клиенты CRM ({data?.crmClients.length || 0})
                    </h3>
                  </div>
                  {!data?.crmClients.length ? (
                    <div className="admin-empty" style={{ padding: 16 }}>
                      Клиентов нет
                    </div>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Клиент</th>
                            <th>Статус</th>
                            <th>Переназначить</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data!.crmClients.map((c) => (
                            <tr key={c.id}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{c.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{c.email || '—'}</div>
                              </td>
                              <td>
                                {c.therapyEndedAt ? (
                                  <span className="admin-badge admin-badge--muted">архив</span>
                                ) : (
                                  <span className="admin-badge admin-badge--ok">активен</span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  <select
                                    className="admin-filters__search"
                                    style={{ minWidth: 160 }}
                                    value={transferMap[c.id] || ''}
                                    onChange={(e) =>
                                      setTransferMap((prev) => ({ ...prev, [c.id]: e.target.value }))
                                    }
                                  >
                                    <option value="">Выберите психолога…</option>
                                    {(data?.psychOptions || []).map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="button secondary"
                                    disabled={busy || !transferMap[c.id]}
                                    onClick={() => void reassignClient(c.id, transferMap[c.id])}
                                  >
                                    Передать
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {u.role === 'client' && data?.linkedClient ? (
                <section className="admin-section" style={{ marginBottom: 20 }}>
                  <h3 className="admin-panel__title">Привязка CRM</h3>
                  <p style={{ margin: 0, fontSize: 14 }}>
                    {data.linkedClient.name} · психолог: {data.linkedClient.psychologistName || '—'}
                  </p>
                </section>
              ) : null}

              <section className="admin-section" style={{ marginBottom: 8 }}>
                <div className="admin-section__head">
                  <div>
                    <h3 className="admin-section__title" style={{ fontSize: 18 }}>
                      Активность на платформе
                    </h3>
                    <p className="admin-section__sub">
                      {data?.usage.totalVisits || 0} визитов · {formatDuration(data?.usage.totalDurationMs || 0)} на
                      экранах
                    </p>
                  </div>
                  <div className="admin-periods">
                    {([7, 30, 90] as const).map((d) => (
                      <button key={d} type="button" className={days === d ? 'is-on' : undefined} onClick={() => setDays(d)}>
                        {d} дн.
                      </button>
                    ))}
                  </div>
                </div>

                {!data?.usage.pages.length ? (
                  <div className="admin-empty" style={{ padding: 20 }}>
                    Пока нет данных трекинга — откройте кабинет под этим пользователем, чтобы накопить статистику.
                  </div>
                ) : (
                  <div className="admin-bars">
                    {data!.usage.pages.slice(0, 15).map((p) => (
                      <div key={p.pathKey}>
                        <div className="admin-bar__top">
                          <span>
                            {p.label}{' '}
                            <span style={{ color: 'var(--ink-muted)', fontWeight: 500 }}>
                              · {AREA_LABELS[p.area] || p.area} · {p.visits} виз. · ср.{' '}
                              {formatDuration(p.avgDurationMs)}
                            </span>
                          </span>
                          <strong>{formatDuration(p.durationMs)}</strong>
                        </div>
                        <div className="admin-bar__track">
                          <div
                            className="admin-bar__fill"
                            style={{ width: `${Math.round((p.durationMs / maxPageDur) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
