import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { AdminNavbar } from '../../components/AdminNavbar';
import './admin.css';

type DashboardStats = {
  support: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    withWorkAreaAccess: number;
  };
  verification: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  system: {
    totalUsers: number;
    totalPsychologists: number;
    totalClients: number;
    totalDreams: number;
    totalSessions: number;
    videoMeetingsUpcoming: number;
    videoMeetingsInSlot: number;
    videoMeetingsPast: number;
    voiceRoomsTotal: number;
  };
  recentSupportRequests: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    psychologistEmail: string | null;
    psychologistName: string | null;
  }>;
};

type AnalyticsLite = {
  summary: {
    registrationsInRange: number;
    sessionsInRange: number;
  };
  series: {
    days: string[];
    registrations: number[];
    sessions: number[];
  };
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Открыт',
  in_progress: 'В работе',
  resolved: 'Решён',
  closed: 'Закрыт',
};

const STATUS_BADGE: Record<string, string> = {
  open: 'admin-badge admin-badge--open',
  in_progress: 'admin-badge admin-badge--progress',
  resolved: 'admin-badge admin-badge--resolved',
  closed: 'admin-badge admin-badge--closed',
};

function Kpi({
  label,
  value,
  hint,
  tone,
  to,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'attention' | 'ok' | 'danger' | 'brand';
  to?: string;
}) {
  const cls = `admin-kpi${tone ? ` admin-kpi--${tone}` : ''}`;
  const body = (
    <>
      <div className="admin-kpi__label">{label}</div>
      <div className="admin-kpi__value">{value}</div>
      {hint ? <div className="admin-kpi__hint">{hint}</div> : null}
    </>
  );
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  return <div className={cls}>{body}</div>;
}

