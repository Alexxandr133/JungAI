import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';
import { StarfieldBackground } from '../../components/visuals';
import { PlatformIcon } from '../../components/icons';
import { useNavigate } from 'react-router-dom';

type ParanormalCard = {
  id: string;
  type: string;
  description: string;
  tags?: string[];
  clientId?: string;
  userId?: string;
  createdAt: string;
};

type Client = { id: string; name?: string };

export default function ParanormalList() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const isClient = user?.role === 'client';
  const isPsychologist = user?.role === 'psychologist' || user?.role === 'admin';

  const [items, setItems] = useState<ParanormalCard[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'mine'>(isClient ? 'mine' : 'all');
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [formType, setFormType] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formClientId, setFormClientId] = useState('');

  useEffect(() => {
    if (!token || !isPsychologist) {
      setIsVerified(null);
      return;
    }
    checkVerification(token).then(result => {
      setIsVerified(result.isVerified);
      setVerificationStatus(result.status);
    });
  }, [token, isPsychologist]);

  useEffect(() => {
    if (isPsychologist && isVerified === false) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api<{ items: ParanormalCard[] }>('/api/paranormal', { token: token ?? undefined });
        setItems(res.items || []);
      } catch (e: any) {
        setError(e.message || 'Не удалось загрузить записи');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, isPsychologist, isVerified]);

  useEffect(() => {
    if (!token || isClient) return;
    (async () => {
      try {
        const res = await api<{ items: any[] }>('/api/clients', { token });
        const list = (res.items || []).map(c => ({ id: String(c.id), name: c.name })) as Client[];
        setClients(list);
        if (!formClientId && list[0]?.id) setFormClientId(list[0].id);
      } catch {
        setClients([]);
      }
    })();
  }, [token, isClient, formClientId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (scope === 'mine' && user?.id) {
      list = list.filter(d => String(d.userId) === String(user.id));
    }
    if (!q) return list;
    return list.filter(d =>
      (d.type || '').toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q)
    );
  }, [items, query, scope, user?.id]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      type: formType.trim() || 'Без названия',
      description: formDescription.trim(),
      tags: [],
      ...(isClient ? {} : { clientId: formClientId || undefined })
    };
    const tempId = `tmp-${Date.now()}`;
    const optimistic: ParanormalCard = {
      id: tempId,
      createdAt: new Date().toISOString(),
      ...payload
    };
    setItems(prev => [optimistic, ...prev]);
    try {
      const created = await api<ParanormalCard>('/api/paranormal', {
        method: 'POST',
        token: token ?? undefined,
        body: payload
      });
      setItems(prev => prev.map(x => (x.id === tempId ? created : x)));
    } catch {
      // leave optimistic entry for continuity
    }
    setShowModal(false);
  }

  async function onDelete(id: string, title: string) {
    if (!window.confirm(`Удалить запись "${title}"?`)) return;
    setItems(prev => prev.filter(x => x.id !== id));
    try {
      await api(`/api/paranormal/${id}`, { method: 'DELETE', token: token ?? undefined });
    } catch (e: any) {
      setError(e.message || 'Не удалось удалить запись');
    }
  }

  if (isPsychologist && token && isVerified === false) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PsychologistNavbar />
        <VerificationRequired verificationStatus={verificationStatus} />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <StarfieldBackground opacity={1} />
      <UniversalNavbar />
      <main style={{ flex: 1, padding: '24px clamp(16px, 5vw, 48px)', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Необьяснимое</h1>
            <span className="small" style={{ color: 'var(--text-muted)' }}>· {items.length}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="button" onClick={() => { setFormType(''); setFormDescription(''); setShowModal(true); }}>
              + Новая запись
            </button>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
              <input
                placeholder="Поиск по названиям и тексту"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{ width: 280, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(20, 25, 40, 0.7)', color: 'var(--text)' }}
              />
              {!isClient && (
                <select
                  value={scope}
                  onChange={e => setScope(e.target.value as 'all' | 'mine')}
                  style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(20, 25, 40, 0.7)', color: 'var(--text)' }}
                >
                  <option value="all">Все записи</option>
                  <option value="mine">Мои</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {loading && <div className="card" style={{ padding: 20 }}>Загрузка...</div>}
        {error && <div className="card" style={{ padding: 20, border: '1px solid rgba(255,80,80,0.4)' }}>{error}</div>}
        {!loading && !error && (
          <div className="dreams-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 1400, margin: '0 auto' }}>
            {filtered.map(item => (
              <div key={item.id} className="card" style={{ padding: 18, border: '1px solid rgba(255,255,255,0.2)', background: 'linear-gradient(135deg, rgba(30, 35, 50, 0.9) 0%, rgba(25, 30, 45, 0.95) 100%)' }}>
                <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                  <div style={{ color: 'var(--primary)' }}>
                    <PlatformIcon name="star" size={26} strokeWidth={1.5} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                      <h3 style={{ margin: 0, fontSize: 17 }}>{item.type || 'Без названия'}</h3>
                      <span className="small" style={{ color: 'var(--text-muted)' }}>
                        {new Date(item.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.description}
                    </p>
                    {token && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        {!isClient && (
                          <button
                            className="button secondary"
                            disabled={!item.clientId}
                            onClick={() => item.clientId && navigate(`/psychologist/work-area?client=${encodeURIComponent(String(item.clientId))}`)}
                            title={item.clientId ? 'Открыть рабочую область клиента' : 'Клиент не указан'}
                            style={{ padding: '6px 8px', fontSize: 11 }}
                          >
                            К клиенту
                          </button>
                        )}
                        <button className="button secondary" onClick={() => onDelete(item.id, item.type)} style={{ padding: '6px 8px', fontSize: 11, color: '#ff7b7b' }}>
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.75)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 1000 }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: 'min(600px, 96vw)', padding: 28 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <PlatformIcon name="star" size={44} strokeWidth={1.25} />
              <div style={{ fontWeight: 800, fontSize: 24, marginTop: 10 }}>Записать необъяснимое</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Опишите необычное явление в формате карточки</div>
            </div>
            <form onSubmit={onCreate} style={{ display: 'grid', gap: 18 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Название</label>
                <input value={formType} onChange={e => setFormType(e.target.value)} required style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Описание явления</label>
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={8} required style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', resize: 'vertical' }} />
              </div>
              {!isClient && token && (
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Клиент</label>
                  <select value={formClientId} onChange={e => setFormClientId(e.target.value)} required style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" className="button secondary" onClick={() => setShowModal(false)}>Отмена</button>
                <button type="submit" className="button">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`
        @media (max-width: 768px) {
          .dreams-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
        }
      `}</style>
    </div>
  );
}
