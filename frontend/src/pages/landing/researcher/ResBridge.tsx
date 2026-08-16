import { Link } from 'react-router-dom';
import './ResBridge.css';

const BULLETS = [
  'Сны и символы из дневника клиента — живой материал для сессий.',
  'Гексаграмма индивидуации — как диагностическая оптика.',
  'Публикации исследований укрепляют экспертность и приводят клиентов.',
] as const;

export function ResBridge() {
  return (
    <section
      id="for-psychologists"
      className="res-bridge"
      aria-labelledby="res-bridge-heading"
    >
      <div className="landing-container res-bridge__inner">
        <h2 id="res-bridge-heading" className="landing-h2 res-bridge__title">
          Практикующий психолог? Исследовательский контур усиливает терапию
        </h2>
        <ul className="res-bridge__bullets">
          {BULLETS.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <Link to="/" className="landing-btn landing-btn--tertiary">
          Смотреть платформу для психологов →
        </Link>
      </div>
    </section>
  );
}
