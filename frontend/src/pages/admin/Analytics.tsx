import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { AdminNavbar } from '../../components/AdminNavbar';
import './admin.css';

type AnalyticsPayload = {
  range: { days: number; from?: string; to?: string };
  summary: {
    totalUsers: number;
    usersByRole: Record<string, number>;
    psychologistsVerified: number;
    psychologistsUnverified: number;
    pendingVerifications: number;
    clientsActive: number;
    clientsArchive: number;
    inviteRegistered: number;
    invitePending: number;
    inviteExpired: number;
    openTasks: number;
    sessionsInRange: number;
    registrationsInRange: number;
  };
  series: {
    days: string[];
    registrations: number[];
    sessions: number[];
  };
  product?: {
    totalVisits: number;
    totalDurationMs: number;
    features: Array<{
      pathKey: string;
      label: string;
      area: string;
      visits: number;
      uniqueUsers: number;
      durationMs: number;
      avgDurationMs: number;
    }>;
    areas: Array<{ area: string; visits: number; durationMs: number; uniqueUsers: number }>;
  };
};

const ROLE_LABEL: Record<string, string> = {
  client: 'Клиенты',
  psychologist: 'Психологи',
  researcher: 'Исследователи',
  admin: 'Админы',
  guest: 'Гости',
};

