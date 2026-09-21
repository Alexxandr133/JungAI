import { Link } from 'react-router-dom';
import { OPERATOR_INFO } from '../../../content/operatorInfo';
import './PsyPricing.css';

type Feature = {
  label: string;
  value: string;
  muted?: boolean;
};

type Plan = {
  id: string;
  name: string;
  price: string;
  period: string;
  blurb: string;
  featured?: boolean;
  badge?: string;
  cta: string;
  features: Feature[];
};

const PLANS: Plan[] = [
  {
    id: 'start',
    name: 'Старт',
    price: '200 ₽',
    period: 'в месяц',
    blurb: 'Знакомство с платформой и небольшая практика.',
    cta: 'Начать бесплатно',
    features: [
      { label: 'Активные клиенты CRM', value: '1–4' },
      { label: 'AI-токены / мес', value: '50 000' },
      { label: 'AI-модели', value: 'Платформенная' },
      { label: 'Транскрибация', value: '30 мин / мес' },
      { label: 'Видео 1:1, календарь, запись, мессенджер', value: 'Включено' },
      { label: 'Видео-конференции', value: '—', muted: true },
      { label: 'CRM, задачи, ход терапии, метрики', value: 'Включено' },
      { label: 'Рабочая область', value: '5 вкладок' },
      { label: 'Тесты внутри сессий', value: '—', muted: true },
      { label: 'Выбор модели ИИ', value: '—', muted: true },
      { label: 'Публикации и сообщества', value: 'без лимита' },
      { label: 'Исследовательский контур', value: '—', muted: true },
      { label: 'Поддержка', value: '48 ч' },
    ],
  },
  {
    id: 'standard',
    name: 'Стандарт',
    price: '990 ₽',
    period: 'в месяц',
    blurb: 'Рабочий контур для растущей практики.',
    featured: true,
    badge: 'Оптимальный',
    cta: 'Выбрать Стандарт',
    features: [
      { label: 'Активные клиенты CRM', value: '5–10' },
      { label: 'AI-токены / мес', value: '350 000' },
      { label: 'AI-модели', value: '4 флагманские на выбор' },
      { label: 'Транскрибация', value: '3 ч / мес' },
      { label: 'Видео 1:1, календарь, запись, мессенджер', value: 'Включено' },
      { label: 'Видео-конференции', value: 'до 50 чел.' },
      { label: 'CRM, задачи, ход терапии, метрики', value: 'Включено' },
      { label: 'Рабочая область', value: '25 вкладок' },
      { label: 'Тесты внутри сессий', value: 'Включено' },
      { label: 'Выбор модели ИИ', value: '—', muted: true },
      { label: 'Публикации и сообщества', value: 'Без лимита' },
      { label: 'Исследовательский контур', value: '—', muted: true },
      { label: 'Поддержка', value: '24 ч' },
    ],
  },
  {
    id: 'pro',
    name: 'Профессиональная',
    price: '2 390 ₽',
    period: 'в месяц',
    blurb: 'Максимум ИИ, объёма и приоритетной поддержки.',
    cta: 'Выбрать Профессиональную',
    features: [
      { label: 'Активные клиенты CRM', value: 'Без лимита' },
      { label: 'AI-токены / мес', value: '1 500 000' },
      { label: 'AI-модели', value: '20+ моделей, лучшие решения' },
      { label: 'Транскрибация', value: '30 ч / мес' },
      { label: 'Видео 1:1, календарь, запись, мессенджер', value: 'Включено' },
      { label: 'Видео-конференции', value: 'до 150 чел.' },
      { label: 'CRM, задачи, ход терапии, метрики', value: 'Включено' },
      { label: 'Рабочая область', value: 'Без лимита' },
      { label: 'Тесты внутри сессий', value: 'Включено' },
      { label: 'Выбор модели ИИ', value: 'Включено' },
      { label: 'Публикации и сообщества', value: 'Без лимита' },
      { label: 'Исследовательский контур', value: 'Стенд базовых данных' },
      { label: 'Поддержка', value: 'Приоритет, 12 ч' },
    ],
  },
];

export function PsyPricing() {
  return (
    <section id="pricing" className="psy-pricing" aria-labelledby="psy-pricing-heading">
      <div className="landing-container psy-pricing__inner">
        <header className="psy-pricing__header">
          <h2 id="psy-pricing-heading" className="landing-h2 psy-pricing__title">
            Тарифы
          </h2>
          <p className="landing-lead psy-pricing__lead">
            Три уровня под практику: от бесплатного старта до профессионального контура с
            расширенным ИИ. <br />Сейчас ранний доступ — подключение без оплаты.<br />
          </p>
        </header>

        <div className="psy-pricing__grid">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`landing-card psy-pricing__card${plan.featured ? ' psy-pricing__card--featured' : ''}`}
            >
              {plan.badge ? (
                <span className="psy-pricing__badge">{plan.badge}</span>
              ) : null}

              <div className="psy-pricing__card-top">
                <h3 className="psy-pricing__name">{plan.name}</h3>
                <p className="psy-pricing__blurb">{plan.blurb}</p>
                <div className="psy-pricing__price-row">
                  <span className="psy-pricing__price">{plan.price}</span>
                  {plan.period ? (
                    <span className="psy-pricing__period">{plan.period}</span>
                  ) : null}
                </div>
              </div>

              <ul className="psy-pricing__features">
                {plan.features.map((feature) => (
                  <li
                    key={feature.label}
                    className={`psy-pricing__feature${feature.muted ? ' psy-pricing__feature--muted' : ''}`}
                  >
                    <span className="psy-pricing__feature-label">{feature.label}</span>
                    <span className="psy-pricing__feature-value">{feature.value}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/register"
                className={`landing-btn ${plan.featured ? 'landing-btn--primary' : 'landing-btn--secondary'} psy-pricing__card-cta`}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>

        <div className="psy-pricing__footer">
          <p className="psy-pricing__note">
            Участники раннего доступа сохранят льготные условия после запуска тарифов на индивидуальной основе.
          </p>
          <a
            href={`mailto:${OPERATOR_INFO.email}`}
            className="landing-btn landing-btn--tertiary psy-pricing__mail"
          >
            Задать вопрос: {OPERATOR_INFO.email} →
          </a>
        </div>
      </div>
    </section>
  );
}
