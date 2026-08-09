import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { AdminNavbar } from '../../components/AdminNavbar';
import './Analytics.css';

type AnalyticsPayload = {
  range: { days: number };
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
};

function Sparkline({
  values,
  labels,
  color = 'var(--primary)',
}: {
  values: number[];
  labels: string[];
  color?: string;
}) {
  const w = 560;
  const h = 160;
  const pad = 12;
  const max = Math.max(1, ...values);
  const pts = values
    .map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="admin-analytics__chart">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="160" role="img" aria-label="chart">
        <polyline fill="none" stroke={color} strokeWidth="2.5" points={pts} />
        {values.map((v, i) => {
          const x = pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
          const y = h - pad - (v / max) * (h - pad * 2);
          if (values.length > 40 && i % Math.ceil(values.length / 20) !== 0) return null;
          return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />;
        })}
      </svg>
      <div className="admin-analytics__chart-meta">
        <span>{labels[0]}</span>
        <span>max {max}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="admin-analytics__bar-row">
      <div className="admin-analytics__bar-label">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="admin-analytics__bar-track">
        <div className="admin-analytics__bar-fill" style={{ width: `${pct}%` }} />
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
      .catch((e: any) => setError(e.message || 'Не удалось загрузить аналитику'))
      .finally(() => setLoading(false));
  }, [token, days]);

  const s = data?.summary;
  const roleEntries = Object.entries(s?.usersByRole || {});
  const roleMax = Math.max(1, ...roleEntries.map(([, v]) => v));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AdminNavbar />
      <main className="admin-analytics">
        <div className="admin-analytics__head">
          <div>
            <h1>Аналитика</h1>
            <p>Сегменты пользователей и клиентов CRM за выбранный период.</p>
          </div>
          <div className="admin-analytics__periods">
            {([7, 30, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                className={days === d ? 'button' : 'button secondary'}
                onClick={() => setDays(d)}
              >
                {d} дн.
              </button>
            ))}
          </div>
        </div>

        {error && <div className="admin-analytics__error">{error}</div>}
        {loading && <div className="small" style={{ color: 'var(--text-muted)' }}>Загрузка…</div>}

        {data && s && (
          <>
            <div className="admin-analytics__cards">
              <div className="admin-analytics__card">
                <div className="small">Пользователи</div>
                <div className="admin-analytics__value">{s.totalUsers}</div>
                <div className="small">+{s.registrationsInRange} за период</div>
              </div>
              <div className="admin-analytics__card">
                <div className="small">Психологи verified</div>
                <div className="admin-analytics__value">{s.psychologistsVerified}</div>
                <div className="small">не verified: {s.psychologistsUnverified}</div>
              </div>
              <div className="admin-analytics__card">
                <div className="small">Клиенты CRM</div>
                <div className="admin-analytics__value">{s.clientsActive}</div>
                <div className="small">архив: {s.clientsArchive}</div>
              </div>
              <div className="admin-analytics__card">
                <div className="small">Сессии / задачи</div>
                <div className="admin-analytics__value">{s.sessionsInRange}</div>
                <div className="small">открытых задач: {s.openTasks}</div>
              </div>
            </div>

            <div className="admin-analytics__grid">
              <section className="card admin-analytics__panel">
                <h2>Регистрации по дням</h2>
                <Sparkline values={data.series.registrations} labels={data.series.days} />
              </section>
              <section className="card admin-analytics__panel">
                <h2>Сессии по дням</h2>
                <Sparkline values={data.series.sessions} labels={data.series.days} color="#22c55e" />
              </section>
              <section className="card admin-analytics__panel">
                <h2>Роли пользователей</h2>
                {roleEntries.map(([role, count]) => (
                  <BarRow key={role} label={role} value={count} max={roleMax} />
                ))}
              </section>
              <section className="card admin-analytics__panel">
                <h2>Инвайты клиентов</h2>
                <BarRow label="registered" value={s.inviteRegistered} max={Math.max(1, s.clientsActive)} />
                <BarRow label="pending" value={s.invitePending} max={Math.max(1, s.clientsActive)} />
                <BarRow label="expired" value={s.inviteExpired} max={Math.max(1, s.clientsActive)} />
                <div className="small" style={{ marginTop: 10, color: 'var(--text-muted)' }}>
                  Ожидают верификации психологов: {s.pendingVerifications}
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
