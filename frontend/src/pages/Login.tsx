import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../components/auth/AuthShell';
import { api } from '../lib/api';

function homePathForRole(role: string | undefined) {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'psychologist':
      return '/psychologist';
    case 'client':
      return '/client';
    case 'researcher':
      return '/researcher';
    case 'guest':
      return '/guest';
    default:
      return '/dashboard';
  }
}

export default function Login() {
  const { loginWithToken, user, token, authReady } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [verifyMode, setVerifyMode] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [showVerifyHint, setShowVerifyHint] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [selectedResetAccountId, setSelectedResetAccountId] = useState('');
  const [resetAccounts, setResetAccounts] = useState<
    Array<{ id: string; role: string; email: string; name?: string | null; createdAt: string }>
  >([]);
  const [forgotCode, setForgotCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'select' | 'code' | 'reset'>('request');
  const [resendLeft, setResendLeft] = useState(0);

  useEffect(() => {
    if (!authReady) return;
    if (token && user) {
      navigate(homePathForRole(user.role), { replace: true });
    }
  }, [authReady, token, user, navigate]);

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

  function goHome(role: string) {
    navigate(homePathForRole(role));
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const usernameNormalized = username.trim().toLowerCase();
    const passwordNormalized = password.replace(/^\s+/, '');

    try {
      const result = await api<{ token: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: {
          username: usernameNormalized,
          password: passwordNormalized,
        },
      });

      await loginWithToken(result.token);
      goHome(result.user.role);
    } catch (err: any) {
      const message = err.message || 'Неверный логин или пароль';
      setError(message);
      if (message.includes('Почта не подтверждена')) {
        setShowVerifyHint(true);
        setVerifyMode(true);
        setForgotMode(false);
        setVerifyEmail(usernameNormalized.includes('@') ? usernameNormalized : '');
        setResendLeft(60);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmailFromLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const email = verifyEmail.trim().toLowerCase();
    if (!email) {
      setError('Укажите email для подтверждения');
      return;
    }
    setLoading(true);
    try {
      const result = await api<{ token: string; user: any }>('/api/auth/verify-email', {
        method: 'POST',
        body: {
          email,
          code: verifyCode.trim(),
        },
      });
      await loginWithToken(result.token);
      goHome(result.user.role);
    } catch (err: any) {
      setError(err.message || 'Не удалось подтвердить email');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerifyCodeFromLogin() {
    if (resendLeft > 0) return;
    setError(null);
    const email = verifyEmail.trim().toLowerCase();
    if (!email) {
      setError('Укажите email для повторной отправки кода');
      return;
    }
    setLoading(true);
    try {
      await api('/api/auth/resend-verification', {
        method: 'POST',
        body: { email },
      });
      setResendLeft(60);
    } catch (err: any) {
      setError(err.message || 'Не удалось отправить код повторно');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPasswordRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{
        accounts?: Array<{ id: string; role: string; email: string; name?: string | null; createdAt: string }>;
      }>('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: forgotEmail.trim().toLowerCase() },
      });
      const accounts = res.accounts || [];
      setResetAccounts(accounts);
      if (accounts.length === 0) {
        setError('Аккаунты для этого email не найдены');
        return;
      }
      setSelectedResetAccountId(accounts[0].id);
      setForgotStep('select');
    } catch (err: any) {
      setError(err.message || 'Не удалось отправить код');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendResetCodeForSelectedAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedResetAccountId) {
      setError('Выберите аккаунт');
      return;
    }
    setLoading(true);
    try {
      await api('/api/auth/forgot-password', {
        method: 'POST',
        body: {
          email: forgotEmail.trim().toLowerCase(),
          userId: selectedResetAccountId,
        },
      });
      setForgotStep('code');
      setResendLeft(60);
    } catch (err: any) {
      setError(err.message || 'Не удалось отправить код');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError('Новый пароль должен содержать минимум 6 символов');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: {
          email: forgotEmail.trim().toLowerCase(),
          userId: selectedResetAccountId,
          code: forgotCode.trim(),
          newPassword,
        },
      });
      setForgotMode(false);
      setForgotStep('request');
      setForgotCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Не удалось сбросить пароль');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyResetCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api('/api/auth/verify-reset-code', {
        method: 'POST',
        body: {
          email: forgotEmail.trim().toLowerCase(),
          userId: selectedResetAccountId,
          code: forgotCode.trim(),
        },
      });
      setForgotStep('reset');
    } catch (err: any) {
      setError(err.message || 'Неверный код');
    } finally {
      setLoading(false);
    }
  }

  function resetForgot() {
    setForgotMode(false);
    setForgotStep('request');
    setForgotEmail('');
    setSelectedResetAccountId('');
    setResetAccounts([]);
    setForgotCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setError(null);
  }

  const title = verifyMode
    ? 'Подтвердите email'
    : forgotMode
      ? 'Сброс пароля'
      : 'Вход';
  const sub = verifyMode
    ? 'Введите код из письма, чтобы войти'
    : forgotMode
      ? 'Восстановим доступ к аккаунту'
      : 'Войдите в свой аккаунт JungAI';

  return (
    <AuthShell mode="login" role="client">
      <h1 className="auth-page__h1">{title}</h1>
      <p className="auth-page__sub">{sub}</p>

      {error ? (
        <div className="auth-page__error">
          {error}
          {showVerifyHint && !verifyMode ? (
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="auth-page__text-btn"
                onClick={() => {
                  setVerifyMode(true);
                  setForgotMode(false);
                  setResendLeft(60);
                }}
              >
                Подтвердить email
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {verifyMode ? (
        <form onSubmit={handleVerifyEmailFromLogin} style={{ marginTop: 8 }}>
          <div className="auth-page__section">
            <div className="auth-page__section-title">Код</div>
            <div className="auth-page__field">
              <label className="auth-page__label" htmlFor="login-verify-email">
                Email
              </label>
              <input
                id="login-verify-email"
                className="auth-page__input"
                type="email"
                autoComplete="email"
                value={verifyEmail}
                onChange={(e) => setVerifyEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="auth-page__field">
              <label className="auth-page__label" htmlFor="login-verify-code">
                6-значный код
              </label>
              <input
                id="login-verify-code"
                className="auth-page__input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(formatCodeInput(e.target.value))}
                required
                maxLength={7}
                placeholder="123-456"
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
              onClick={() => void handleResendVerifyCodeFromLogin()}
            >
              {resendLeft > 0 ? `Отправить повторно (${resendLeft}с)` : 'Отправить повторно'}
            </button>
            <button
              type="button"
              className="auth-page__text-btn"
              onClick={() => {
                setVerifyMode(false);
                setShowVerifyHint(false);
                setVerifyCode('');
                setError(null);
                setResendLeft(0);
              }}
            >
              Вернуться ко входу
            </button>
          </div>
        </form>
      ) : !forgotMode ? (
        <form onSubmit={handleLogin}>
          <div className="auth-page__section">
            <div className="auth-page__section-title">Аккаунт</div>
            <div className="auth-page__field">
              <label className="auth-page__label" htmlFor="login-username">
                Email или логин
              </label>
              <input
                id="login-username"
                className="auth-page__input"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="auth-page__field">
              <label className="auth-page__label" htmlFor="login-password">
                Пароль
              </label>
              <div className="auth-page__input-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Введите пароль"
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
          </div>

          <button type="submit" className="auth-page__cta" disabled={loading}>
            {loading ? 'Вход…' : 'Войти'}
          </button>

          <div className="auth-page__link-row">
            <button
              type="button"
              className="auth-page__text-btn"
              onClick={() => {
                setForgotMode(true);
                setVerifyMode(false);
                setError(null);
              }}
            >
              Забыли пароль?
            </button>
            <button
              type="button"
              className="auth-page__text-btn"
              onClick={() => {
                setVerifyMode(true);
                setForgotMode(false);
                setVerifyEmail(username.trim().toLowerCase());
                setResendLeft(0);
              }}
            >
              Подтвердить email
            </button>
          </div>

          <div className="auth-page__footer-link">
            Нет аккаунта? <Link to="/register">Регистрация</Link>
          </div>
        </form>
      ) : (
        <>
          {forgotStep === 'request' ? (
            <form onSubmit={handleForgotPasswordRequest}>
              <div className="auth-page__section">
                <div className="auth-page__section-title">Email</div>
                <p className="auth-page__hint" style={{ marginBottom: 12 }}>
                  Введите email — отправим код для сброса пароля.
                </p>
                <div className="auth-page__field">
                  <input
                    className="auth-page__input"
                    type="email"
                    autoComplete="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <button type="submit" className="auth-page__cta" disabled={loading}>
                {loading ? 'Отправка…' : 'Продолжить'}
              </button>
            </form>
          ) : forgotStep === 'select' ? (
            <form onSubmit={handleSendResetCodeForSelectedAccount}>
              <div className="auth-page__section">
                <div className="auth-page__section-title">Аккаунт</div>
                <p className="auth-page__hint" style={{ marginBottom: 12 }}>
                  Выберите аккаунт, пароль которого хотите восстановить.
                </p>
                <div className="auth-page__roles">
                  {resetAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      className={`auth-page__role${selectedResetAccountId === acc.id ? ' is-selected' : ''}`}
                      onClick={() => setSelectedResetAccountId(acc.id)}
                    >
                      <span className="auth-page__role-icon" aria-hidden>
                        ·
                      </span>
                      <span>
                        <span className="auth-page__role-name">{acc.name || 'Без имени'}</span>
                        <span className="auth-page__role-desc">
                          {acc.role} · {new Date(acc.createdAt).toLocaleDateString('ru-RU')}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" className="auth-page__cta" disabled={loading}>
                {loading ? 'Отправка…' : 'Отправить код'}
              </button>
            </form>
          ) : forgotStep === 'code' ? (
            <form onSubmit={handleVerifyResetCode}>
              <div className="auth-page__section">
                <div className="auth-page__section-title">Код</div>
                <div className="auth-page__field">
                  <label className="auth-page__label" htmlFor="login-reset-code">
                    Код из письма
                  </label>
                  <input
                    id="login-reset-code"
                    className="auth-page__input"
                    type="text"
                    inputMode="numeric"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(formatCodeInput(e.target.value))}
                    required
                    placeholder="123-456"
                    maxLength={7}
                  />
                </div>
              </div>
              <button type="submit" className="auth-page__cta" disabled={loading}>
                {loading ? 'Проверяем…' : 'Подтвердить код'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              <div className="auth-page__section">
                <div className="auth-page__section-title">Новый пароль</div>
                <div className="auth-page__field">
                  <label className="auth-page__label" htmlFor="login-new-pass">
                    Пароль
                  </label>
                  <div className="auth-page__input-wrap">
                    <input
                      id="login-new-pass"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Новый пароль"
                    />
                    <button
                      type="button"
                      className="auth-page__eye"
                      aria-label={showNewPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      onClick={() => setShowNewPassword((v) => !v)}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="auth-page__field">
                  <label className="auth-page__label" htmlFor="login-new-pass2">
                    Подтверждение
                  </label>
                  <input
                    id="login-new-pass2"
                    className="auth-page__input"
                    type="password"
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Повторите пароль"
                  />
                </div>
              </div>
              <button type="submit" className="auth-page__cta" disabled={loading}>
                {loading ? 'Сохраняем…' : 'Сбросить пароль'}
              </button>
            </form>
          )}
          <div className="auth-page__link-row">
            <button type="button" className="auth-page__text-btn" onClick={resetForgot}>
              Вернуться ко входу
            </button>
          </div>
        </>
      )}
    </AuthShell>
  );
}
