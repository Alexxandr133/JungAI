import { Link } from 'react-router-dom';
import { MockClientsPanel } from './mocks/MockClientsPanel';
import {
  MockAiPanel,
  MockCalendarPanel,
  MockPublicationsPanel,
  MockTranscriptionPanel,
  MockVideoPanel,
  MockWorkspacePanel,
} from './mocks/TourMocks';
import './PsyTour.css';

export type TourMockKind =
  | 'image'
  | 'clients'
  | 'calendar'
  | 'video'
  | 'ai'
  | 'transcription'
  | 'workspace'
  | 'publications';

export type TourBlockData = {
  id: string;
  eyebrow: string;
  title: string;
  bullets: string[];
  microCta?: { label: string; to: string };
  mockKind?: TourMockKind;
  mockSrc?: string;
  mockAlt: string;
};

type PsyTourBlockProps = {
  block: TourBlockData;
  textFirst: boolean;
  softBg: boolean;
};

function renderLiveMock(kind: TourMockKind | undefined) {
  switch (kind) {
    case 'clients':
      return <MockClientsPanel />;
    case 'calendar':
      return <MockCalendarPanel />;
    case 'video':
      return <MockVideoPanel />;
    case 'ai':
      return <MockAiPanel />;
    case 'transcription':
      return <MockTranscriptionPanel />;
    case 'workspace':
      return <MockWorkspacePanel />;
    case 'publications':
      return <MockPublicationsPanel />;
    default:
      return null;
  }
}

export function PsyTourBlock({ block, textFirst, softBg }: PsyTourBlockProps) {
  const live = renderLiveMock(block.mockKind);

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
    <div className="landing-card psy-tour__mock" role="img" aria-label={block.mockAlt}>
      <div className="psy-tour__mock-chrome" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      {live ? (
        <div className="psy-tour__mock-body">{live}</div>
      ) : block.mockSrc ? (
        <div className="landing-mock-shot">
          <img
            className="psy-tour__mock-img landing-mock-shot__img"
            src={block.mockSrc}
            alt=""
            width={960}
            height={640}
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : null}
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
