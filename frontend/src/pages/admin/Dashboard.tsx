import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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

export default function AdminDashboard() {
  const { token } = useAuth();
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
      <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, ...style }}>
        {label}
      </span>
    );
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Дашборд администратора</h1>
          <div className="small" style={{ color: 'var(--text-muted)' }}>Обзор системы и техподдержки</div>
        </div>

        {error && (
          <div className="card" style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: 20, borderRadius: 12, color: '#ef4444' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Загрузка...</div>
        ) : stats ? (
          <div style={{ display: 'grid', gap: 24 }}>
            {/* Статистика техподдержки */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Техподдержка</h2>
                <Link to="/admin/support" className="button secondary" style={{ padding: '8px 16px', fontSize: 14 }}>
                  Все запросы →
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Всего запросов</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{stats.support.total}</div>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>За все время</div>
                </div>
                <div className="card" style={{ padding: 20, border: '2px solid rgba(59, 130, 246, 0.3)' }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Открытых</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4, color: '#3b82f6' }}>{stats.support.open}</div>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>Требуют внимания</div>
                </div>
                <div className="card" style={{ padding: 20, border: '2px solid rgba(255, 193, 7, 0.3)' }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>В работе</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4, color: '#ffc107' }}>{stats.support.inProgress}</div>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>Обрабатываются</div>
                </div>
                <div className="card" style={{ padding: 20, border: '2px solid rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Решенных</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4, color: '#10b981' }}>{stats.support.resolved}</div>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>Успешно закрыто</div>
                </div>
                <div className="card" style={{ padding: 20, border: '2px solid rgba(59, 130, 246, 0.5)' }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>С доступом к РО</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4, color: '#3b82f6' }}>{stats.support.withWorkAreaAccess}</div>
                  <Link to="/admin/open-access" className="small" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                    Открыть функционал →
                  </Link>
                </div>
              </div>
            </div>

            {/* Статистика верификации */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Верификация</h2>
                <Link to="/admin/verification" className="button secondary" style={{ padding: '8px 16px', fontSize: 14 }}>
                  Все запросы →
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Всего запросов</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{stats.verification.total}</div>
                </div>
                <div className="card" style={{ padding: 20, border: '2px solid rgba(255, 193, 7, 0.3)' }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>На проверке</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4, color: '#ffc107' }}>{stats.verification.pending}</div>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>Требуют решения</div>
                </div>
                <div className="card" style={{ padding: 20, border: '2px solid rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Одобрено</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4, color: '#10b981' }}>{stats.verification.approved}</div>
                </div>
                <div className="card" style={{ padding: 20, border: '2px solid rgba(239, 68, 68, 0.3)' }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Отклонено</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4, color: '#ef4444' }}>{stats.verification.rejected}</div>
                </div>
              </div>
            </div>

            {/* Общая статистика системы */}
            <div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Система</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Всего пользователей</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{stats.system.totalUsers}</div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Психологов</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{stats.system.totalPsychologists}</div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Клиентов</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{stats.system.totalClients}</div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Снов</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{stats.system.totalDreams}</div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Сессий</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{stats.system.totalSessions}</div>
                </div>
              </div>
            </div>

            {/* Последние запросы в техподдержку */}
            {stats.recentSupportRequests.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Последние запросы</h2>
                  <Link to="/admin/support" className="button secondary" style={{ padding: '8px 16px', fontSize: 14 }}>
                    Все запросы →
                  </Link>
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {stats.recentSupportRequests.map(req => (
                    <Link
                      key={req.id}
                      to="/admin/support"
                      className="card"
                      style={{
                        padding: 16,
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'block',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{req.title}</div>
                            {getStatusBadge(req.status)}
                          </div>
                          <div className="small" style={{ color: 'var(--text-muted)' }}>
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

