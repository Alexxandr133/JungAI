import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { PlatformIcon } from '../../components/icons';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';

export default function ClientProfileView() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [client, setClient] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  
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
  const [stats, setStats] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'stats' | 'sessions' | 'journal'>('info');

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
    if (isVerified !== false && id) {
      loadClient();
    }
  }, [id, token, isVerified]);

  // Обновление данных при возврате на страницу
  useEffect(() => {
    if (isVerified !== false && id) {
      loadClient();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isVerified]);

  // Обновление данных при фокусе окна (когда пользователь возвращается на вкладку)
  useEffect(() => {
    const handleFocus = () => {
      if (isVerified !== false && token && id) {
        loadClient();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id, isVerified]);

  async function loadClient() {
    if (!token || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [clientRes, sessionsRes, journalRes] = await Promise.all([
        api<any>(`/api/clients/${id}`, { token }),
        api<{ items: any[] }>(`/api/clients/${id}/sessions`, { token }).catch(() => ({ items: [] })),
        api<{ items: any[] }>(`/api/clients/${id}/journal`, { token }).catch(() => ({ items: [] }))
      ]);
      
      setClient(clientRes);
      setProfile(clientRes.profile);
      setSessions(sessionsRes.items || []);
      setJournalEntries(journalRes.items || []);
      
      // Подсчитываем статистику
      const dreamsRes = await api<{ items: any[] }>(`/api/dreams?clientId=${id}`, { token }).catch(() => ({ items: [] }));
      setStats({
        dreams: dreamsRes.items?.length || 0,
        sessions: sessionsRes.items?.length || 0,
        journalEntries: journalRes.items?.length || 0
      });
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить данные клиента');
    } finally {
      setLoading(false);
    }
  }

  // Show verification required message
  if (isVerified === false && token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PsychologistNavbar />
        <VerificationRequired verificationStatus={verificationStatus} />
      </div>
    );
  }

  const profileData = profile?.bio ? (typeof profile.bio === 'string' ? JSON.parse(profile.bio) : profile.bio) : {};

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: '100%',
          overflowX: 'hidden'
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <Link to="/clients" className="button secondary" style={{ padding: '8px 16px', fontSize: 14 }}>
              ← Назад к списку
            </Link>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Профиль клиента</h1>
          </div>
          {client && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              {getAvatarUrl(client.avatarUrl || profile?.avatarUrl, id) ? (
                <img
                  src={getAvatarUrl(client.avatarUrl || profile?.avatarUrl, id) || ''}
                  key={`avatar-${id}-${client.avatarUrl || profile?.avatarUrl || 'none'}`}
                  alt={client.name || 'Аватар'}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.avatar-fallback')) {
                      const fallback = document.createElement('div');
                      fallback.className = 'avatar-fallback';
                      fallback.style.cssText = 'width: 64px; height: 64px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 800; font-size: 24px;';
                      fallback.textContent = (client.name || '?').trim().charAt(0).toUpperCase();
                      parent.appendChild(fallback);
                    }
                  }}
                />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0b0f1a', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 24 }}>
                  {(client.name || '?').trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{client.name}</div>
                <div className="small" style={{ color: 'var(--text-muted)' }}>
                  {client.email && <span>{client.email}</span>}
                  {client.phone && <span>{client.email ? ' • ' : ''}{client.phone}</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--surface-2)', borderRadius: 10, color: '#ff7b7b' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div className="small" style={{ opacity: 0.7 }}>Загрузка данных...</div>
          </div>
        ) : client ? (
          <div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <button 
                className={activeTab === 'info' ? 'button' : 'button secondary'} 
                onClick={() => setActiveTab('info')}
                style={{ padding: '10px 20px' }}
              >
                Информация
              </button>
              <button 
                className={activeTab === 'stats' ? 'button' : 'button secondary'} 
                onClick={() => setActiveTab('stats')}
                style={{ padding: '10px 20px' }}
              >
                Статистика
              </button>
              <button 
                className={activeTab === 'sessions' ? 'button' : 'button secondary'} 
                onClick={() => setActiveTab('sessions')}
                style={{ padding: '10px 20px' }}
              >
                Сессии
              </button>
              <button 
                className={activeTab === 'journal' ? 'button' : 'button secondary'} 
                onClick={() => setActiveTab('journal')}
                style={{ padding: '10px 20px' }}
              >
                Дневник
              </button>
            </div>

            {/* Info Tab */}
            {activeTab === 'info' && (
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ marginTop: 0, marginBottom: 20 }}>Основная информация</h2>
                <div style={{ display: 'grid', gap: 16 }}>
                  {profile?.age && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Возраст</div>
                      <div style={{ fontSize: 16 }}>{profile.age} лет</div>
                    </div>
                  )}
                  {profile?.gender && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Пол</div>
                      <div style={{ fontSize: 16 }}>{profile.gender === 'male' ? 'Мужской' : profile.gender === 'female' ? 'Женский' : profile.gender}</div>
                    </div>
                  )}
                  {profileData.archetype && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Архетип</div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{profileData.archetype}</div>
                    </div>
                  )}
                  {profileData.diagnosis && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Диагноз</div>
                      <div style={{ fontSize: 16 }}>{profileData.diagnosis}</div>
                    </div>
                  )}
                  {profileData.therapyGoal && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Цель терапии</div>
                      <div style={{ fontSize: 16, whiteSpace: 'pre-wrap' }}>{profileData.therapyGoal}</div>
                    </div>
                  )}
                  {profileData.request && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Запрос</div>
                      <div style={{ fontSize: 16, whiteSpace: 'pre-wrap' }}>{profileData.request}</div>
                    </div>
                  )}
                  {profileData.values && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Ценности / Кредо</div>
                      <div style={{ fontSize: 16, whiteSpace: 'pre-wrap' }}>{profileData.values}</div>
                    </div>
                  )}
                  {profileData.irritants && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Раздражители</div>
                      <div style={{ fontSize: 16, whiteSpace: 'pre-wrap' }}>{profileData.irritants}</div>
                    </div>
                  )}
                  {!profile && (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div className="small">Клиент еще не заполнил свой профиль</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && (
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ marginTop: 0, marginBottom: 20 }}>Статистика</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <Link to={`/dreams?client=${id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card" style={{ padding: 20, textAlign: 'center', transition: 'transform 0.2s', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <div style={{ marginBottom: 8, color: 'var(--primary)' }}>
                        <PlatformIcon name="dreams" size={32} strokeWidth={1.4} />
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>{stats?.dreams || 0}</div>
                      <div className="small" style={{ color: 'var(--text-muted)' }}>Снов</div>
                    </div>
                  </Link>
                  <Link to={`/clients/${id}?tab=sessions`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card" style={{ padding: 20, textAlign: 'center', transition: 'transform 0.2s', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>{stats?.sessions || 0}</div>
                      <div className="small" style={{ color: 'var(--text-muted)' }}>Сессий</div>
                    </div>
                  </Link>
                  <Link to={`/clients/${id}?tab=journal`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card" style={{ padding: 20, textAlign: 'center', transition: 'transform 0.2s', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>{stats?.journalEntries || 0}</div>
                      <div className="small" style={{ color: 'var(--text-muted)' }}>Записей в дневнике</div>
                    </div>
                  </Link>
                </div>
              </div>
            )}

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ marginTop: 0 }}>Сессии</h2>
                  <Link to={`/psychologist/work-area?client=${id}`} className="button" style={{ padding: '8px 16px', fontSize: 14 }}>
                    Открыть рабочую область
                  </Link>
                </div>
                {sessions.length === 0 ? (
                  <div className="small" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
                    Пока нет сессий
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {sessions.slice(0, 10).map((session: any) => (
                      <div key={session.id} style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                          <div style={{ fontWeight: 600 }}>
                            {new Date(session.date).toLocaleDateString('ru-RU', { 
                              day: 'numeric', 
                              month: 'long', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                        {session.summary && (
                          <div style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap', marginTop: 8 }}>
                            {session.summary}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Journal Tab */}
            {activeTab === 'journal' && (
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ marginTop: 0, marginBottom: 20 }}>Дневник клиента</h2>
                {journalEntries.length === 0 ? (
                  <div className="small" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
                    Пока нет записей в дневнике
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {journalEntries.slice(0, 10).map((entry: any) => (
                      <div key={entry.id} style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                          {new Date(entry.createdAt).toLocaleDateString('ru-RU', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        <div style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                          {entry.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
