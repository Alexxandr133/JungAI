const SESSION_DURATION_MAX_MIN = 360;

type Props = {
  id?: string;
  value: number;
  onChange: (minutes: number) => void;
  label?: string;
  labelClassName?: string;
};

export function SessionDurationField({
  id,
  value,
  onChange,
  label = 'Продолжительность',
  labelClassName = 'events-page__field-label'
}: Props) {
  return (
    <div>
      <label className={labelClassName} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="events-page__field"
        type="number"
        inputMode="numeric"
        max={SESSION_DURATION_MAX_MIN}
        value={value > 0 ? value : ''}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(0);
            return;
          }
          const v = Math.round(Number(raw));
          if (!Number.isFinite(v)) return;
          onChange(Math.min(SESSION_DURATION_MAX_MIN, v));
        }}
      />
    </div>
  );
}

export function capSessionDurationMin(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return minutes;
  return Math.min(SESSION_DURATION_MAX_MIN, Math.round(minutes));
}
