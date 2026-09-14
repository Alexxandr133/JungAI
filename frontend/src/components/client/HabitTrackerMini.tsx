import { useEffect, useMemo, useState } from 'react';
import './HabitTrackerMini.css';

export type HabitDef = {
  id: string;
  label: string;
};

const DEFAULT_HABITS: HabitDef[] = [
  { id: 'water', label: 'Стакан воды' },
  { id: 'walk', label: 'Короткая прогулка' },
  { id: 'breath', label: 'Дыхательная пауза' },
  { id: 'journal', label: 'Заметка в дневник' },
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(userId?: string): string {
  return `jungai_habits_${userId || 'guest'}`;
}

type Store = {
  /** habitId -> YYYY-MM-DD[] (last ~30) */
  done: Record<string, string[]>;
};

function loadStore(userId?: string): Store {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { done: {} };
    const parsed = JSON.parse(raw) as Store;
    return parsed?.done ? parsed : { done: {} };
  } catch {
    return { done: {} };
  }
}

function saveStore(store: Store, userId?: string) {
  localStorage.setItem(storageKey(userId), JSON.stringify(store));
}

type Props = {
  userId?: string;
  habits?: HabitDef[];
  compact?: boolean;
};

export function HabitTrackerMini({ userId, habits = DEFAULT_HABITS, compact }: Props) {
  const [store, setStore] = useState<Store>(() => loadStore(userId));
  const today = todayKey();

  useEffect(() => {
    setStore(loadStore(userId));
  }, [userId]);

  function toggle(habitId: string) {
    setStore((prev) => {
      const list = new Set(prev.done[habitId] || []);
      if (list.has(today)) list.delete(today);
      else list.add(today);
      const next: Store = {
        done: {
          ...prev.done,
          [habitId]: [...list].sort().slice(-40),
        },
      };
      saveStore(next, userId);
      return next;
    });
  }

  const streak = useMemo(() => {
    let best = 0;
    for (const h of habits) {
      const days = new Set(store.done[h.id] || []);
      let s = 0;
      const d = new Date();
      for (;;) {
        const k = d.toISOString().slice(0, 10);
        if (!days.has(k)) break;
        s += 1;
        d.setDate(d.getDate() - 1);
      }
      if (s > best) best = s;
    }
    return best;
  }, [habits, store]);

  const doneToday = habits.filter((h) => (store.done[h.id] || []).includes(today)).length;

  return (
    <div className={`habit-mini${compact ? ' habit-mini--compact' : ''}`}>
      <div className="habit-mini__head">
        <div>
          <div className="habit-mini__title">Привычки</div>
          <div className="habit-mini__sub">
            Сегодня {doneToday}/{habits.length}
            {streak > 0 ? ` · серия ${streak} дн.` : ''}
          </div>
        </div>
      </div>
      <ul className="habit-mini__list">
        {habits.map((h) => {
          const on = (store.done[h.id] || []).includes(today);
          return (
            <li key={h.id}>
              <label className={on ? 'is-on' : undefined}>
                <input type="checkbox" checked={on} onChange={() => toggle(h.id)} />
                <span>{h.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
