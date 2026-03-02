import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { GuestNavbar } from '../../components/GuestNavbar';
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

export default function PsychologistsList() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBios, setExpandedBios] = useState<Set<string>>(new Set());
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
    if (!user) {
      setSelectedPsychologist(psych);
      setRequestType('chat');
      setRequestMessage('');
      setShowRequestModal(true);
      return;
    }
    setSelectedPsychologist(psych);
    setRequestType('chat');
    setRequestMessage('');
    setShowRequestModal(true);
  }

  function handleRequestSession(psych: Psychologist) {
    if (!user) {
      setSelectedPsychologist(psych);
      setRequestType('session');
      setRequestMessage('');
      setShowRequestModal(true);
      return;
    }
    setSelectedPsychologist(psych);
    setRequestType('session');
    setRequestMessage('');
    setShowRequestModal(true);
  }

  async function submitRequest() {
    if (!selectedPsychologist || !requestMessage.trim()) return;
    
    if (!user) {
      // Перенаправляем на регистрацию с сохранением данных запроса
      navigate('/register', { 
        state: { 
          redirect: '/psychologists', 
          action: requestType, 
          psychologistId: selectedPsychologist.id,
          requestMessage: requestMessage
        } 
      });
      return;
    }
    
    try {
      // API call to create chat request or session request
      await api('/api/support/request', {
        method: 'POST',
        token: token ?? undefined,
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
      <GuestNavbar />
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: 1400,
          margin: '0 auto',
          width: '100%'
        }}
      >
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
                        src={psych.avatarUrl.startsWith('http') 
                          ? psych.avatarUrl 
                          : (psych.avatarUrl.startsWith('/') 
                              ? `${window.location.origin}${psych.avatarUrl}`
                              : `${window.location.origin}/${psych.avatarUrl}`)} 
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
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{psych.name}</h3>
                      {psych.verified && (
                        <span title="Верифицирован" style={{ fontSize: 18 }}>✓</span>
                      )}
                    </div>
                    {psych.rating && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontWeight: 600 }}>⭐ {typeof psych.rating === 'number' ? psych.rating.toFixed(1) : psych.rating}</span>
                        {psych.reviewsCount && (
                          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                            ({psych.reviewsCount} отзывов)
                          </span>
                        )}
                      </div>
                    )}
                    {psych.experience && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 4 }}>
                        Опыт: {psych.experience} лет
                      </div>
                    )}
                  </div>
                </div>

                {psych.bio && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ 
                      color: 'var(--text-muted)', 
                      lineHeight: 1.6, 
                      fontSize: 14,
                      margin: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: expandedBios.has(psych.id) ? 'unset' : 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {psych.bio}
                    </p>
                    {psych.bio.length > 200 && (
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedBios);
                          if (newExpanded.has(psych.id)) {
                            newExpanded.delete(psych.id);
                          } else {
                            newExpanded.add(psych.id);
                          }
                          setExpandedBios(newExpanded);
                        }}
                        style={{
                          marginTop: 8,
                          padding: '4px 8px',
                          fontSize: 12,
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        {expandedBios.has(psych.id) ? 'Свернуть' : 'Читать далее...'}
                      </button>
                    )}
                  </div>
                )}

                {psych.specialization && psych.specialization.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {psych.specialization.map((spec, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            background: 'var(--surface-2)',
                            fontSize: 12,
                            color: 'var(--text)'
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
                    className="button"
                    onClick={() => handleRequestChat(psych)}
                    style={{ flex: 1, padding: '10px', fontSize: 14 }}
                  >
                    💬 Написать
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => handleRequestSession(psych)}
                    style={{ flex: 1, padding: '10px', fontSize: 14 }}
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
            onClick={() => {
              setShowRequestModal(false);
              setSelectedPsychologist(null);
              setRequestMessage('');
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'grid',
              placeItems: 'center',
              padding: 12,
              zIndex: 50
            }}
          >
            <div
              className="card"
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: 600, padding: 24, width: '100%' }}
            >
              <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>
                {requestType === 'chat' ? 'Запрос на общение' : 'Запись на консультацию'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
                Психолог: {selectedPsychologist.name}
              </div>
              {!user && (
                <div className="card" style={{ padding: 16, marginBottom: 16, background: 'var(--primary)22', border: '1px solid var(--primary)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>💡 Для отправки запроса необходима регистрация</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    После заполнения формы вы будете перенаправлены на страницу регистрации
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  {requestType === 'chat' ? 'Опишите цель вашего обращения:' : 'Опишите вашу проблему или вопрос:'}
                </label>
                <textarea
                  value={requestMessage}
                  onChange={e => setRequestMessage(e.target.value)}
                  placeholder={requestType === 'chat' ? 'Например: Хочу обсудить проблемы в отношениях...' : 'Расскажите о том, с чем вы хотели бы поработать...'}
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  className="button secondary"
                  onClick={() => {
                    setShowRequestModal(false);
                    setSelectedPsychologist(null);
                    setRequestMessage('');
                  }}
                  style={{ padding: '10px 20px' }}
                >
                  Отмена
                </button>
                <button
                  className="button"
                  onClick={submitRequest}
                  disabled={!requestMessage.trim()}
                  style={{ padding: '10px 20px' }}
                >
                  {!user ? 'Продолжить регистрацию' : 'Отправить запрос'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

