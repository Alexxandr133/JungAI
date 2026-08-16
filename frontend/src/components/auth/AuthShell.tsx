import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../BrandLogo';
import { OPERATOR_INFO } from '../../content/operatorInfo';
import './Auth.css';

export type AuthRole = 'client' | 'psychologist' | 'researcher';

const ROLE_BULLETS: Record<AuthRole, string[]> = {
  client: ['Верифицированные психологи', 'Дневник снов', 'Тесты и самопознание'],
  psychologist: ['CRM и календарь', 'ИИ под модальность', 'Транскрибация сессий'],
  researcher: ['AI-символы снов', 'Индивидуация', 'Исследовательские проекты'],
};

type AuthShellProps = {
  mode: 'register' | 'login';
  role?: AuthRole | null;
  /** Без брендового блока — карточка по центру (регистрация) */
  centered?: boolean;
  brandTitle?: string;
  brandLead?: string;
  children: ReactNode;
};

export function AuthShell({
  mode,
  role = 'client',
  centered = false,
  brandTitle,
  brandLead,
  children,
}: AuthShellProps) {
  const bullets = ROLE_BULLETS[role || 'client'];
  const defaultTitle =
    mode === 'register' ? 'JungAI — пространство практики' : 'С возвращением в JungAI';
  const defaultLead =
    mode === 'register'
      ? 'Один аккаунт для сессий, дневника и работы со специалистом.'
      : 'Войдите, чтобы продолжить работу в кабинете.';

  return (
    <div
      className={`auth-page${centered ? ' auth-page--centered' : ''}${
        mode === 'register' ? ' auth-page--compact' : ''
      }`}
      data-auth-light="true"
    >
      <header className="auth-page__top">
        <BrandLogo to="/" height={36} />
        {mode === 'register' ? (
          <Link to="/login" className="auth-page__top-link">
            Уже есть аккаунт? <span>Войти</span>
          </Link>
        ) : (
          <Link to="/register" className="auth-page__top-link">
            Нет аккаунта? <span>Регистрация</span>
          </Link>
        )}
      </header>

      {centered ? (
        <div className="auth-page__layout auth-page__layout--centered">
          <main className="auth-page__main">
            <div className="auth-page__card">{children}</div>
          </main>
        </div>
      ) : (
        <div className="auth-page__layout">
          <aside className="auth-page__brand" aria-label="О платформе">
            <div className="auth-page__brand-inner">
              <BrandLogo to="/" height={44} />
              <h2 className="auth-page__brand-title">{brandTitle || defaultTitle}</h2>
              <p className="auth-page__brand-lead">{brandLead || defaultLead}</p>
              <ul className="auth-page__bullets">
                {bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <p className="auth-page__trust">
                Оператор ПДн — реестр РКН № {OPERATOR_INFO.rknRegistryNumber}
              </p>
            </div>
          </aside>

          <main className="auth-page__main">
            <div className="auth-page__card">{children}</div>
          </main>
        </div>
      )}
    </div>
  );
}
