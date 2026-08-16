import { Link } from 'react-router-dom';
import './PsyTour.css';

export type TourBlockData = {
  id: string;
  eyebrow: string;
  title: string;
  bullets: string[];
  microCta?: { label: string; to: string };
  mockSrc: string;
  mockAlt: string;
};

type PsyTourBlockProps = {
  block: TourBlockData;
  /** true = текст слева, мок справа; false = наоборот */
  textFirst: boolean;
  softBg: boolean;
};

export function PsyTourBlock({ block, textFirst, softBg }: PsyTourBlockProps) {
  const text = (
    <div className="psy-tour__text">
      <p className="landing-eyebrow">{block.eyebrow}</p>
      <h3 className="landing-h3" style={{ fontSize: 22, marginBottom: 16 }}>
        {block.title}
      </h3>
      <ul className="psy-tour__bullets">
        {block.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {block.microCta && (
        <Link to={block.microCta.to} className="landing-btn landing-btn--tertiary psy-tour__micro">
          {block.microCta.label} →
        </Link>
      )}
    </div>
  );

  const mock = (
    <div className="landing-card psy-tour__mock">
      <div className="psy-tour__mock-chrome" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="landing-mock-shot">
        <img
          className="psy-tour__mock-img landing-mock-shot__img"
          src={block.mockSrc}
          alt={block.mockAlt}
          width={960}
          height={640}
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );

  return (
    <article
      className={`psy-tour__block${softBg ? ' psy-tour__block--soft' : ''}`}
      id={block.id}
    >
      <div className={`landing-container psy-tour__row${textFirst ? '' : ' psy-tour__row--flip'}`}>
        {text}
        {mock}
      </div>
    </article>
  );
}