const AREA_LABEL: Record<string, string> = {
  client: 'Клиентский кабинет',
  psychologist: 'Кабинет психолога',
  researcher: 'Исследователь',
  admin: 'Админ',
  shared: 'Общие экраны',
  marketing: 'Публичные страницы',
  auth: 'Авторизация',
  other: 'Прочее',
};

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h} ч ${rm} мин` : `${h} ч`;
}

function AreaChart({
  values,
  labels,
  stroke,
  fillId,
}: {
  values: number[];
  labels: string[];
  stroke: string;
  fillId: string;
}) {
  const w = 640;
  const h = 200;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const max = Math.max(1, ...values);
  const n = Math.max(1, values.length - 1);
  const coords = values.map((v, i) => {
    const x = padL + (i * (w - padL - padR)) / n;
    const y = padT + (1 - v / max) * (h - padT - padB);
    return { x, y, v, label: labels[i] };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area = `${padL},${h - padB} ${line} ${coords[coords.length - 1]?.x ?? padL},${h - padB}`;
  const yTicks = [0, 0.5, 1].map((t) => Math.round(max * t));
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="admin-spark">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="График"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((tick) => {
          const y = padT + (1 - tick / max) * (h - padT - padB);
          return (
            <g key={tick}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="var(--line)" strokeWidth="1" />
              <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--ink-muted)">
                {tick}
              </text>
            </g>
          );
        })}
        <polygon points={area} fill={`url(#${fillId})`} />
        <polyline fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" points={line} />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={hover === i ? 5 : values.length > 40 && i % Math.ceil(values.length / 16) !== 0 ? 0 : 3}
            fill={stroke}
            onMouseEnter={() => setHover(i)}
            style={{ cursor: 'pointer' }}
          />
        ))}
        {hover != null && coords[hover] ? (
          <g>
            <line
              x1={coords[hover].x}
              x2={coords[hover].x}
              y1={padT}
              y2={h - padB}
              stroke={stroke}
              strokeOpacity="0.35"
              strokeDasharray="4 4"
            />
            <rect
              x={Math.min(coords[hover].x + 8, w - 120)}
              y={Math.max(8, coords[hover].y - 36)}
              width="110"
              height="28"
              rx="6"
              fill="var(--ink)"
            />
            <text
              x={Math.min(coords[hover].x + 14, w - 114)}
              y={Math.max(26, coords[hover].y - 18)}
              fontSize="11"
              fill="#fff"
            >
              {coords[hover].label}: {coords[hover].v}
            </text>
          </g>
        ) : null}
        <text x={padL} y={h - 8} fontSize="10" fill="var(--ink-muted)">
          {labels[0]}
        </text>
        <text x={w - padR} y={h - 8} fontSize="10" fill="var(--ink-muted)" textAnchor="end">
          {labels[labels.length - 1]}
        </text>
      </svg>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  tone,
  display,
}: {
  label: string;
  value: number;
  max: number;
  tone?: 'sage' | 'warn' | 'muted';
  display?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div>
      <div className="admin-bar__top">
        <span>{label}</span>
        <strong>{display ?? value}</strong>
      </div>
      <div className="admin-bar__track">
        <div
          className={`admin-bar__fill${tone ? ` admin-bar__fill--${tone}` : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminAnalytics() {
  const { token } = useAuth();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    api<AnalyticsPayload>(`/api/admin/analytics?days=${days}`, { token })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Не удалось загрузить аналитику'))
      .finally(() => setLoading(false));
  }, [token, days]);

  const s = data?.summary;
  const roleEntries = useMemo(() => Object.entries(s?.usersByRole || {}), [s]);
  const roleMax = Math.max(1, ...roleEntries.map(([, v]) => v));
  const inviteMax = Math.max(1, s?.inviteRegistered || 0, s?.invitePending || 0, s?.inviteExpired || 0);

  return (
    <div className="admin-shell">
      <AdminNavbar />
      <main className="admin-main">
        <header className="admin-head">
          <div>
            <p className="admin-head__eyebrow">Аналитика</p>
            <h1 className="admin-head__title">Динамика платформы</h1>
            <p className="admin-head__lead">
              Период влияет на графики, регистрации/сессии и продуктовую аналитику экранов.
            </p>
          </div>
          <div className="admin-head__actions">
            <div className="admin-periods" role="group" aria-label="Период">
              {([7, 30, 90] as const).map((d) => (
                <button key={d} type="button" className={days === d ? 'is-on' : undefined} onClick={() => setDays(d)}>
                  {d} дн.
                </button>
              ))}
            </div>
            <Link to="/admin" className="button secondary">
              К обзору
            </Link>
          </div>
        </header>

        {error ? <div className="admin-alert admin-alert--err">{error}</div> : null}
        {loading ? <div className="admin-loading">Загрузка аналитики…</div> : null}

        {data && s ? (
          <>
            <section className="admin-section">
              <div className="admin-section__head">
                <h2 className="admin-section__title">За выбранный период</h2>
                <p className="admin-section__sub">{days} дней</p>
              </div>
              <div className="admin-kpi-grid">
                <div className="admin-kpi admin-kpi--brand">
                  <div className="admin-kpi__label">Новые регистрации</div>
                  <div className="admin-kpi__value">{s.registrationsInRange}</div>
                  <div className="admin-kpi__hint">Всего пользователей: {s.totalUsers}</div>
                </div>
                <div className="admin-kpi admin-kpi--ok">
                  <div className="admin-kpi__label">Сессии терапии</div>
                  <div className="admin-kpi__value">{s.sessionsInRange}</div>
                  <div className="admin-kpi__hint">Открытых задач: {s.openTasks}</div>
                </div>
                <div className="admin-kpi admin-kpi--attention">
                  <div className="admin-kpi__label">Верификация ждёт</div>
                  <div className="admin-kpi__value">{s.pendingVerifications}</div>
                  <div className="admin-kpi__hint">Снимок на сейчас</div>
                </div>
                <div className="admin-kpi">
                  <div className="admin-kpi__label">Клиенты CRM</div>
                  <div className="admin-kpi__value">{s.clientsActive}</div>
                  <div className="admin-kpi__hint">Архив: {s.clientsArchive}</div>
                </div>
              </div>
            </section>

            <section className="admin-section">
              <div className="admin-section__head">
                <h2 className="admin-section__title">Графики</h2>
              </div>
              <div className="admin-chart-grid">
                <div className="admin-panel">
                  <h3 className="admin-panel__title">Регистрации по дням</h3>
                  <p className="admin-panel__hint">Наведите на точку — значение за день</p>
                  {data.series.registrations.every((v) => v === 0) ? (
                    <div className="admin-empty" style={{ padding: 24 }}>
                      За период регистраций не было
                    </div>
                  ) : (
                    <AreaChart
                      values={data.series.registrations}
                      labels={data.series.days}
                      stroke="var(--brand)"
                      fillId="adminFillReg"
                    />
                  )}
                </div>
                <div className="admin-panel">
                  <h3 className="admin-panel__title">Сессии по дням</h3>
                  <p className="admin-panel__hint">Терапевтические сессии</p>
                  {data.series.sessions.every((v) => v === 0) ? (
                    <div className="admin-empty" style={{ padding: 24 }}>
                      За период сессий не было
                    </div>
                  ) : (
                    <AreaChart
                      values={data.series.sessions}
                      labels={data.series.days}
                      stroke="var(--sage)"
                      fillId="adminFillSess"
                    />
                  )}
                </div>
              </div>
            </section>

            <section className="admin-section">
              <div className="admin-section__head">
                <div>
                  <h2 className="admin-section__title">Продуктовая аналитика</h2>
                  <p className="admin-section__sub">
                    Время на экранах и уникальные пользователи · {data.product?.totalVisits || 0} визитов ·{' '}
                    {formatDuration(data.product?.totalDurationMs || 0)}
                  </p>
                </div>
              </div>
              {!data.product?.features?.length ? (
                <div className="admin-panel admin-empty">
                  Пока нет данных трекинга. После входов пользователей в кабинет здесь появится важность экранов.
                </div>
              ) : (
                <div className="admin-chart-grid">
                  <div className="admin-panel">
                    <h3 className="admin-panel__title">Зоны продукта</h3>
                    <p className="admin-panel__hint">Куда уходит внимание аудитории</p>
                    <div className="admin-bars">
                      {(data.product?.areas || []).map((a) => {
                        const max = Math.max(1, ...(data.product?.areas.map((x) => x.durationMs) || [1]));
                        return (
                          <BarRow
                            key={a.area}
                            label={`${AREA_LABEL[a.area] || a.area} · ${a.uniqueUsers} чел. · ${a.visits} виз.`}
                            value={a.durationMs}
                            max={max}
                            display={formatDuration(a.durationMs)}
                          />
                        );
                      })}
                    </div>
                    <p className="admin-panel__hint" style={{ marginTop: 10, marginBottom: 0 }}>
                      Суммарное время на экранах зоны за выбранный период — ориентир важности функционала.
                    </p>
                  </div>
                  <div className="admin-panel">
                    <h3 className="admin-panel__title">Топ экранов по времени</h3>
                    <p className="admin-panel__hint">Что реально используют</p>
                    <div className="admin-bars">
                      {(data.product?.features || []).slice(0, 12).map((f) => {
                        const max = Math.max(1, ...(data.product?.features.slice(0, 12).map((x) => x.durationMs) || [1]));
                        return (
                          <div key={f.pathKey}>
                            <div className="admin-bar__top">
                              <span>
                                {f.label}{' '}
                                <span style={{ color: 'var(--ink-muted)', fontWeight: 500 }}>
                                  · {f.uniqueUsers} чел. · {f.visits} виз. · ср. {formatDuration(f.avgDurationMs)}
                                </span>
                              </span>
                              <strong>{formatDuration(f.durationMs)}</strong>
                            </div>
                            <div className="admin-bar__track">
                              <div
                                className="admin-bar__fill"
                                style={{ width: `${Math.round((f.durationMs / max) * 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="admin-section">
              <div className="admin-section__head">
                <h2 className="admin-section__title">Снимок структуры</h2>
                <p className="admin-section__sub">Не зависит от периода</p>
              </div>
              <div className="admin-chart-grid">
                <div className="admin-panel">
                  <h3 className="admin-panel__title">Роли пользователей</h3>
                  <p className="admin-panel__hint">Доля по типам аккаунтов</p>
                  <div className="admin-bars">
                    {roleEntries.map(([role, count]) => (
                      <BarRow key={role} label={ROLE_LABEL[role] || role} value={count} max={roleMax} />
                    ))}
                  </div>
                </div>
                <div className="admin-panel">
                  <h3 className="admin-panel__title">Инвайты клиентов</h3>
                  <p className="admin-panel__hint">Статусы приглашений в CRM</p>
                  <div className="admin-bars">
                    <BarRow label="Зарегистрированы" value={s.inviteRegistered} max={inviteMax} tone="sage" />
                    <BarRow label="Ожидают" value={s.invitePending} max={inviteMax} tone="warn" />
                    <BarRow label="Истекли" value={s.inviteExpired} max={inviteMax} tone="muted" />
                  </div>
                  <p className="admin-panel__hint" style={{ marginTop: 14, marginBottom: 0 }}>
                    Психологи: верифицированы {s.psychologistsVerified} · без верификации{' '}
                    {s.psychologistsUnverified}
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
