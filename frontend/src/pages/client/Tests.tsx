import { Link } from 'react-router-dom';
import { ClientNavbar } from '../../components/ClientNavbar';
import './Tests.css';

/** Тесты скрыты из меню клиента — заглушка «В разработке» */
export default function ClientTests() {
  return (
    <div className="client-tests">
      <ClientNavbar />
      <main className="client-tests__main">
        <div className="client-tests__wip">
          <p className="client-tests__eyebrow">Личное развитие</p>
          <span className="client-tests__wip-badge">В разработке</span>
          <h1 className="client-tests__h1">Тесты скоро появятся здесь</h1>
          <p className="client-tests__lead">
            Готовим спокойный каталог скринингов и техник. Пока можно смотреть прогресс терапии или вести дневник.
          </p>
          <div className="client-tests__wip-actions">
            <Link to="/client/progress" className="button" style={{ textDecoration: 'none' }}>
              К прогрессу
            </Link>
            <Link to="/client/journal" className="button secondary" style={{ textDecoration: 'none' }}>
              Открыть дневник
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
