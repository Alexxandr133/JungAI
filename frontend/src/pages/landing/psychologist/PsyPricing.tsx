import { Link } from 'react-router-dom';
import { OPERATOR_INFO } from '../../../content/operatorInfo';
import './PsyPricing.css';

export function PsyPricing() {
  return (
    <section id="pricing" className="psy-pricing" aria-labelledby="psy-pricing-heading">
      <div className="landing-container psy-pricing__inner">
        <h2 id="psy-pricing-heading" className="landing-h2 psy-pricing__title">
          Тарифы
        </h2>
        <p className="landing-lead psy-pricing__lead">
          Сейчас платформа в раннем доступе: первые специалисты подключаются бесплатно. Мы
          финализируем тарифы и считаем экономику, чтобы цена была честной, а платформа —
          развивалась. Информация о тарифах появится здесь скоро.
        </p>

        <div className="landing-card psy-pricing__banner">
          Участники раннего доступа сохранят льготные условия после запуска тарифов. 
        </div>

        <div className="psy-pricing__cta">
          <Link to="/register" className="landing-btn landing-btn--primary">
            Присоединиться к раннему доступу
          </Link>
          <a
            href={`mailto:${OPERATOR_INFO.email}`}
            className="landing-btn landing-btn--tertiary"
          >
            Задать вопрос: {OPERATOR_INFO.email} →
          </a>
        </div>
      </div>
    </section>
  );
}