function MiniSpark({
  values,
  labels,
  stroke = 'var(--brand)',
  fill = 'rgba(108, 91, 212, 0.12)',
}: {
  values: number[];
  labels: string[];
  stroke?: string;
  fill?: string;
}) {
  const w = 480;
  const h = 140;
  const padX = 8;
  const padY = 16;
  const max = Math.max(1, ...values);
  const n = Math.max(1, values.length - 1);
  const coords = values.map((v, i) => {
    const x = padX + (i * (w - padX * 2)) / n;
    const y = h - padY - (v / max) * (h - padY * 2);
    return { x, y, v };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area = `${padX},${h - padY} ${line} ${coords[coords.length - 1]?.x ?? padX},${h - padY}`;
  const sum = values.reduce((a, b) => a + b, 0);

  return (
    <div className="admin-spark">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Динамика">
        <defs>
          <linearGradient id="adminSparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#adminSparkFill)" />
        <polyline fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" points={line} />
        {coords.map((c, i) => {
          if (values.length > 24 && i % Math.ceil(values.length / 12) !== 0 && i !== values.length - 1) return null;
          return <circle key={i} cx={c.x} cy={c.y} r="2.8" fill={stroke} />;
        })}
      </svg>
      <div className="admin-spark__meta">
        <span>{labels[0] || '—'}</span>
        <span>
          Σ {sum} · max {max}
        </span>
        <span>{labels[labels.length - 1] || '—'}</span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trend, setTrend] = useState<AnalyticsLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [dash, analytics] = await Promise.all([
          api<DashboardStats>('/api/admin/dashboard', { token }),
          api<AnalyticsLite>('/api/admin/analytics?days=14', { token }).catch(() => null),
        ]);
        if (cancelled) return;
        setStats(dash);
        setTrend(analytics);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить статистику');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const attentionOpen = (stats?.support.open || 0) + (stats?.support.inProgress || 0);
  const pendingVerify = stats?.verification.pending || 0;

  const regSeries = useMemo(() => trend?.series.registrations || [], [trend]);
  const sessSeries = useMemo(() => trend?.series.sessions || [], [trend]);
  const dayLabels = useMemo(() => trend?.series.days || [], [trend]);

  return (
    <div className="admin-shell">
      <AdminNavbar />
      <main className="admin-main">
        <header className="admin-head">
          <div>
            <p className="admin-head__eyebrow">Администрирование</p>
            <h1 className="admin-head__title">Обзор платформы</h1>
            <p className="admin-head__lead">
              Очереди, требующие реакции, снимок системы и динамика за 14 дней.
            </p>
          </div>
          <div className="admin-head__actions">
            <Link to="/admin/analytics" className="button secondary">
              Аналитика
            </Link>
            <Link to="/admin/support" className="button">
              Тех. запросы
            </Link>
          </div>
        </header>

        {error ? <div className="admin-alert admin-alert--err">{error}</div> : null}

        {loading ? (
          <div className="admin-loading">Загрузка панели…</div>
        ) : stats ? (
          <>
            <section className="admin-attention" aria-label="Требует внимания">
              <Link
                to="/admin/support"
                className={`admin-attention__card${attentionOpen > 0 ? ' admin-attention__card--warn' : ''}`}
              >
                <span className="admin-attention__kicker">Техподдержка</span>
                <div className="admin-attention__num">{attentionOpen}</div>
                <p className="admin-attention__text">
                  Открытых и в работе · всего {stats.support.total} · решено {stats.support.resolved}
                </p>
                <span className="admin-attention__cta">Открыть очередь →</span>
              </Link>
              <Link
                to="/admin/verification"
                className={`admin-attention__card${pendingVerify > 0 ? ' admin-attention__card--info' : ''}`}
              >
                <span className="admin-attention__kicker">Верификация</span>
                <div className="admin-attention__num">{pendingVerify}</div>
                <p className="admin-attention__text">
                  На проверке · одобрено {stats.verification.approved} · отклонено{' '}
                  {stats.verification.rejected}
                </p>
                <span className="admin-attention__cta">Проверить заявки →</span>
              </Link>
            </section>

            <section className="admin-section">
              <div className="admin-section__head">
                <h2 className="admin-section__title">Быстрые действия</h2>
              </div>
              <div className="admin-actions">
                <Link to="/admin/users" className="admin-action">
                  <strong>Пользователи</strong>
                  <span>Пароли, роли, AI-лимиты, перенос CRM</span>
                </Link>
                <Link to="/admin/psychologists-catalog" className="admin-action">
                  <strong>Каталог психологов</strong>
                  <span>Порядок и скрытие на сайте</span>
                </Link>
                <Link to="/admin/open-access" className="admin-action">
                  <strong>Открытый функционал</strong>
                  <span>
                    Доступ к РО · {stats.support.withWorkAreaAccess} активных
                  </span>
                </Link>
                <Link to="/admin/mailings" className="admin-action">
                  <strong>Рассылки</strong>
                  <span>Группы, шаблоны, кампании</span>
                </Link>
              </div>
            </section>

            {trend ? (
              <section className="admin-section">
                <div className="admin-section__head">
                  <div>
                    <h2 className="admin-section__title">Динамика · 14 дней</h2>
                    <p className="admin-section__sub">
                      Регистрации +{trend.summary.registrationsInRange} · сессии{' '}
                      {trend.summary.sessionsInRange}
                    </p>
                  </div>
                  <Link to="/admin/analytics" className="button secondary">
                    Подробнее
                  </Link>
                </div>
                <div className="admin-chart-grid">
                  <div className="admin-panel">
                    <h3 className="admin-panel__title">Регистрации</h3>
                    <p className="admin-panel__hint">Новые аккаунты по дням</p>
                    <MiniSpark values={regSeries} labels={dayLabels} />
                  </div>
                  <div className="admin-panel">
                    <h3 className="admin-panel__title">Сессии терапии</h3>
                    <p className="admin-panel__hint">Завершённые сессии по дням</p>
                    <MiniSpark
                      values={sessSeries}
                      labels={dayLabels}
                      stroke="var(--sage)"
                      fill="rgba(62, 138, 110, 0.14)"
                    />
                  </div>
                </div>
              </section>
            ) : null}

            <section className="admin-section">
              <div className="admin-section__head">
                <h2 className="admin-section__title">Система</h2>
                <p className="admin-section__sub">Снимок на сейчас</p>
              </div>
              <div className="admin-kpi-grid">
                <Kpi label="Пользователи" value={stats.system.totalUsers} tone="brand" to="/admin/users" />
                <Kpi label="Психологи" value={stats.system.totalPsychologists} />
                <Kpi label="Клиенты CRM" value={stats.system.totalClients} />
                <Kpi label="Сны" value={stats.system.totalDreams} />
                <Kpi label="Сессии терапии" value={stats.system.totalSessions} />
                <Kpi
                  label="Видео сейчас"
                  value={stats.system.videoMeetingsInSlot ?? 0}
                  hint="Окно встречи идёт"
                  tone={stats.system.videoMeetingsInSlot ? 'attention' : undefined}
                />
                <Kpi
                  label="Видео скоро"
                  value={stats.system.videoMeetingsUpcoming ?? 0}
                  hint="Старт в будущем"
                />
                <Kpi
                  label="Комнаты LiveKit"
                  value={stats.system.voiceRoomsTotal ?? 0}
                  hint="Записей в БД"
                />
              </div>
            </section>

            <section className="admin-section">
              <div className="admin-section__head">
                <div>
                  <h2 className="admin-section__title">Очереди</h2>
                  <p className="admin-section__sub">Детализация по статусам</p>
                </div>
              </div>
              <div className="admin-split">
                <div>
                  <div className="admin-kpi-grid" style={{ marginBottom: 14 }}>
                    <Kpi label="ТП · открыто" value={stats.support.open} tone="brand" to="/admin/support" />
                    <Kpi label="ТП · в работе" value={stats.support.inProgress} tone="attention" to="/admin/support" />
                    <Kpi label="ТП · решено" value={stats.support.resolved} tone="ok" />
                    <Kpi label="ТП · закрыто" value={stats.support.closed} />
                    <Kpi
                      label="Доступ к РО"
                      value={stats.support.withWorkAreaAccess}
                      to="/admin/open-access"
                    />
                    <Kpi
                      label="Верификация · ожидает"
                      value={stats.verification.pending}
                      tone={stats.verification.pending ? 'attention' : undefined}
                      to="/admin/verification"
                    />
                  </div>
                </div>
                <div className="admin-panel admin-panel--flush">
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                    <h3 className="admin-panel__title" style={{ margin: 0 }}>
                      Последние техзапросы
                    </h3>
                  </div>
                  {stats.recentSupportRequests.length === 0 ? (
                    <div className="admin-empty" style={{ padding: 28 }}>
                      Запросов пока нет
                    </div>
                  ) : (
                    <div className="admin-list">
                      {stats.recentSupportRequests.map((req) => (
                        <Link key={req.id} to="/admin/support" className="admin-list__row">
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <p className="admin-list__title">{req.title}</p>
                              <span className={STATUS_BADGE[req.status] || STATUS_BADGE.open}>
                                {STATUS_LABEL[req.status] || req.status}
                              </span>
                            </div>
                            <p className="admin-list__meta">
                              {req.psychologistName || req.psychologistEmail || '—'} ·{' '}
                              {new Date(req.createdAt).toLocaleString('ru-RU')}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
