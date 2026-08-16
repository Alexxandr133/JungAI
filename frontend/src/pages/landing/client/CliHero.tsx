import { Link } from 'react-router-dom';
import { OPERATOR_INFO } from '../../../content/operatorInfo';
import './CliHero.css';

export function CliHero() {
  return (
    <section className="cli-hero">
      <div className="landing-container cli-hero__inner">
        <p className="landing-eyebrow">Аналитическая психология онлайн</p>
        <h1 className="landing-h1 cli-hero__title">
          Психолог, который слышит. И платформа, которая поддерживает
        </h1>
        <p className="landing-lead cli-hero__lead">
          JungAI — платформа аналитической психологии. Здесь выбирают верифицированного психолога и
          встречаются с ним по видео. А между сессиями — дневник снов, тесты и ваши собственные
          изменения, которые видно.
        </p>
        <div className="cli-hero__cta">
          <Link to="/match" className="landing-btn landing-btn--primary">
            Выбрать психолога
          </Link>
          <a href="#how" className="landing-btn landing-btn--secondary">
            Как это устроено
          </a>
        </div>
        <ul className="cli-hero__trust">
          <li>Специалисты верифицированы — проверяем образование и метод</li>
          <li>Стоимость сессии видна в карточке до записи</li>
          <li>Оператор ПДн — реестр РКН № {OPERATOR_INFO.rknRegistryNumber}</li>
        </ul>
      </div>
    </section>
  );
}
