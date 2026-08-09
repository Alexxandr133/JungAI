import { useEffect, useState } from 'react';
import './MoodCheckIn.css';

type Props = {
  mood?: number | null;
  energy?: number;
  anxiety?: number;
  disabled?: boolean;
  locked?: boolean;
  compact?: boolean;
  saving?: boolean;
  onSave: (next: { mood: number; energy: number; anxiety: number }) => void;
};

/** Soft muted red → green */
const MOOD_META = [
  { n: 1, label: 'Очень тяжело', tone: 'bad', color: '#c48b8b' },
  { n: 2, label: 'Тяжело', tone: 'low', color: '#c9a08a' },
  { n: 3, label: 'Нейтрально', tone: 'mid', color: '#b8ae8e' },
  { n: 4, label: 'Хорошо', tone: 'ok', color: '#9bb89a' },
  { n: 5, label: 'Отлично', tone: 'great', color: '#7fad8f' },
] as const;

function MoodFaceIcon({ level, color }: { level: number; color: string }) {
  const mouth =
    level === 1
      ? 'M8 16.2c1.6-2.2 4-3.2 6.5-3.2S19.4 14 21 16.2'
      : level === 2
        ? 'M9 15.6c1.3-1.4 3.2-2.1 5.5-2.1s4.2.7 5.5 2.1'
        : level === 3
          ? 'M9.5 15.2h11'
          : level === 4
            ? 'M9 14.2c1.3 1.5 3.2 2.3 5.5 2.3s4.2-.8 5.5-2.3'
            : 'M8.5 13.6c1.6 2.4 4.1 3.6 6.5 3.6s4.9-1.2 6.5-3.6';

  return (
    <svg className="mood-tracker__icon" viewBox="0 0 28 28" width="28" height="28" aria-hidden>
      <circle cx="14" cy="14" r="12" fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.5" />
      <circle cx="10" cy="11.2" r="1.35" fill={color} />
      <circle cx="18" cy="11.2" r="1.35" fill={color} />
      <path d={mouth} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function MoodCheckInControl({
  mood = null,
  energy = 3,
  anxiety = 3,
  disabled,
  locked,
  compact,
  saving,
  onSave,
}: Props) {
  const [draftMood, setDraftMood] = useState<number | null>(mood);
  const [draftEnergy, setDraftEnergy] = useState(energy);
  const [draftAnxiety, setDraftAnxiety] = useState(anxiety);

  useEffect(() => {
    setDraftMood(mood);
    setDraftEnergy(energy);
    setDraftAnxiety(anxiety);
  }, [mood, energy, anxiety]);

  const active = draftMood != null ? MOOD_META[draftMood - 1] : null;
  const canEdit = !disabled && !locked && !saving;

  return (
    <div className={`mood-tracker${compact ? ' mood-tracker--compact' : ''}${locked ? ' mood-tracker--locked' : ''}`}>
      <div className="mood-tracker__head">
        <div className="mood-tracker__title">Трекер настроения</div>
        <div className="mood-tracker__sub">
          {locked
            ? 'Сегодня уже отмечено. Следующая отметка — завтра.'
            : compact
              ? 'Одна отметка в день'
              : 'Выберите настроение, энергию и тревогу — затем сохраните. Одна отметка в день.'}
        </div>
      </div>

      <div className="mood-tracker__faces" role="group" aria-label="Трекер настроения">
        {MOOD_META.map((m) => (
          <button
            key={m.n}
            type="button"
            disabled={!canEdit}
            className={`mood-tracker__face mood-tracker__face--${m.tone}${draftMood === m.n ? ' is-active' : ''}`}
            style={{ ['--mood-tone' as string]: m.color }}
            title={m.label}
            aria-label={`${m.n}: ${m.label}`}
            aria-pressed={draftMood === m.n}
            onClick={() => setDraftMood(m.n)}
          >
            <MoodFaceIcon level={m.n} color={m.color} />
            {!compact && <span className="mood-tracker__n">{m.n}</span>}
          </button>
        ))}
      </div>

      {active && (
        <div className={`mood-tracker__status mood-tracker__status--${active.tone}`}>
          <MoodFaceIcon level={active.n} color={active.color} />
          <span>{active.label}</span>
        </div>
      )}

      <div className="mood-tracker__sliders">
        <label className="mood-tracker__slider">
          <span className="mood-tracker__slider-label">
            Энергия <strong>{draftEnergy}/5</strong>
          </span>
          <input
            type="range"
            min={1}
            max={5}
            value={draftEnergy}
            disabled={!canEdit || draftMood == null}
            onChange={(e) => setDraftEnergy(Number(e.target.value))}
          />
        </label>
        <label className="mood-tracker__slider">
          <span className="mood-tracker__slider-label">
            Тревога <strong>{draftAnxiety}/5</strong>
          </span>
          <input
            type="range"
            min={1}
            max={5}
            value={draftAnxiety}
            disabled={!canEdit || draftMood == null}
            onChange={(e) => setDraftAnxiety(Number(e.target.value))}
          />
        </label>
      </div>

      {!locked && (
        <button
          type="button"
          className="button mood-tracker__save"
          disabled={!canEdit || draftMood == null}
          onClick={() => {
            if (draftMood == null) return;
            onSave({ mood: draftMood, energy: draftEnergy, anxiety: draftAnxiety });
          }}
        >
          {saving ? 'Сохраняем…' : 'Сохранить на сегодня'}
        </button>
      )}
    </div>
  );
}

export type MoodDailyPoint = {
  date: string;
  mood: number | null;
  energy?: number | null;
  anxiety?: number | null;
};

const MOOD_DOT = ['', '#c48b8b', '#c9a08a', '#b8ae8e', '#9bb89a', '#7fad8f'];

export function MoodMiniChart({
  points,
  height = 200,
}: {
  points: MoodDailyPoint[];
  height?: number;
}) {
  if (!points.length) {
    return (
      <div className="mood-chart mood-chart--empty" style={{ minHeight: height }}>
        Пока нет отметок — сохраните настроение слева
      </div>
    );
  }

  const filled = points.filter((p) => p.mood != null);
  const w = 560;
  const h = height;
  const padL = 36;
  const padR = 12;
  const padT = 22;
  const padB = 36;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const n = Math.max(points.length, 1);

  const xAt = (i: number) => padL + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const yAt = (mood: number) => padT + ((5 - mood) / 4) * plotH;

  const pathPts = points
    .map((p, i) => (p.mood != null ? { i, mood: p.mood as number } : null))
    .filter(Boolean) as Array<{ i: number; mood: number }>;

  let lineD = '';
  pathPts.forEach((p, idx) => {
    const x = xAt(p.i);
    const y = yAt(p.mood);
    lineD += `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
  });

  let energyD = '';
  const energyPts = points
    .map((p, i) => (p.energy != null ? { i, energy: p.energy as number } : null))
    .filter(Boolean) as Array<{ i: number; energy: number }>;
  energyPts.forEach((p, idx) => {
    const x = xAt(p.i);
    const y = yAt(p.energy);
    energyD += `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
  });

  let anxietyD = '';
  const anxietyPts = points
    .map((p, i) => (p.anxiety != null ? { i, anxiety: p.anxiety as number } : null))
    .filter(Boolean) as Array<{ i: number; anxiety: number }>;
  anxietyPts.forEach((p, idx) => {
    const x = xAt(p.i);
    const y = yAt(p.anxiety);
    anxietyD += `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
  });

  const yTicks = [5, 4, 3, 2, 1];
  const labelEvery = points.length > 10 ? 2 : 1;

  return (
    <div className="mood-chart-wrap">
      <svg className="mood-chart" viewBox={`0 0 ${w} ${h}`} width="100%" height={height} role="img" aria-label="График настроения за период">
        <defs>
          <linearGradient id="moodLineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#c48b8b" />
            <stop offset="50%" stopColor="#b8ae8e" />
            <stop offset="100%" stopColor="#7fad8f" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = yAt(tick);
          return (
            <g key={tick}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--navbar-edge)" strokeWidth="1" strokeDasharray="4 6" />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="mood-chart__axis">
                {tick}
              </text>
            </g>
          );
        })}

        {points.map((p, i) => {
          if (p.mood == null) return null;
          const x = xAt(i);
          const barH = ((p.mood as number) / 5) * plotH * 0.55;
          const y = padT + plotH - barH;
          const fill = MOOD_DOT[p.mood as number] || '#b8ae8e';
          return (
            <rect
              key={`bar-${p.date}`}
              x={x - 6}
              y={y}
              width={12}
              height={Math.max(barH, 2)}
              rx={4}
              fill={fill}
              fillOpacity={0.28}
            />
          );
        })}

        {energyD && (
          <path
            d={energyD.trim()}
            fill="none"
            stroke="rgba(127, 173, 143, 0.7)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5 4"
          />
        )}
        {anxietyD && (
          <path
            d={anxietyD.trim()}
            fill="none"
            stroke="rgba(201, 160, 138, 0.75)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2 5"
          />
        )}

        {lineD && (
          <path d={lineD.trim()} fill="none" stroke="url(#moodLineGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {points.map((p, i) => {
          if (p.mood == null) return null;
          const x = xAt(i);
          const y = yAt(p.mood as number);
          const fill = MOOD_DOT[p.mood as number] || '#b8ae8e';
          return (
            <circle key={`pt-${p.date}`} cx={x} cy={y} r="5" fill="var(--surface)" stroke={fill} strokeWidth="2.5" />
          );
        })}

        {points.map((p, i) => {
          if (i % labelEvery !== 0 && i !== points.length - 1) return null;
          const x = xAt(i);
          const label = p.date.slice(5).replace('-', '.');
          return (
            <text key={`x-${p.date}`} x={x} y={h - 10} textAnchor="middle" className="mood-chart__axis">
              {label}
            </text>
          );
        })}
      </svg>

      {filled.length === 0 ? (
        <div className="mood-chart__hint">Отметок за эти дни ещё нет</div>
      ) : (
        <div className="mood-chart__legend">
          <span className="mood-chart__legend-item">
            <span className="mood-chart__swatch mood-chart__swatch--mood" /> Настроение
          </span>
          <span className="mood-chart__legend-item">
            <span className="mood-chart__swatch mood-chart__swatch--energy" /> Энергия
          </span>
          <span className="mood-chart__legend-item">
            <span className="mood-chart__swatch mood-chart__swatch--anxiety" /> Тревога
          </span>
        </div>
      )}
    </div>
  );
}
