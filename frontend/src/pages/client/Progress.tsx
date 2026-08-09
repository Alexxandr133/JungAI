import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ClientNavbar } from '../../components/ClientNavbar';
import { MoodMiniChart } from '../../components/client/MoodCheckIn';
import './Progress.css';

type ProgressPayload = {
  sessionCount: number;
  eventCount: number;
  journalCount: number;
  dreamCount: number;
  moodAvg30d: number | null;
  moodTrend: Array<{ date: string; mood: number; energy: number; anxiety: number }>;
  recentEvents: Array<{ id: string; title: string; startsAt: string; sessionStatus?: string }>;
  flaggedDreams: Array<{ id: string; title: string; createdAt: string }>;
  openHomework: Array<{ id: string; date: string; homework: string }>;
  reflections: Array<{ id: string; moodAfter: number; text?: string | null; createdAt: string }>;
};

export default function ClientProgress() {
  const { token } = useAuth();
  const [data, setData] = useState<ProgressPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const res = await api<ProgressPayload>('/api/client/progress', { token });
        setData(res);
      } catch (e: any) {
        setError(e?.message || 'Не удалось загрузить прогресс');
      }
    })();
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ClientNavbar />
      <main className="client-progress">
        <header className="card client-progress__hero">
          <h1>Прогресс терапии</h1>
          <p>
            Наблюдения для вас и специалиста: сессии, настроение, сны к обсуждению и задания.
            Это не клинический диагноз.
          </p>
        </header>

        {error && <div className="card client-progress__error">{error}</div>}

        {data && (
          <>
            <section className="client-progress__stats">
              <div className="card client-progress__stat">
                <div className="client-progress__stat-n">{data.eventCount}</div>
                <div className="client-progress__stat-l">События / сессии</div>
              </div>
              <div className="card client-progress__stat">
                <div className="client-progress__stat-n">{data.dreamCount}</div>
                <div className="client-progress__stat-l">Сны</div>
              </div>
              <div className="card client-progress__stat">
                <div className="client-progress__stat-n">{data.journalCount}</div>
                <div className="client-progress__stat-l">Записи дневника</div>
              </div>
              <div className="card client-progress__stat">
                <div className="client-progress__stat-n">{data.moodAvg30d ?? '—'}</div>
                <div className="client-progress__stat-l">Среднее настроение (30д)</div>
              </div>
            </section>

            <section className="client-progress__two">
              <div className="card client-progress__panel">
                <h2>Настроение</h2>
                <MoodMiniChart
                  points={data.moodTrend.map((m) => ({
                    date: String(m.date).slice(0, 10),
                    mood: m.mood,
                    energy: m.energy,
                    anxiety: m.anxiety,
                  }))}
                  height={200}
                />
                <Link to="/client/care" className="client-progress__link">
                  Открыть трекер →
                </Link>
              </div>
              <div className="card client-progress__panel">
                <h2>Сны к обсуждению</h2>
                {data.flaggedDreams.length === 0 ? (
                  <p className="client-progress__muted">Отметьте сон флагом «Обсудить на сессии» в карточке сна.</p>
                ) : (
                  <ul className="client-progress__list">
                    {data.flaggedDreams.map((d) => (
                      <li key={d.id}>
                        <Link to={`/dreams/${d.id}`}>{d.title || 'Без названия'}</Link>
                        <span>{new Date(d.createdAt).toLocaleDateString('ru-RU')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="card client-progress__panel">
              <h2>Ближайшие и прошлые встречи</h2>
              {data.recentEvents.length === 0 ? (
                <p className="client-progress__muted">
                  Пока нет сессий.{' '}
                  <Link to="/client/sessions">Записаться</Link>
                </p>
              ) : (
                <ul className="client-progress__timeline">
                  {data.recentEvents.map((e) => (
                    <li key={e.id}>
                      <div className="client-progress__tl-title">{e.title}</div>
                      <div className="client-progress__tl-meta">
                        {new Date(e.startsAt).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {e.sessionStatus ? ` · ${e.sessionStatus}` : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {data.openHomework.length > 0 && (
              <section className="card client-progress__panel">
                <h2>Открытые задания</h2>
                <ul className="client-progress__list">
                  {data.openHomework.map((h) => (
                    <li key={h.id}>
                      <span style={{ whiteSpace: 'pre-wrap' }}>{h.homework}</span>
                      <span>{new Date(h.date).toLocaleDateString('ru-RU')}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
