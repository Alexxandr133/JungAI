import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ClientNavbar } from '../../components/ClientNavbar';
import { MoodCheckInControl, MoodMiniChart } from '../../components/client/MoodCheckIn';
import './Care.css';

type MoodDaily = { date: string; mood: number | null; energy: number | null; anxiety: number | null };
type Homework = { id: string; date: string; homework: string; nextFocus?: string | null };

export default function ClientCare() {
  const { token } = useAuth();
  const [tab, setTab] = useState<'tracker' | 'practices' | 'homework'>('tracker');
  const [moodDaily, setMoodDaily] = useState<MoodDaily[]>([]);
  const [todayMood, setTodayMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState(3);
  const [anxiety, setAnxiety] = useState(3);
  const [lockedToday, setLockedToday] = useState(false);
  const [saving, setSaving] = useState(false);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const [moodRes, hwRes] = await Promise.all([
        api<{
          daily: MoodDaily[];
          today: { mood: number; energy: number; anxiety: number } | null;
          lockedToday: boolean;
        }>('/api/client/mood?days=14', { token }),
        api<{ items: Homework[] }>('/api/client/homework', { token }),
      ]);
      setMoodDaily(moodRes.daily || []);
      setLockedToday(Boolean(moodRes.lockedToday));
      if (moodRes.today) {
        setTodayMood(moodRes.today.mood);
        setEnergy(moodRes.today.energy);
        setAnxiety(moodRes.today.anxiety);
      } else {
        setTodayMood(null);
      }
      setHomework(hwRes.items || []);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить данные');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMood(next: { mood: number; energy: number; anxiety: number }) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await api('/api/client/mood', { token, method: 'POST', body: next });
      setTodayMood(next.mood);
      setEnergy(next.energy);
      setAnxiety(next.anxiety);
      setLockedToday(true);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="client-care-shell">
      <ClientNavbar />
      <main className="client-care-stage">
        <div className="client-care-stage__glow" aria-hidden />
        <div className="client-care-inner">
          <header className="client-care-hero">
            <div>
              <p className="client-care-hero__eyebrow">Между сессиями</p>
              <h1>Забота о себе</h1>
              <p className="client-care-hero__lead">
                Трекер настроения, практики и задания — чтобы не терять нить между встречами с психологом.
              </p>
            </div>
            <Link to="/client/progress" className="client-care-hero__link">
              Прогресс терапии →
            </Link>
          </header>

          {error && (
            <div className="client-care-error" role="alert">
              {error}
            </div>
          )}

          <div className="client-care-tabs" role="tablist">
            {(
              [
                ['tracker', 'Трекер'],
                ['practices', 'Практики'],
                ['homework', 'Задания'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`client-care-tab${tab === id ? ' is-active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="client-care-body">
            {tab === 'tracker' && (
              <section className="client-care-grid">
                <div className="client-care-panel">
                  <MoodCheckInControl
                    mood={todayMood}
                    energy={energy}
                    anxiety={anxiety}
                    locked={lockedToday}
                    saving={saving}
                    disabled={!token}
                    onUnlock={() => setLockedToday(false)}
                    onSave={(v) => void saveMood(v)}
                  />
                </div>
                <div className="client-care-panel">
                  <div className="client-care-panel__title">Динамика за 14 дней</div>
                  <MoodMiniChart points={moodDaily} height={200} />
                  <p className="client-care-note">
                    Это ваши наблюдения, а не диагноз. Динамику можно обсудить с психологом.
                  </p>
                </div>
              </section>
            )}

            {tab === 'practices' && (
              <section className="client-care-wip">
                <div className="client-care-wip__badge">В разработке</div>
                <h2>Практики скоро появятся здесь</h2>
                <p>
                  Готовим короткие упражнения на 3–7 минут: дыхание, заземление и мягкие медитации.
                  Пока можно вести трекер настроения и дневник.
                </p>
                <div className="client-care-wip__actions">
                  <button type="button" className="button" onClick={() => setTab('tracker')}>
                    К трекеру
                  </button>
                  <Link to="/client/journal" className="client-care-wip__ghost">
                    Открыть дневник
                  </Link>
                </div>
              </section>
            )}

            {tab === 'homework' && (
              <section className="client-care-hw">
                {homework.length === 0 ? (
                  <div className="client-care-wip client-care-wip--soft">
                    <h2>Пока нет заданий</h2>
                    <p>
                      Домашние задания от психолога появятся здесь после сессий. До этого можно отмечать
                      настроение и записывать сны.
                    </p>
                    <Link to="/client/sessions" className="button">
                      К сессиям
                    </Link>
                  </div>
                ) : (
                  homework.map((h) => (
                    <article key={h.id} className="client-care-hw-item">
                      <div className="client-care-hw-item__date">
                        Сессия {new Date(h.date).toLocaleDateString('ru-RU')}
                      </div>
                      <p>{h.homework}</p>
                      {h.nextFocus && (
                        <div className="client-care-hw-item__focus">Фокус дальше: {h.nextFocus}</div>
                      )}
                    </article>
                  ))
                )}
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
