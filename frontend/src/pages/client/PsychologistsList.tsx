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
  specialization?: string | string[];
  experience?: number;
  avatarUrl?: string;
  verified?: boolean;
  rating?: number;
  reviewsCount?: number;
};

export default function ClientPsychologistsList() {
  const { token } = useAuth();
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [myPsychologist, setMyPsychologist] = useState<Psychologist | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedPsychologist, setSelectedPsychologist] = useState<Psychologist | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestType, setRequestType] = useState<'chat' | 'session'>('chat');
  const [hasAttachedPsychologist, setHasAttachedPsychologist] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Сначала проверяем, есть ли у клиента прикрепленный психолог
      let hasAttached = false;
      try {
        const myPsych = await api<Psychologist>('/api/clients/my-psychologist', { token: token ?? undefined });
        if (myPsych && myPsych.id) {
          // Преобразуем specialization в массив, если это строка
          const specialization = typeof myPsych.specialization === 'string' 
            ? (myPsych.specialization ? [myPsych.specialization] : [])
            : (myPsych.specialization || []);
          
          setMyPsychologist({
            ...myPsych,
            specialization,
            verified: true // Прикрепленный психолог считается верифицированным
          });
          hasAttached = true;
          setHasAttachedPsychologist(true);
        }
      } catch (e: any) {
        // Если не удалось получить прикрепленного психолога, загружаем всех
        console.error('Failed to load attached psychologist:', e);
        // Если это 403, возможно проблема с правами доступа, но все равно показываем всех психологов
        if (e.status === 403) {
          console.warn('Access denied to /my-psychologist endpoint. User may not be properly authenticated or may not have client role.');
        }
        hasAttached = false;
        setHasAttachedPsychologist(false);
      }

      // Если нет прикрепленного психолога, загружаем всех психологов
      if (!hasAttached) {
        try {
          const res = await api<{ psychologists: Psychologist[] }>('/api/psychologists/public', { token: token ?? undefined });
          setPsychologists(res.psychologists || []);
        } catch (e) {
          // Если API не вернул данные, оставляем пустой список
          console.error('Failed to load psychologists:', e);
          setPsychologists([]);
        }
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = hasAttachedPsychologist 
    ? (myPsychologist ? [myPsychologist] : [])
    : psychologists.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.bio?.toLowerCase().includes(query.toLowerCase()) ||
        (Array.isArray(p.specialization) && p.specialization.some(s => s.toLowerCase().includes(query.toLowerCase())))
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

  function handleViewProfile(psych: Psychologist) {
    setSelectedPsychologist(psych);
    setShowProfileModal(true);
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
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
            {hasAttachedPsychologist ? 'Мой психолог' : 'Психологи'}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
            {hasAttachedPsychologist 
              ? 'Ваш прикрепленный психолог'
              : 'Найдите подходящего психолога и запишитесь на консультацию'
            }
          </p>
          
          {/* Search - только для неприкрепленных клиентов */}
          {!hasAttachedPsychologist && (
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
          )}
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
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: hasAttachedPsychologist ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))', 
            gap: 24,
            maxWidth: hasAttachedPsychologist ? 600 : '100%',
            margin: hasAttachedPsychologist ? '0 auto' : 0
          }}>
            {filtered.map(psych => (
              <div key={psych.id} className="card card-hover-shimmer" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'start', gap: 16, marginBottom: 16 }}>
                  <div 
                    onClick={hasAttachedPsychologist ? () => handleViewProfile(psych) : undefined}
                    style={{
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
                      border: '2px solid rgba(255,255,255,0.1)',
                      cursor: hasAttachedPsychologist ? 'pointer' : 'default',
                      transition: hasAttachedPsychologist ? 'transform 0.2s, box-shadow 0.2s' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (hasAttachedPsychologist) {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(91, 124, 250, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (hasAttachedPsychologist) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                    title={hasAttachedPsychologist ? 'Посмотреть профиль' : undefined}
                  >
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
                
                {psych.specialization && Array.isArray(psych.specialization) && psych.specialization.length > 0 && (
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
                
                {!hasAttachedPsychologist && (
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
                )}
              </div>
            ))}
          </div>
        )}

        {/* Profile Modal */}
        {showProfileModal && selectedPsychologist && (
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
            onClick={() => setShowProfileModal(false)}
          >
            <div
              className="card"
              style={{
                maxWidth: 600,
                width: '100%',
                padding: 32,
                background: 'var(--surface)',
                border: '1px solid rgba(255,255,255,0.12)',
                maxHeight: '90vh',
                overflow: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'start', gap: 20, marginBottom: 24 }}>
                <div style={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: 'var(--surface-2)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 36,
                  fontWeight: 600,
                  color: 'var(--text)',
                  flexShrink: 0,
                  overflow: 'hidden',
                  border: '2px solid rgba(255,255,255,0.1)'
                }}>
                  {selectedPsychologist.avatarUrl ? (
                    <img 
                      src={selectedPsychologist.avatarUrl.startsWith('http') 
                        ? selectedPsychologist.avatarUrl 
                        : (selectedPsychologist.avatarUrl.startsWith('/') 
                            ? `${window.location.origin}${selectedPsychologist.avatarUrl}`
                            : `${window.location.origin}/${selectedPsychologist.avatarUrl}`)} 
                      alt={selectedPsychologist.name} 
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `<span>${selectedPsychologist.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>`;
                        }
                      }}
                    />
                  ) : (
                    <span>{selectedPsychologist.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                      {selectedPsychologist.name}
                    </h2>
                    {selectedPsychologist.verified && (
                      <span style={{ fontSize: 18 }} title="Верифицирован">✓</span>
                    )}
                  </div>
                  {selectedPsychologist.email && (
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>
                      {selectedPsychologist.email}
                    </div>
                  )}
                  {selectedPsychologist.rating && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ color: '#ffd700', fontSize: 16 }}>⭐</span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{selectedPsychologist.rating}</span>
                      {selectedPsychologist.reviewsCount && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          ({selectedPsychologist.reviewsCount} отзывов)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {selectedPsychologist.bio && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>О психологе</h3>
                  <p style={{ 
                    fontSize: 14, 
                    color: 'var(--text-muted)', 
                    lineHeight: 1.6,
                    margin: 0
                  }}>
                    {selectedPsychologist.bio}
                  </p>
                </div>
              )}

              {selectedPsychologist.specialization && Array.isArray(selectedPsychologist.specialization) && selectedPsychologist.specialization.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Специализация</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedPsychologist.specialization.map((spec, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: 'var(--surface-2)',
                          color: 'var(--text)',
                          fontSize: 13,
                          fontWeight: 500,
                          border: '1px solid rgba(255,255,255,0.08)'
                        }}
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedPsychologist.experience && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Опыт работы</h3>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
                    {selectedPsychologist.experience} {selectedPsychologist.experience === 1 ? 'год' : selectedPsychologist.experience < 5 ? 'года' : 'лет'}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="button secondary"
                  style={{ padding: '10px 20px' }}
                >
                  Закрыть
                </button>
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    handleRequestChat(selectedPsychologist);
                  }}
                  className="button"
                  style={{ padding: '10px 20px' }}
                >
                  💬 Написать
                </button>
              </div>
            </div>
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

