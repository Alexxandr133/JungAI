import { useId } from 'react';
import '../pages/psychologists/PublicProfile.css';

const KIND_LABEL: Record<string, string> = {
  higher: 'Высшее',
  course: 'Курс',
  other: 'Другое',
};

const WHO_LABEL: Record<string, string> = {
  self: 'индивидуально',
  couple: 'с парами',
  child: 'с детьми',
};

export type PsychologistPublicEducation = {
  id: string;
  kind: string;
  institution: string;
  title: string;
  yearFrom: number;
  yearTo: number | null;
};

export type PsychologistPublicBodyData = {
  bio?: string | null;
  worksWith?: string[];
  audienceFormats?: string[];
  educations?: PsychologistPublicEducation[];
};

function formatAudience(formats: string[]): string {
  const parts = formats.map((a) => WHO_LABEL[a] || a).filter(Boolean);
  if (!parts.length) return '';
  return `Формат работы: ${parts.join(' · ')}`;
}

type Props = {
  data: PsychologistPublicBodyData;
  /** Плотнее в сайдбаре предпросмотра */
  compact?: boolean;
};

/** Секции публичного профиля без шапки и без расписания (§12.3 п.2–4). */
export function PsychologistPublicBody({ data, compact }: Props) {
  const uid = useId();
  const worksWith = data.worksWith || [];
  const educations = data.educations || [];
  const bio = (data.bio || '').trim();
  const formats = data.audienceFormats || [];
  const audience = formatAudience(formats);
  const empty = !worksWith.length && !bio && !audience && !educations.length;

  if (empty) {
    return (
      <p className="landing-small" style={{ marginTop: compact ? 16 : 24, color: 'var(--ink-muted)' }}>
        О себе
      </p>
    );
  }

  return (
    <div className={`psy-public-body${compact ? ' psy-public-body--compact' : ''}`}>
      {worksWith.length ? (
        <section className="psy-public-section" aria-labelledby={`${uid}-works`}>
          <h2 id={`${uid}-works`} className="landing-h3">
            С чем работает
          </h2>
          <div className="psy-public-chips">
            {worksWith.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </section>
      ) : null}

      {bio ? (
        <section className="psy-public-section" aria-labelledby={`${uid}-about`}>
          <h2 id={`${uid}-about`} className="landing-h3">
            О себе
          </h2>
          <p className="psy-public-about">{bio}</p>
          {audience ? <p className="psy-public-format">{audience}</p> : null}
        </section>
      ) : audience ? (
        <section className="psy-public-section">
          <p className="psy-public-format">{audience}</p>
        </section>
      ) : null}

      {educations.length ? (
        <section className="psy-public-section" aria-labelledby={`${uid}-edu`}>
          <h2 id={`${uid}-edu`} className="landing-h3">
            Образование и курсы
          </h2>
          <div className="psy-public-edu-list">
            {educations.map((e) => (
              <article key={e.id} className="landing-card psy-public-edu">
                <div className="psy-public-edu__title">
                  {e.title}
                  <span> · {KIND_LABEL[e.kind] || e.kind}</span>
                </div>
                <div className="psy-public-edu__meta">{e.institution}</div>
                <div className="psy-public-edu__meta">
                  {e.yearFrom}
                  {e.yearTo ? `–${e.yearTo}` : ' — н.в.'}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
