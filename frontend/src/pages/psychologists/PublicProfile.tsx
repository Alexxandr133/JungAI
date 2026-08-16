import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LandingNavbar } from '../../components/landing/LandingNavbar';
import { LandingFooter } from '../../components/landing/LandingFooter';
import { PsychologistPublicCard } from '../../components/PsychologistPublicCard';
import { PsychologistPublicBody } from '../../components/PsychologistPublicBody';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { usePageMeta } from '../../hooks/usePageMeta';
import '../../styles/landing-tokens.css';
import './PublicProfile.css';

type Review = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  clientName: string;
};

type Education = {
  id: string;
  kind: string;
  institution: string;
  title: string;
  yearFrom: number;
  yearTo: number | null;
};

type FreeSlot = { dayKey: string; startHm: string; slotStart: string; slotEnd: string };

type PsychologistProfile = {
  id: string;
  name: string;
  bio: string | null;
  specialization: string[];
  therapyMethod: string | null;
  worksWith: string[];
  audienceFormats: string[];
  experience: number;
  avatarUrl: string | null;
  coverUrl?: string | null;
  accentColor?: string | null;
  sessionPriceRub: number | null;
  verified: boolean;
  educations: Education[];
  nearestSlot: FreeSlot | null;
  freeSlots: FreeSlot[];
};

