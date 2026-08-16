import './CliRequests.css';
import { LANDING_TOPIC_TAGS } from 'jungai-shared';

type CliRequestsProps = {
  selected: string | null;
  onSelect: (chip: string) => void;
};

export function CliRequests({ selected, onSelect }: CliRequestsProps) {
  return (
    <section className="cli-requests" aria-labelledby="cli-requests-heading">
      <div className="landing-container cli-requests__inner">
        <h2 id="cli-requests-heading" className="landing-h2 cli-requests__title">
          С чем вы приходите?
        </h2>
        <div className="cli-requests__chips" role="list">
          {LANDING_TOPIC_TAGS.map((chip) => {
            const active = selected === chip;
            return (
              <button
                key={chip}
                type="button"
                role="listitem"
                className={`cli-requests__chip${active ? ' is-active' : ''}`}
                onClick={() => {
                  onSelect(chip);
                  document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {chip}
              </button>
            );
          })}
        </div>
        <p className="landing-small cli-requests__hint">
          Выберите запрос — покажем специалистов, которые работают с этой темой.
        </p>
      </div>
    </section>
  );
}
