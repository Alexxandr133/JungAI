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
  const [tab, setTab] = useState<'tracker' | 'homework'>('tracker');
  const [moodDaily, setMoodDaily] = useState<MoodDaily[]>([]);
  const [todayMood, setTodayMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState(3);
  const [anxiety, setAnxiety] = useState(3);
  const [lockedToday, setLockedToday] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [sessionMarkers, setSessionMarkers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const [moodRes, hwRes, eventsRes] = await Promise.all([
        api<{
          daily: MoodDaily[];
          today: { mood: number; energy: number; anxiety: number } | null;
          lockedToday: boolean;
        }>('/api/client/mood?days=14', { token }),
        api<{ items: Homework[] }>('/api/client/homework', { token }),
        api<{ items: Array<{ startsAt: string; sessionStatus?: string }> }>('/api/my-events', { token }).catch(() => ({
          items: [] as Array<{ startsAt: string; sessionStatus?: string }>,
        })),
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
      const markers = (eventsRes.items || [])
        .filter((e) => e.sessionStatus === 'accepted' || !e.sessionStatus)
        .map((e) => e.startsAt.slice(0, 10));
      setSessionMarkers([...new Set(markers)]);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Не удалось загрузить данные';
      setError(msg);
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
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2200);
      await load();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Не удалось сохранить';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="client-care">
      <ClientNavbar />
      <main className="client-care__main">
        <header className="client-care__head">
          <div>
            <p className="client-care__eyebrow">Между сессиями</p>
            <h1 className="client-care__h1">Забота о себе</h1>
            <p className="client-care__lead">Трекер настроения и задания психолога — без гонки за баллами.</p>
          </div>
          <Link to="/client/progress" className="client-care__link">
            Прогресс терапии →
          </Link>
        </header>

        {error && (
          <div className="client-care__error" role="alert">
            {error}
          </div>
        )}

        <div className="client-care__tabs" role="tablist">
          <button type="button" role="tab" className={`client-care__tab${tab === 'tracker' ? ' is-on' : ''}`} onClick={() => setTab('tracker')}>
            Трекер
          </button>
          <button type="button" role="tab" className={`client-care__tab${tab === 'homework' ? ' is-on' : ''}`} onClick={() => setTab('homework')}>
            Задания психолога
          </button>
        </div>

        {tab === 'tracker' && (
          <section className="client-care__grid">
            <div className="client-care__panel">
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
              {savedFlash && <p className="client-care__toast">Отметка сохранена — точка появилась на графике</p>}
            </div>
            <div className="client-care__panel">
              <h2 className="client-care__panel-title">Динамика за 14 дней</h2>
              <p className="client-care__panel-sub">Маркеры «S» — дни сессий</p>
              <div className="client-care__chart">
                <MoodMiniChart points={moodDaily} height={240} sessionMarkers={sessionMarkers} />
              </div>
              <p className="client-care__note">Это ваши наблюдения, а не диагноз. Динамику можно обсудить с психологом.</p>
            </div>
          </section>
        )}

        {tab === 'homework' && (
          <section className="client-care__hw">
            {homework.length === 0 ? (
              <div className="client-care__empty">
                <h2>Пока нет заданий</h2>
                <p>Домашние задания появятся после сессий. До этого можно отмечать настроение и вести дневник.</p>
                <Link to="/client/sessions" className="button" style={{ textDecoration: 'none', display: 'inline-block' }}>
                  К сессиям
                </Link>
              </div>
            ) : (
              homework.map((h) => (
                <article key={h.id} className="client-care__hw-item">
                  <time dateTime={h.date}>Сессия {new Date(h.date).toLocaleDateString('ru-RU')}</time>
                  <p>{h.homework}</p>
                  {h.nextFocus && <div className="client-care__hw-focus">Фокус дальше: {h.nextFocus}</div>}
                </article>
              ))
            )}
          </section>
        )}
      </main>
    </div>
  );
}