function loadMatchQuery(): Record<string, unknown> {
  try {
    const raw = sessionStorage.getItem('jungai_match_query');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadMatchReturnPath(): string {
  try {
    const path = sessionStorage.getItem('jungai_match_return');
    if (path === '/match' || path === '/client/match') return path;
  } catch {
    /* ignore */
  }
  return '/match';
}

function loadQuizNotePrefill(): string {
  try {
    const raw = localStorage.getItem('client_quiz_result');
    if (!raw) return '';
    const data = JSON.parse(raw) as {
      notePrefill?: string;
      topics?: string[];
      whoLabel?: string;
      customTopic?: string | null;
    };
    if (data.notePrefill) return String(data.notePrefill);
    const parts = [
      Array.isArray(data.topics) && data.topics.length ? data.topics.join(', ') : null,
      data.whoLabel || null,
      data.customTopic || null,
    ].filter(Boolean);
    return parts.length ? `Запрос из анкеты: ${parts.join(' · ')}` : '';
  } catch {
    return '';
  }
}

export default function PublicPsychologistProfile() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const fromMatch = searchParams.get('from') === 'match';
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PsychologistProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<FreeSlot | null>(null);
  const [contactName, setContactName] = useState(user?.name || '');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [contactPhone, setContactPhone] = useState('');
  const [note, setNote] = useState(() => loadQuizNotePrefill());
  const [booking, setBooking] = useState(false);
  const [bookMsg, setBookMsg] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [canRate, setCanRate] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');

  usePageMeta(
    profile ? `${profile.name} — психолог JungAI` : 'Психолог — JungAI',
    profile?.bio?.slice(0, 160) || 'Верифицированный психолог на платформе JungAI'
  );

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when route/id changes
  }, [id, token]);

  useEffect(() => {
    if (user?.email) setContactEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (!note.trim()) {
      const prefill = loadQuizNotePrefill();
      if (prefill) setNote(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (token && user?.role === 'client' && id) {
      api<{ canRate: boolean; myRating: { rating: number; comment: string } | null }>(
        `/api/psychologists/${id}/rating/my`,
        { token }
      )
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
      const res = await api<{
        psychologist: PsychologistProfile;
        reviews: Review[];
        stats: { averageRating: number; reviewsCount: number };
      }>(`/api/psychologists/public/${id}`, { token: token ?? undefined });
      setProfile(res.psychologist);
      setReviews(res.reviews || []);
      setSelectedSlot(res.psychologist.nearestSlot || res.psychologist.freeSlots?.[0] || null);
    } finally {
      setLoading(false);
    }
  }

  const slotsByDay = useMemo(() => {
    const map = new Map<string, FreeSlot[]>();
    for (const s of profile?.freeSlots || []) {
      if (!map.has(s.dayKey)) map.set(s.dayKey, []);
      map.get(s.dayKey)!.push(s);
    }
    return [...map.entries()];
  }, [profile?.freeSlots]);

  const accent =
    profile?.accentColor && /^#[0-9a-fA-F]{6}$/.test(profile.accentColor)
      ? profile.accentColor
      : '#3d6b5a';

  const isOwnProfile =
    Boolean(user?.id && profile?.id && user.id === profile.id && (user.role === 'psychologist' || user.role === 'admin'));

  async function submitBooking() {
    if (!profile || !selectedSlot) return;
    if (contactName.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setBookError('Укажите имя и корректный email');
      return;
    }
    setBooking(true);
    setBookError(null);
    setBookMsg(null);
    try {
      const mq = loadMatchQuery();
      const res = await api<{ message?: string }>(`/api/psychologists/public/${profile.id}/book`, {
        method: 'POST',
        token: token || undefined,
        body: {
          slotStart: selectedSlot.slotStart,
          slotEnd: selectedSlot.slotEnd,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim() || null,
          note: note.trim() || null,
          whoFor: mq.whoFor || 'self',
          topics: mq.topics || [],
          customTopic: mq.customTopic || null,
          priceBand: mq.priceBand || null,
          timePreference: mq.timePreference || 'slot',
        },
      });
      setBookMsg(res.message || 'Заявка отправлена. Подтверждение и детали встречи придут на почту.');
    } catch (e: unknown) {
      setBookError(e instanceof Error ? e.message : 'Не удалось отправить заявку');
    } finally {
      setBooking(false);
    }
  }

  async function saveRating() {
    if (!token || !id || !canRate || myRating < 1 || myRating > 5) return;
    await api(`/api/psychologists/${id}/rating`, {
      method: 'POST',
      token,
      body: { rating: myRating, comment: myComment },
    });
    await loadProfile();
  }

  function scrollToSchedule() {
    document.getElementById('schedule')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const priceLabel =
    profile?.sessionPriceRub != null
      ? `Сессия — ${profile.sessionPriceRub.toLocaleString('ru-RU')} ₽`
      : null;

  return (
    <div className="landing psy-public-page" style={{ ['--psy-accent' as string]: accent }}>
      <LandingNavbar />
      <main className="psy-public-page__main">
        <div className="landing-container psy-public-page__inner">
          {fromMatch && (
            <button
              type="button"
              className="landing-btn landing-btn--ghost psy-public-page__back"
              onClick={() => navigate(loadMatchReturnPath())}
            >
              ← К рекомендациям
            </button>
          )}

          {isOwnProfile && (
            <div className="psy-public-page__own-banner" role="status">
              Вы смотрите свой профиль глазами клиента
              <Link to="/psychologist/profile" className="psy-public-page__own-link">
                Редактировать →
              </Link>
            </div>
          )}

          {loading || !profile ? (
            <p className="landing-body" style={{ textAlign: 'center', padding: '48px 0' }}>
              Загрузка…
            </p>
          ) : (
            <>
              <PsychologistPublicCard
                data={{
                  name: profile.name,
                  specialization: profile.specialization,
                  therapyMethod: profile.therapyMethod,
                  experience: profile.experience,
                  avatarUrl: profile.avatarUrl,
                  coverUrl: profile.coverUrl,
                  accentColor: profile.accentColor,
                  sessionPriceRub: profile.sessionPriceRub,
                  verified: profile.verified,
                  nearestSlotLabel: profile.nearestSlot
                    ? new Date(profile.nearestSlot.slotStart).toLocaleString('ru-RU', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : null,
                }}
                onBookClick={scrollToSchedule}
              />

              <PsychologistPublicBody
                data={{
                  bio: profile.bio,
                  worksWith: profile.worksWith,
                  audienceFormats: profile.audienceFormats,
                  educations: profile.educations,
                }}
              />

              {/* Расписание и запись */}
              <section id="schedule" className="psy-public-section psy-public-schedule" aria-labelledby="schedule-heading">
                <h2 id="schedule-heading" className="landing-h3">
                  Расписание и запись
                </h2>
                <div className="psy-public-schedule__grid">
                  <div className="psy-public-schedule__slots">
                    {slotsByDay.length === 0 ? (
                      <p className="landing-body">Свободных слотов на ближайшие дни нет. Загляните позже или выберите другого специалиста.</p>
                    ) : (
                      slotsByDay.map(([dayKey, slots]) => (
                        <div key={dayKey} className="psy-public-day">
                          <h3 className="psy-public-day__title">
                            {new Date(dayKey + 'T12:00:00').toLocaleDateString('ru-RU', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                            })}
                          </h3>
                          <div className="psy-public-day__slots">
                            {slots.map((s) => {
                              const on = selectedSlot?.slotStart === s.slotStart;
                              return (
                                <button
                                  key={s.slotStart}
                                  type="button"
                                  className={`psy-public-slot${on ? ' is-selected' : ''}`}
                                  onClick={() => setSelectedSlot(s)}
                                >
                                  {s.startHm}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="psy-public-schedule__form landing-card">
                    <h3 className="landing-h3" style={{ fontSize: 18, marginBottom: 8 }}>
                      Запись
                    </h3>
                    {selectedSlot ? (
                      <p className="landing-small" style={{ marginBottom: 14 }}>
                        {new Date(selectedSlot.slotStart).toLocaleString('ru-RU', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    ) : (
                      <p className="landing-small" style={{ marginBottom: 14 }}>
                        Выберите свободный слот слева
                      </p>
                    )}
                    <div className="psy-public-form">
                      <input
                        className="psy-public-input"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Ваше имя"
                        autoComplete="name"
                      />
                      <input
                        className="psy-public-input"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="Ваш email"
                        type="email"
                        autoComplete="email"
                      />
                      <input
                        className="psy-public-input"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="Телефон (необязательно)"
                        autoComplete="tel"
                      />
                      <textarea
                        className="psy-public-input"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Пара слов о запросе (необязательно)"
                        rows={3}
                      />
                    </div>
                    {bookError && <p className="psy-public-msg psy-public-msg--err">{bookError}</p>}
                    {bookMsg && <p className="psy-public-msg psy-public-msg--ok">{bookMsg}</p>}
                    <button
                      type="button"
                      className="psy-public-submit"
                      disabled={booking || !selectedSlot}
                      onClick={() => void submitBooking()}
                    >
                      {booking ? 'Отправляем…' : 'Записаться'}
                    </button>
                    <p className="landing-small psy-public-form-note">
                      Подтверждение и детали встречи придут на почту
                    </p>
                  </div>
                </div>
              </section>

              {canRate ? (
                <section className="psy-public-section landing-card" style={{ padding: 20 }}>
                  <h2 className="landing-h3">Ваша оценка</h2>
                  <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`psy-public-slot${myRating === n ? ' is-selected' : ''}`}
                        onClick={() => setMyRating(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="psy-public-input"
                    value={myComment}
                    onChange={(e) => setMyComment(e.target.value)}
                    placeholder="Комментарий (необязательно)"
                    rows={3}
                  />
                  <button
                    type="button"
                    className="psy-public-submit"
                    style={{ marginTop: 12 }}
                    disabled={myRating < 1}
                    onClick={() => void saveRating()}
                  >
                    Сохранить оценку
                  </button>
                </section>
              ) : null}

              {/* 6. Отзывы — только если ≥ 1 */}
              {reviews.length > 0 ? (
                <section className="psy-public-section" aria-labelledby="reviews-heading">
                  <h2 id="reviews-heading" className="landing-h3">
                    Отзывы
                  </h2>
                  <div className="psy-public-reviews">
                    {reviews.map((r) => (
                      <article key={r.id} className="landing-card psy-public-review">
                        <div className="psy-public-review__head">
                          <b>{r.clientName}</b>
                          <span>{r.rating}/5</span>
                        </div>
                        {r.comment ? <p>{r.comment}</p> : null}
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </main>

      {/* Mobile sticky: цена + Записаться */}
      {profile && (
        <div className="psy-public-sticky">
          <div className="psy-public-sticky__price">{priceLabel || 'Выбрать время'}</div>
          <button type="button" className="psy-public-sticky__cta" onClick={scrollToSchedule}>
            Записаться
          </button>
        </div>
      )}

      <LandingFooter />
    </div>
  );
}
