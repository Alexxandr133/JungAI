import { OPERATOR_INFO } from '../../../content/operatorInfo';
import './PsyVerification.css';

const REQUIREMENTS = [
  'Образование.',
  'Обучение методу от 500 часов.',
  'Регулярная супервизия и личная терапия (Не касается молодых специалистов).',
  'Этика и конфиденциальность — по пользовательскому соглашению платформы.',
] as const;

export function PsyVerification() {
  return (
    <section className="psy-verify" aria-labelledby="psy-verify-heading">
      <div className="landing-container psy-verify__grid">
        <div>
          <h2 id="psy-verify-heading" className="landing-h2 psy-verify__title">
            Мы проверяем дипломы. Поэтому клиентам спокойно.
          </h2>
          <ul className="psy-verify__list">
            {REQUIREMENTS.map((item) => (
              <li key={item}>
                <span className="psy-verify__check" aria-hidden>
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="landing-card psy-verify__data">
          <p className="landing-body psy-verify__data-text">
            Работаем по закону РФ: оператор персональных данных, реестр РКН №{' '}
            {OPERATOR_INFO.rknRegistryNumber}. Данные клиентов остаются в вашем контуре и даже администрация не может их получить, а ИИ не
            заменяет терапевта — и это зафиксировано в наших правилах.
          </p>
        </div>
      </div>
    </section>
  );
}
