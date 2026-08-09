import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, resolvePublicFileUrl } from '../../lib/api';
import { ClientNavbar } from '../../components/ClientNavbar';
import './Match.css';

const TOPICS = [
  'тревога',
  'отношения',
  'самооценка',
  'выгорание',
  'сны',
  'потеря',
  'границы',
  'семья',
  'карьера',
  'одиночество',
];

type MatchCard = {
  id: string;
  name: string;
  bio: string | null;
  specialization: string[];
  experience: number;
  avatarUrl: string | null;
  score: number;
  reasons: string[];
};

export default function ClientMatch() {
  const { token } = useAuth();
  const [step, setStep] = useState(0);
  const [topics, setTopics] = useState<string[]>([]);
  const [format, setFormat] = useState<'individual' | 'couple'>('individual');
  const [timePreference, setTimePreference] = useState('flexible');
  const [methodNotes, setMethodNotes] = useState('');
  const [matches, setMatches] = useState<MatchCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTopic(t: string) {
    setTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(0, 6)));
  }

  async function runMatch() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await api('/api/client/match-profile', {
        token,
        method: 'PUT',
        body: { topics, format, timePreference, methodNotes },
      });
      const res = await api<{ matches: MatchCard[] }>('/api/client/match', {
        token,
        method: 'POST',
        body: { topics, format, timePreference, methodNotes },
      });
      setMatches(res.matches || []);
      setStep(3);
    } catch (e: any) {
      setError(e?.message || 'Не удалось подобрать специалистов');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ClientNavbar />
      <main className="client-match">
        <header className="card client-match__hero">
          <h1>Подобрать психолога</h1>
          <p>Короткая анкета — и несколько специалистов, близких к вашему запросу.</p>
          <div className="client-match__steps">
            {['Тема', 'Формат', 'Время', 'Результат'].map((label, i) => (
              <span key={label} className={`client-match__step${step === i ? ' is-active' : ''}${step > i ? ' is-done' : ''}`}>
                {label}
              </span>
            ))}
          </div>
        </header>

        {error && <div className="card client-match__error">{error}</div>}

        {step === 0 && (
          <section className="card client-match__panel">
            <h2>Что хотите обсудить?</h2>
            <div className="client-match__chips">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`client-match__chip${topics.includes(t) ? ' is-on' : ''}`}
                  onClick={() => toggleTopic(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <button type="button" className="button" disabled={!topics.length} onClick={() => setStep(1)}>
              Далее
            </button>
          </section>
        )}

        {step === 1 && (
          <section className="card client-match__panel">
            <h2>Формат</h2>
            <div className="client-match__formats">
              <button
                type="button"
                className={`client-match__format${format === 'individual' ? ' is-on' : ''}`}
                onClick={() => setFormat('individual')}
              >
                <strong>Для себя</strong>
                <span>~индивидуальная сессия</span>
              </button>
              <button
                type="button"
                className={`client-match__format${format === 'couple' ? ' is-on' : ''}`}
                onClick={() => setFormat('couple')}
              >
                <strong>Для двоих</strong>
                <span>парная / семейная работа</span>
              </button>
            </div>
            <label className="client-match__notes">
              Предпочтения по методу (необязательно)
              <textarea
                value={methodNotes}
                onChange={(e) => setMethodNotes(e.target.value)}
                rows={3}
                placeholder="Например: юнгианский анализ, работа со снами…"
              />
            </label>
            <div className="client-match__nav">
              <button type="button" className="client-match__ghost" onClick={() => setStep(0)}>
                Назад
              </button>
              <button type="button" className="button" onClick={() => setStep(2)}>
                Далее
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="card client-match__panel">
            <h2>Когда удобнее?</h2>
            <div className="client-match__chips">
              {(
                [
                  ['morning', 'Утро'],
                  ['day', 'День'],
                  ['evening', 'Вечер'],
                  ['flexible', 'Гибко'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`client-match__chip${timePreference === id ? ' is-on' : ''}`}
                  onClick={() => setTimePreference(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="client-match__nav">
              <button type="button" className="client-match__ghost" onClick={() => setStep(1)}>
                Назад
              </button>
              <button type="button" className="button" disabled={loading} onClick={() => void runMatch()}>
                {loading ? 'Подбираем…' : 'Показать специалистов'}
              </button>
            </div>
          </section>
        )}

        {step === 3 && matches && (
          <section className="client-match__results">
            {matches.length === 0 ? (
              <div className="card client-match__panel">
                <p>Пока нет подходящих карточек. Посмотрите весь каталог.</p>
                <Link to="/client/psychologists" className="button">
                  Каталог психологов
                </Link>
              </div>
            ) : (
              matches.map((m) => (
                <article key={m.id} className="card client-match__card">
                  <div className="client-match__card-top">
                    <div className="client-match__avatar">
                      {m.avatarUrl ? (
                        <img src={resolvePublicFileUrl(m.avatarUrl) || m.avatarUrl} alt="" />
                      ) : (
                        <span>{m.name.slice(0, 1)}</span>
                      )}
                    </div>
                    <div>
                      <h3>{m.name}</h3>
                      <div className="small" style={{ color: 'var(--text-muted)' }}>
                        {m.specialization?.slice(0, 2).join(' · ') || 'Психолог'}
                        {m.experience ? ` · ${m.experience} лет` : ''}
                      </div>
                    </div>
                  </div>
                  {m.bio && <p className="client-match__bio">{m.bio.slice(0, 180)}{m.bio.length > 180 ? '…' : ''}</p>}
                  <ul className="client-match__reasons">
                    {m.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <Link to={`/psychologists/${m.id}`} className="button">
                    Открыть профиль
                  </Link>
                </article>
              ))
            )}
            <button type="button" className="client-match__ghost" onClick={() => { setStep(0); setMatches(null); }}>
              Пройти анкету заново
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
