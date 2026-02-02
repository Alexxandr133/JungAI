import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ClientNavbar } from '../../components/ClientNavbar';
import '../../styles/tokens.css';

type Psychologist = {
  id: string;
  name: string;
  email: string;
  bio?: string;
  specialization?: string[];
  experience?: number;
  avatarUrl?: string;
  verified?: boolean;
  rating?: number;
  reviewsCount?: number;
};

export default function ClientPsychologistsList() {
  const { token } = useAuth();
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedPsychologist, setSelectedPsychologist] = useState<Psychologist | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestType, setRequestType] = useState<'chat' | 'session'>('chat');

  useEffect(() => {
    loadPsychologists();
  }, []);

  async function loadPsychologists() {
    setLoading(true);
    try {
      const res = await api<{ psychologists: Psychologist[] }>('/api/psychologists/public', { token: token ?? undefined });
      setPsychologists(res.psychologists || []);
    } catch (e) {
      // Demo data
      const demo: Psychologist[] = [
        {
          id: 'p1',
          name: 'Анна Иванова',
          email: 'anna@example.com',
          bio: 'Сертифицированный психолог с 10-летним опытом работы. Специализация: аналитическая психология, работа со сновидениями, архетипическая терапия.',
          specialization: ['Аналитическая психология', 'Работа со сновидениями', 'Архетипическая терапия'],
          experience: 10,
          avatarUrl: 'https://i.pravatar.cc/150?img=47',
          verified: true,
          rating: parseFloat((4.5 + Math.random() * 0.5).toFixed(1)),
          reviewsCount: 24
        },
        {
          id: 'p2',
          name: 'Дмитрий Смирнов',
          email: 'dmitry@example.com',
          bio: 'Клинический психолог, специалист по работе с тревожными расстройствами и депрессией. Интегративный подход.',
          specialization: ['Клиническая психология', 'Тревожные расстройства', 'Депрессия'],
          experience: 8,
          avatarUrl: 'https://i.pravatar.cc/150?img=12',
          verified: true,
          rating: 4.9,
          reviewsCount: 31
        },
        {
          id: 'p3',
          name: 'Мария Петрова',
          email: 'maria@example.com',
          bio: 'Юнгианский аналитик, работаю с комплексом Тени, активным воображением и сновидениями.',
          specialization: ['Юнгианский анализ', 'Работа с Тенью', 'Активное воображение'],
          experience: 12,
          avatarUrl: 'https://i.pravatar.cc/150?img=20',
          verified: true,
          rating: 4.7,
          reviewsCount: 18
        },
        {
          id: 'p4',
          name: 'Алексей Волков',
          email: 'alexey@example.com',
          bio: 'Психолог-консультант, специализируюсь на кризисах среднего возраста и поиске смысла жизни.',
          specialization: ['Экзистенциальная психология', 'Кризисы', 'Поиск смысла'],
          experience: 6,
          avatarUrl: 'https://i.pravatar.cc/150?img=33',
          verified: true,
          rating: 4.6,
          reviewsCount: 15
        }
      ];
      setPsychologists(demo);
    } finally {
      setLoading(false);
    }
  }

  const filtered = psychologists.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.bio?.toLowerCase().includes(query.toLowerCase()) ||
    p.specialization?.some(s => s.toLowerCase().includes(query.toLowerCase()))
  );

  function handleRequestChat(psych: Psychologist) {
    setSelectedPsychologist(psych);
    setRequestType('chat');
    setRequestMessage('');
    setShowRequestModal(true);
  }

  function handleRequestSession(psych: Psychologist) {
    setSelectedPsychologist(psych);
    setRequestType('session');
    setRequestMessage('');
    setShowRequestModal(true);
  }

  async function submitRequest() {
    if (!selectedPsychologist || !requestMessage.trim() || !token) return;
    
    try {
      await api('/api/support/request', {
        method: 'POST',
        token: token,
        body: {
          psychologistId: selectedPsychologist.id,
          type: requestType,
          message: requestMessage,
          allowWorkAreaAccess: false
        }
      });
      
      alert('Запрос отправлен! Психолог свяжется с вами.');
      setShowRequestModal(false);
      setSelectedPsychologist(null);
      setRequestMessage('');
    } catch (e: any) {
      alert('Ошибка: ' + (e.message || 'Не удалось отправить запрос'));
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ClientNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Психологи</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
            Найдите подходящего психолога и запишитесь на консультацию
          </p>
          
          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 600, marginBottom: 32 }}>
            <span style={{ position: 'absolute', left: 12, top: 10, opacity: .7 }}>🔎</span>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Поиск по имени, специализации..."
              style={{
                width: '100%',
                padding: '10px 12px 10px 34px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: 14
              }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div style={{ color: 'var(--text-muted)' }}>Загрузка...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Психологи не найдены</div>
            <div style={{ color: 'var(--text-muted)' }}>Попробуйте изменить параметры поиска</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24 }}>
            {filtered.map(psych => (
              <div key={psych.id} className="card card-hover-shimmer" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'start', gap: 16, marginBottom: 16 }}>
                  <div style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'var(--surface-2)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 24,
                    fontWeight: 600,
                    color: 'var(--text)',
                    flexShrink: 0,
                    overflow: 'hidden',
                    border: '2px solid rgba(255,255,255,0.1)'
                  }}>
                    {psych.avatarUrl ? (
                      <img 
                        src={psych.avatarUrl.startsWith('http') ? psych.avatarUrl : `http://localhost:4000${psych.avatarUrl}`} 
                        alt={psych.name} 
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `<span>${psych.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>`;
                          }
                        }}
                      />
                    ) : (
                      <span>{psych.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                        {psych.name}
                      </h3>
                      {psych.verified && (
                        <span style={{ fontSize: 16 }} title="Верифицирован">✓</span>
                      )}
                    </div>
                    {psych.rating && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ color: '#ffd700', fontSize: 14 }}>⭐</span>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{psych.rating}</span>
                        {psych.reviewsCount && (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            ({psych.reviewsCount} отзывов)
                          </span>
                        )}
                      </div>
                    )}
                    {psych.experience && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                        Опыт: {psych.experience} {psych.experience === 1 ? 'год' : psych.experience < 5 ? 'года' : 'лет'}
                      </div>
                    )}
                  </div>
                </div>
                
                {psych.bio && (
                  <p style={{ 
                    fontSize: 14, 
                    color: 'var(--text-muted)', 
                    lineHeight: 1.6, 
                    marginBottom: 16,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {psych.bio}
                  </p>
                )}
                
                {psych.specialization && psych.specialization.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {psych.specialization.slice(0, 3).map((spec, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            background: 'var(--surface-2)',
                            color: 'var(--text-muted)',
                            fontSize: 12,
                            fontWeight: 500
                          }}
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleRequestChat(psych)}
                    className="button secondary"
                    style={{ flex: 1, padding: '10px 16px', fontSize: 14 }}
                  >
                    💬 Написать
                  </button>
                  <button
                    onClick={() => handleRequestSession(psych)}
                    className="button"
                    style={{ flex: 1, padding: '10px 16px', fontSize: 14 }}
                  >
                    📅 Записаться
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Request Modal */}
        {showRequestModal && selectedPsychologist && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 2000,
              padding: 24
            }}
            onClick={() => setShowRequestModal(false)}
          >
            <div
              className="card"
              style={{
                maxWidth: 500,
                width: '100%',
                padding: 24,
                background: 'var(--surface)',
                border: '1px solid rgba(255,255,255,0.12)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 700 }}>
                {requestType === 'chat' ? 'Запрос на чат' : 'Запрос на сессию'}
              </h2>
              <p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                Психолог: <strong>{selectedPsychologist.name}</strong>
              </p>
              <p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                Укажите цель вашего запроса:
              </p>
              <textarea
                value={requestMessage}
                onChange={e => setRequestMessage(e.target.value)}
                placeholder="Опишите, с какой целью вы хотите связаться с психологом..."
                style={{
                  width: '100%',
                  minHeight: 120,
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  marginBottom: 16
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="button secondary"
                  style={{ padding: '10px 20px' }}
                >
                  Отмена
                </button>
                <button
                  onClick={submitRequest}
                  disabled={!requestMessage.trim()}
                  className="button"
                  style={{ padding: '10px 20px' }}
                >
                  Отправить запрос
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

