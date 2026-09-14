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
  /** Разрешить правку уже сохранённой отметки за сегодня */
  onUnlock?: () => void;
};

/** Soft muted red → green — color used on labels only */
const MOOD_META = [
  { n: 1, label: 'Очень тяжело', tone: 'bad', color: '#c48b8b' },
  { n: 2, label: 'Тяжело', tone: 'low', color: '#c9a08a' },
  { n: 3, label: 'Нейтрально', tone: 'mid', color: '#b8ae8e' },
  { n: 4, label: 'Хорошо', tone: 'ok', color: '#9bb89a' },
  { n: 5, label: 'Отлично', tone: 'great', color: '#7fad8f' },
] as const;

/** Thin line-art faces — monochrome stroke, no fill tint */
function MoodFaceIcon({ level }: { level: number }) {
  const mouth =
    level === 1
      ? 'M9 18c1.4-2.4 3.6-3.5 5-3.5s3.6 1.1 5 3.5'
      : level === 2
        ? 'M9.5 17.2c1.2-1.5 3-2.2 4.5-2.2s3.3.7 4.5 2.2'
        : level === 3
          ? 'M9.5 16.5h9'
          : level === 4
            ? 'M9.5 15.8c1.2 1.6 3 2.4 4.5 2.4s3.3-.8 4.5-2.4'
            : 'M9 15c1.5 2.6 3.8 3.8 5 3.8S17.5 17.6 19 15';

  return (
    <svg
      className="mood-tracker__icon"
      viewBox="0 0 28 28"
      width="28"
      height="28"
      fill="none"
      aria-hidden
    >
      <circle cx="14" cy="14" r="10.25" stroke="currentColor" strokeWidth="1.15" />
      <circle cx="10.25" cy="11.5" r="1.05" fill="currentColor" />
      <circle cx="17.75" cy="11.5" r="1.05" fill="currentColor" />
      <path d={mouth} stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
      {level === 1 && (
        <path d="M8.2 9.2c.9-.7 1.9-.9 2.7-.55M17.1 8.65c.8-.35 1.8-.15 2.7.55" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      )}
      {level === 5 && (
        <path d="M8.4 9.6c.7.55 1.5.7 2.2.35M17.4 9.95c.7.35 1.5.2 2.2-.35" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      )}
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
  onUnlock,
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
  const hasExisting = mood != null;

  return (
    <div className={`mood-tracker${compact ? ' mood-tracker--compact' : ''}${locked ? ' mood-tracker--locked' : ''}`}>
      <div className="mood-tracker__head">
        <div className="mood-tracker__title">Трекер настроения</div>
        <div className="mood-tracker__sub">
          {locked
            ? compact
              ? 'Уже отмечено сегодня'
              : 'Сегодня уже отмечено — можно изменить, если настроение сменилось.'
            : compact
              ? 'Одна отметка в день'
              : 'Выберите настроение, энергию и тревогу — затем сохраните. Одну отметку за день можно обновить.'}
        </div>
      </div>

      <div className="mood-tracker__faces" role="group" aria-label="Трекер настроения">
        {MOOD_META.map((m) => (
          <button
            key={m.n}
            type="button"
            disabled={!canEdit}
            className={`mood-tracker__face mood-tracker__face--${m.tone}${draftMood === m.n ? ' is-active' : ''}`}
            title={m.label}
            aria-label={`${m.n}: ${m.label}`}
            aria-pressed={draftMood === m.n}
            onClick={() => setDraftMood(m.n)}
          >
            <MoodFaceIcon level={m.n} />
            <span
              className={`mood-tracker__n${compact ? ' mood-tracker__n--compact' : ''}`}
              style={{ color: m.color }}
            >
              {compact ? m.label : m.n}
            </span>
          </button>
        ))}
      </div>

      {active && (
        <div className="mood-tracker__status">
          <MoodFaceIcon level={active.n} />
          <span style={{ color: active.color }}>{active.label}</span>
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

      {locked ? (
        <button type="button" className="button secondary mood-tracker__save" disabled={disabled || saving} onClick={() => onUnlock?.()}>
          Изменить отметку
        </button>
      ) : (
        <button
          type="button"
          className="button mood-tracker__save"
          disabled={!canEdit || draftMood == null}
          onClick={() => {
            if (draftMood == null) return;
            onSave({ mood: draftMood, energy: draftEnergy, anxiety: draftAnxiety });
          }}
        >
          {saving ? 'Сохраняем…' : hasExisting ? 'Обновить отметку' : 'Сохранить на сегодня'}
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
  sessionMarkers,
  fillContainer = false,
}: {
  points: MoodDailyPoint[];
  height?: number;
  /** YYYY-MM-DD keys — дни с сессиями на графике */
  sessionMarkers?: string[];
  /** Растянуть SVG на всю доступную ширину/высоту родителя */
  fillContainer?: boolean;
}) {
  if (!points.length) {
    return (
      <div
        className={`mood-chart mood-chart--empty${fillContainer ? ' mood-chart--fill' : ''}`}
        style={fillContainer ? undefined : { minHeight: height }}
      >
        Пока нет отметок — сохраните настроение слева
      </div>
    );
  }

  const filled = points.filter((p) => p.mood != null);
  const w = 560;
  /** Более «высокий» viewBox при fill — меньше пустоты по вертикали */
  const h = fillContainer ? Math.max(height, 280) : height;
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
    <div className={`mood-chart-wrap${fillContainer ? ' mood-chart-wrap--fill' : ''}`}>
      <svg
        className={`mood-chart${fillContainer ? ' mood-chart--fill' : ''}`}
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={fillContainer ? '100%' : height}
        preserveAspectRatio={fillContainer ? 'none' : 'xMidYMid meet'}
        role="img"
        aria-label="График настроения за период"
      >
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
          <path d={lineD.trim()} fill="none" stroke="var(--brand, #6c5bd4)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {sessionMarkers?.map((dateKey) => {
          const i = points.findIndex((p) => p.date === dateKey || p.date.startsWith(dateKey));
          if (i < 0) return null;
          const p = points[i];
          if (p.mood == null) return null;
          const x = xAt(i);
          const y = yAt(p.mood as number);
          return (
            <g key={`sess-${dateKey}`} aria-hidden>
              <circle cx={x} cy={y - 14} r="7" fill="var(--sage, #3e8a6e)" fillOpacity="0.9" stroke="#fff" strokeWidth="2" />
              <text x={x} y={y - 11} textAnchor="middle" className="mood-chart__axis" style={{ fontSize: 9, fill: '#fff', fontWeight: 800 }}>
                S
              </text>
            </g>
          );
        })}

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
