import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

type Review = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  clientName: string;
};

type PsychologistProfile = {
  id: string;
  name: string;
  bio: string | null;
  specialization: string[];
  experience: number;
  avatarUrl: string | null;
  verified: boolean;
};

export default function PublicPsychologistProfile() {
  const { id = '' } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PsychologistProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ averageRating: number; reviewsCount: number }>({ averageRating: 0, reviewsCount: 0 });
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactType, setContactType] = useState<'chat' | 'session'>('chat');
  const [requestMessage, setRequestMessage] = useState('');
  const [canRate, setCanRate] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');

  useEffect(() => {
    loadProfile();
  }, [id]);

  useEffect(() => {
    if (token && user?.role === 'client' && id) {
      api<{ canRate: boolean; myRating: { rating: number; comment: string } | null }>(`/api/psychologists/${id}/rating/my`, { token })
        .then((res) => {
          setCanRate(Boolean(res.canRate));
          if (res.myRating) {
            setMyRating(res.myRating.rating);
            setMyComment(res.myRating.comment || '');
          }
        })
        .catch(() => setCanRate(false));
    }
  }, [token, user?.role, id]);

  async function loadProfile() {
    try {
      setLoading(true);
      const res = await api<{ psychologist: PsychologistProfile; reviews: Review[]; stats: { averageRating: number; reviewsCount: number } }>(`/api/psychologists/public/${id}`, { token: token ?? undefined });
      setProfile(res.psychologist);
      setReviews(res.reviews || []);
      setStats(res.stats || { averageRating: 0, reviewsCount: 0 });
    } finally {
      setLoading(false);
    }
  }

  function openContact(type: 'chat' | 'session') {
    setContactType(type);
    setRequestMessage('');
    setShowContactModal(true);
  }

  async function submitContact() {
    if (!profile || !requestMessage.trim()) return;
    if (!token || !user) {
      localStorage.setItem('pendingPsychologistContact', JSON.stringify({
        psychologistId: profile.id,
        type: contactType,
        message: requestMessage.trim()
      }));
      navigate('/register');
      return;
    }

    const created = await api<{ chatRoomId?: string }>('/api/support/request', {
      method: 'POST',
      token,
      body: { psychologistId: profile.id, type: contactType, message: requestMessage.trim() }
    });
    setShowContactModal(false);
    if (contactType === 'chat' && created?.chatRoomId) {
      navigate(`/chat?roomId=${encodeURIComponent(created.chatRoomId)}`);
      return;
    }
    alert('Запрос отправлен психологу.');
  }

  async function saveRating() {
    if (!token || !id || !canRate || myRating < 1 || myRating > 5) return;
    await api(`/api/psychologists/${id}/rating`, {
      method: 'POST',
      token,
      body: { rating: myRating, comment: myComment }
    });
    await loadProfile();
    alert('Оценка сохранена');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UniversalNavbar />
      <main style={{ flex: 1, padding: '24px clamp(16px, 5vw, 48px)', maxWidth: 980, width: '100%', margin: '0 auto' }}>
        {loading || !profile ? (
          <div className="card" style={{ padding: 24 }}>Загрузка...</div>
        ) : (
          <>
            <div className="card" style={{ padding: 24, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ width: 88, height: 88, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-2)', flexShrink: 0 }}>
                  {profile.avatarUrl ? <img src={profile.avatarUrl.startsWith('http') ? profile.avatarUrl : `${window.location.origin}${profile.avatarUrl}`} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h1 style={{ margin: 0, fontSize: 28, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</h1>
                    {profile.verified ? <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>верефицирован</span> : null}
                  </div>
                  <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                    Опыт: {profile.experience || 0} лет
                  </div>
                  <div className="small" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                    Отзывы: {stats.reviewsCount} | Средняя оценка: {stats.averageRating || 0}
                  </div>
                </div>
              </div>
              {profile.bio ? <p style={{ marginTop: 14, lineHeight: 1.6 }}>{profile.bio}</p> : null}
              {profile.specialization?.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {profile.specialization.map((s) => <span key={s} style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 12 }}>{s}</span>)}
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="button" onClick={() => openContact('chat')}>Написать</button>
                <button className="button secondary" onClick={() => openContact('session')}>Записаться</button>
              </div>
            </div>

            {canRate ? (
              <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Ваша оценка психолога</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" className={myRating === n ? 'button' : 'button secondary'} onClick={() => setMyRating(n)} style={{ padding: '6px 10px' }}>
                      {n}
                    </button>
                  ))}
                </div>
                <textarea value={myComment} onChange={(e) => setMyComment(e.target.value)} placeholder="Комментарий (необязательно)" rows={3} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', marginBottom: 10 }} />
                <button className="button" onClick={saveRating} disabled={myRating < 1}>Сохранить оценку</button>
              </div>
            ) : null}

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Отзывы</div>
              {reviews.length === 0 ? <div className="small" style={{ color: 'var(--text-muted)' }}>Пока нет отзывов</div> : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {reviews.map((r) => (
                    <div key={r.id} style={{ padding: 12, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <b>{r.clientName}</b>
                        <span>{r.rating}/5</span>
                      </div>
                      {r.comment ? <div style={{ lineHeight: 1.5 }}>{r.comment}</div> : <div className="small" style={{ color: 'var(--text-muted)' }}>Без комментария</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {showContactModal ? (
        <div onClick={() => setShowContactModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 12 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 96vw)', padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>{contactType === 'chat' ? 'Запрос на чат' : 'Запрос на консультацию'}</h3>
            <textarea value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} rows={5} placeholder="Опишите цель запроса..." style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', marginBottom: 12 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="button secondary" onClick={() => setShowContactModal(false)}>Отмена</button>
              <button className="button" onClick={submitContact} disabled={!requestMessage.trim()}>{!token ? 'Продолжить регистрацию' : 'Отправить'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
