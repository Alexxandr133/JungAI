import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, FlaskConical, HeartHandshake, Stethoscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LegalRegistrationConsent } from '../components/LegalRegistrationConsent';
import { AuthShell, type AuthRole } from '../components/auth/AuthShell';
import { api } from '../lib/api';

function initialRole(raw: string | null): AuthRole {
  if (raw === 'psychologist' || raw === 'researcher' || raw === 'client') return raw;
  return 'client';
}

const ROLES: Array<{
  id: AuthRole;
  name: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'client',
    name: 'Клиент',
    desc: 'Найти психолога, вести дневник и проходить тесты',
    icon: <HeartHandshake size={20} strokeWidth={2} aria-hidden />,
  },
  {
    id: 'psychologist',
    name: 'Психолог',
    desc: 'CRM, календарь, сессии и ИИ под ваш подход',
    icon: <Stethoscope size={20} strokeWidth={2} aria-hidden />,
  },
  {
    id: 'researcher',
    name: 'Исследователь',
    desc: 'Сны, символы, индивидуация и проекты',
    icon: <FlaskConical size={20} strokeWidth={2} aria-hidden />,
  },
];

export default function Register() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [role, setRole] = useState<AuthRole>(() => initialRole(searchParams.get('role')));
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedSpecial, setAcceptedSpecial] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);

  useEffect(() => {
    if (resendLeft <= 0) return;
    const t = window.setTimeout(() => setResendLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendLeft]);

  function formatCodeInput(v: string): string {
    const digits = v.replace(/\D/g, '').slice(0, 6);
    if (digits.length <= 3) return digits;
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      setError('Укажите корректный email');
      return;
    }

    if (!password || password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (!acceptedTerms) {
      setError('Необходимо принять пользовательское соглашение и согласие на обработку персональных данных');
      return;
    }

    if (role === 'client' && !acceptedSpecial) {
      setError('Необходимо дать согласие на обработку сведений о состоянии здоровья в пользовательских материалах');
      return;
    }

    setLoading(true);
    try {
      const result = await api<{ requiresEmailVerification?: boolean; email?: string }>('/api/auth/register', {
        method: 'POST',
        body: {
          email: emailNorm,
          name: name.trim() || undefined,
          password,
          role,
        },
      });
      if (result.requiresEmailVerification) {
        setPendingVerification(true);
        setResendLeft(60);
      } else {
        setError('Не удалось запустить подтверждение почты');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка при регистрации');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api<{ token: string; user: any }>('/api/auth/verify-email', {
        method: 'POST',
        body: {
          email: email.trim().toLowerCase(),
          code: verificationCode.trim(),
        },
      });
      await loginWithToken(result.token);
      const pendingRaw = localStorage.getItem('pendingPsychologistContact');
      if (pendingRaw && result.user.role === 'client') {
        try {
          const pending = JSON.parse(pendingRaw) as {
            psychologistId: string;
            type: 'chat' | 'session';
            message: string;
          };
          const created = await api<{ chatRoomId?: string }>('/api/support/request', {
            method: 'POST',
            token: result.token,
            body: pending,
          });
          localStorage.removeItem('pendingPsychologistContact');
          if (pending.type === 'chat' && created?.chatRoomId) {
            navigate(`/chat?roomId=${encodeURIComponent(created.chatRoomId)}`);
            return;
          }
        } catch {
          localStorage.removeItem('pendingPsychologistContact');
        }
      }
      if (result.user.role === 'admin') navigate('/admin');
      else if (result.user.role === 'psychologist') navigate('/psychologist/profile');
      else if (result.user.role === 'researcher') navigate('/researcher/profile');
      else if (result.user.role === 'client') navigate('/client');
      else navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Не удалось подтвердить email');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (resendLeft > 0) return;
    setError(null);
    setLoading(true);
    try {
      await api('/api/auth/resend-verification', {
        method: 'POST',
        body: { email: email.trim().toLowerCase() },
      });
      setResendLeft(60);
    } catch (err: any) {
      setError(err.message || 'Не удалось отправить код повторно');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell mode="register" centered>
      {!pendingVerification ? (
        <>
          <h1 className="auth-page__h1">Регистрация</h1>

          {error ? <div className="auth-page__error">{error}</div> : null}

          <form onSubmit={handleRegister}>
            <div className="auth-page__section">
              <div className="auth-page__section-title">Роль</div>
              <div className="auth-page__role-seg" role="radiogroup" aria-label="Роль">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={role === r.id}
                    className={`auth-page__role-seg-btn${role === r.id ? ' is-selected' : ''}`}
                    onClick={() => setRole(r.id)}
                  >
                    {r.icon}
                    <span className="auth-page__role-seg-label">{r.name}</span>
                  </button>
                ))}
              </div>
              <p className="auth-page__role-seg-hint">
                {ROLES.find((r) => r.id === role)?.desc}
              </p>
            </div>

            <div className="auth-page__section">
              <div className="auth-page__section-title">Аккаунт</div>
              <div className="auth-page__field">
                <label className="auth-page__label" htmlFor="reg-email">
                  Email *
                </label>
                <input
                  id="reg-email"
                  className="auth-page__input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
                <div className="auth-page__hint">Код подтверждения придёт на эту почту</div>
              </div>
              <div className="auth-page__row-2">
                <div className="auth-page__field">
                  <label className="auth-page__label" htmlFor="reg-password">
                    Пароль *
                  </label>
                  <div className="auth-page__input-wrap">
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Мин. 6 символов"
                    />
                    <button
                      type="button"
                      className="auth-page__eye"
                      aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="auth-page__field">
                  <label className="auth-page__label" htmlFor="reg-confirm">
                    Подтверждение *
                  </label>
                  <div className="auth-page__input-wrap">
                    <input
                      id="reg-confirm"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Повторите"
                    />
                    <button
                      type="button"
                      className="auth-page__eye"
                      aria-label={showConfirm ? 'Скрыть пароль' : 'Показать пароль'}
                      onClick={() => setShowConfirm((v) => !v)}
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="auth-page__section">
              <div className="auth-page__section-title">О себе</div>
              <div className="auth-page__field">
                <label className="auth-page__label" htmlFor="reg-name">
                  Имя
                </label>
                <input
                  id="reg-name"
                  className="auth-page__input"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    role === 'psychologist'
                      ? 'Как к вам будут обращаться клиенты'
                      : role === 'researcher'
                        ? 'Имя для исследовательского профиля'
                        : 'Как к вам обращаться'
                  }
                />
              </div>
            </div>

            <div className="auth-page__section">
              <div className="auth-page__section-title">Согласия</div>
              <LegalRegistrationConsent
                variant="auth"
                acceptedTerms={acceptedTerms}
                onAcceptedTermsChange={setAcceptedTerms}
                acceptedSpecial={acceptedSpecial}
                onAcceptedSpecialChange={setAcceptedSpecial}
                showSpecialCategory={role === 'client'}
              />
            </div>

            <button
              type="submit"
              className="auth-page__cta"
              disabled={loading || !acceptedTerms || (role === 'client' && !acceptedSpecial)}
            >
              {loading ? 'Регистрация…' : 'Зарегистрироваться'}
            </button>

            <div className="auth-page__footer-link">
              Уже есть аккаунт? <Link to="/login">Войти</Link>
            </div>
          </form>
        </>
      ) : (
        <>
          <h1 className="auth-page__h1">Подтвердите email</h1>
          <p className="auth-page__verify-lead">
            Мы отправили код на <strong>{email.trim().toLowerCase()}</strong>
          </p>

          {error ? <div className="auth-page__error">{error}</div> : null}

          <form onSubmit={handleVerifyEmail} style={{ marginTop: 4 }}>
            <div className="auth-page__section">
              <div className="auth-page__section-title">Код</div>
              <div className="auth-page__field">
                <label className="auth-page__label" htmlFor="reg-code">
                  6-значный код
                </label>
                <input
                  id="reg-code"
                  className="auth-page__input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(formatCodeInput(e.target.value))}
                  required
                  placeholder="123-456"
                  maxLength={7}
                  autoFocus
                />
              </div>
            </div>

            <button type="submit" className="auth-page__cta" disabled={loading}>
              {loading ? 'Проверяем…' : 'Подтвердить email'}
            </button>

            <div className="auth-page__link-row">
              <button
                type="button"
                className="auth-page__text-btn"
                disabled={loading || resendLeft > 0}
                onClick={() => void handleResendCode()}
              >
                {resendLeft > 0 ? `Отправить повторно (${resendLeft}с)` : 'Отправить повторно'}
              </button>
              <button
                type="button"
                className="auth-page__text-btn"
                disabled={loading}
                onClick={() => {
                  setPendingVerification(false);
                  setVerificationCode('');
                  setError(null);
                  setResendLeft(0);
                }}
              >
                Изменить почту
              </button>
            </div>
          </form>
        </>
      )}
    </AuthShell>
  );
}
