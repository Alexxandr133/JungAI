import { type CSSProperties, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAppearance } from '../../context/AppearanceContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';

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

function StatCard({
  label,
  value,
  hint,
  accent,
  isLight
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: 'blue' | 'amber' | 'green' | 'red' | 'slate';
  isLight: boolean;
}) {
  const borderAccent =
    accent === 'blue'
      ? isLight
        ? '1px solid rgba(59, 130, 246, 0.35)'
        : '1px solid rgba(59, 130, 246, 0.4)'
      : accent === 'amber'
        ? isLight
          ? '1px solid rgba(245, 158, 11, 0.4)'
          : '1px solid rgba(251, 191, 36, 0.35)'
        : accent === 'green'
          ? isLight
            ? '1px solid rgba(16, 185, 129, 0.4)'
            : '1px solid rgba(52, 211, 153, 0.35)'
          : accent === 'red'
            ? isLight
              ? '1px solid rgba(239, 68, 68, 0.4)'
              : '1px solid rgba(248, 113, 113, 0.35)'
            : isLight
              ? '1px solid rgba(15, 23, 42, 0.08)'
              : '1px solid rgba(255, 255, 255, 0.08)';

  const valueColor =
    accent === 'blue'
      ? '#3b82f6'
      : accent === 'amber'
        ? isLight
          ? '#b45309'
          : '#fbbf24'
        : accent === 'green'
          ? '#10b981'
          : accent === 'red'
            ? '#ef4444'
            : 'var(--text)';

  const cardStyle: CSSProperties = {
    padding: '12px 14px',
    borderRadius: 10,
    background: 'var(--surface)',
    border: borderAccent,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  };

  return (
    <div style={cardStyle}>
      <div className="small" style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 12, lineHeight: 1.25 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: valueColor, lineHeight: 1.15 }}>{value}</div>
      {hint ? (
        <div className="small" style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.3 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminDashboard() {
  const { token } = useAuth();
  const { appearance } = useAppearance();
  const isLight = appearance.colorMode === 'light';
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadStats();
    }
  }, [token]);

  async function loadStats() {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api<DashboardStats>('/api/admin/dashboard', { token });
      setStats(res);
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить статистику');
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      open: { background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' },
      in_progress: { background: 'rgba(255, 193, 7, 0.2)', color: '#ffc107' },
      resolved: { background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' },
      closed: { background: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af' }
    };
    const labels = {
      open: 'Открыт',
      in_progress: 'В работе',
      resolved: 'Решен',
      closed: 'Закрыт'
    };
    const style = styles[status as keyof typeof styles] || styles.open;
    const label = labels[status as keyof typeof labels] || status;
    return (
      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, ...style }}>
        {label}
      </span>
    );
  };

  const gridStats: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
    gap: 10
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      <main
        style={{
          flex: 1,
          padding: '20px clamp(14px, 4vw, 40px)',
          maxWidth: 1100,
          margin: '0 auto',
          width: '100%',
          overflowX: 'hidden'
        }}
      >
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Дашборд администратора</h1>
          <div className="small" style={{ color: 'var(--text-muted)' }}>Обзор системы и техподдержки</div>
        </div>

        {error && (
          <div className="card" style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: 16, borderRadius: 10, color: '#ef4444' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Загрузка...</div>
        ) : stats ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              className="card"
              style={{
                padding: '14px 16px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                borderRadius: 12
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Управление пользователями</div>
                <div className="small" style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.45 }}>
                  Пароли, снятие верификации, удаление учётных записей, перенос CRM-клиентов между психологами
                </div>
              </div>
              <Link to="/admin/users" className="button" style={{ padding: '8px 16px', fontSize: 13, flexShrink: 0 }}>
                Открыть →
              </Link>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Техподдержка</h2>
                <Link to="/admin/support" className="button secondary" style={{ padding: '6px 12px', fontSize: 13 }}>
                  Все запросы →
                </Link>
              </div>
              <div style={gridStats}>
                <StatCard label="Всего запросов" value={stats.support.total} hint="За всё время" isLight={isLight} accent="slate" />
                <StatCard label="Открытых" value={stats.support.open} hint="Требуют внимания" isLight={isLight} accent="blue" />
                <StatCard label="В работе" value={stats.support.inProgress} isLight={isLight} accent="amber" />
                <StatCard label="Решенных" value={stats.support.resolved} isLight={isLight} accent="green" />
                <StatCard
                  label="С доступом к РО"
                  value={stats.support.withWorkAreaAccess}
                  hint="Открытый функционал"
                  isLight={isLight}
                  accent="blue"
                />
              </div>
              {stats.support.withWorkAreaAccess > 0 ? (
                <div style={{ marginTop: 8 }}>
                  <Link to="/admin/open-access" className="small" style={{ color: '#3b82f6', textDecoration: 'underline', fontSize: 12 }}>
                    Открыть функционал →
                  </Link>
                </div>
              ) : null}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Верификация</h2>
                <Link to="/admin/verification" className="button secondary" style={{ padding: '6px 12px', fontSize: 13 }}>
                  Все запросы →
                </Link>
              </div>
              <div style={gridStats}>
                <StatCard label="Всего запросов" value={stats.verification.total} isLight={isLight} accent="slate" />
                <StatCard label="На проверке" value={stats.verification.pending} isLight={isLight} accent="amber" />
                <StatCard label="Одобрено" value={stats.verification.approved} isLight={isLight} accent="green" />
                <StatCard label="Отклонено" value={stats.verification.rejected} isLight={isLight} accent="red" />
              </div>
            </div>

            <div>
              <h2 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700 }}>Система</h2>
              <div style={gridStats}>
                <StatCard label="Пользователей" value={stats.system.totalUsers} isLight={isLight} accent="slate" />
                <StatCard label="Психологов" value={stats.system.totalPsychologists} isLight={isLight} accent="slate" />
                <StatCard label="Клиентов" value={stats.system.totalClients} isLight={isLight} accent="slate" />
                <StatCard label="Снов" value={stats.system.totalDreams} isLight={isLight} accent="slate" />
                <StatCard label="Сессий (терапия)" value={stats.system.totalSessions} isLight={isLight} accent="slate" />
                <StatCard
                  label="Видео: предстоящие"
                  value={stats.system.videoMeetingsUpcoming ?? 0}
                  hint="События с комнатой, старт в будущем"
                  isLight={isLight}
                  accent="blue"
                />
                <StatCard
                  label="Видео: по расписанию сейчас"
                  value={stats.system.videoMeetingsInSlot ?? 0}
                  hint="Окно встречи: началось, не закончилось"
                  isLight={isLight}
                  accent="amber"
                />
                <StatCard
                  label="Видео: прошедшие"
                  value={stats.system.videoMeetingsPast ?? 0}
                  hint="Есть endsAt и время окончания прошло"
                  isLight={isLight}
                  accent="slate"
                />
                <StatCard
                  label="Комнат LiveKit (всего)"
                  value={stats.system.voiceRoomsTotal ?? 0}
                  hint="Записей VoiceRoom в БД"
                  isLight={isLight}
                  accent="green"
                />
              </div>
            </div>

            {stats.recentSupportRequests.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Последние запросы</h2>
                  <Link to="/admin/support" className="button secondary" style={{ padding: '6px 12px', fontSize: 13 }}>
                    Все запросы →
                  </Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.recentSupportRequests.map((req) => (
                    <Link
                      key={req.id}
                      to="/admin/support"
                      className="card"
                      style={{
                        padding: '12px 14px',
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'block',
                        borderRadius: 10,
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = isLight ? '0 6px 18px rgba(15,23,42,0.08)' : '0 8px 24px rgba(0,0,0,0.35)';
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLElement>) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{req.title}</div>
                            {getStatusBadge(req.status)}
                          </div>
                          <div className="small" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {req.psychologistName || req.psychologistEmail} • {new Date(req.createdAt).toLocaleString('ru-RU')}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
