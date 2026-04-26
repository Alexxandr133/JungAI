import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function Login() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [verifyMode, setVerifyMode] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [showVerifyHint, setShowVerifyHint] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [selectedResetAccountId, setSelectedResetAccountId] = useState('');
  const [resetAccounts, setResetAccounts] = useState<Array<{ id: string; role: string; email: string; name?: string | null; createdAt: string }>>([]);
  const [forgotCode, setForgotCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'select' | 'code' | 'reset'>('request');

  function formatCodeInput(v: string): string {
    const digits = v.replace(/\D/g, '').slice(0, 6);
    if (digits.length <= 3) return digits;
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Логин: без учёта регистра; пробелы по краям не учитываем (email/логин).
    const usernameNormalized = username.trim().toLowerCase();
    // Пароль: регистр важен; ведущие пробелы не считаются частью пароля.
    const passwordNormalized = password.replace(/^\s+/, '');

    try {
      const result = await api<{ token: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: {
          username: usernameNormalized,
          password: passwordNormalized
        }
      });

      await loginWithToken(result.token);
      
      // Перенаправляем в зависимости от роли
      if (result.user.role === 'psychologist' || result.user.role === 'admin') {
        navigate('/psychologist');
      } else if (result.user.role === 'client') {
        navigate('/client');
      } else if (result.user.role === 'researcher') {
        navigate('/researcher');
      } else if (result.user.role === 'guest') {
        navigate('/guest');
      } else {
        navigate('/dashboard');
      }
    } catch (e: any) {
      const message = e.message || 'Неверный логин или пароль';
      setError(message);
      if (message.includes('Почта не подтверждена')) {
        setShowVerifyHint(true);
        setVerifyMode(true);
        setForgotMode(false);
        setVerifyEmail(usernameNormalized.includes('@') ? usernameNormalized : '');
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
          code: verifyCode.trim()
        }
      });
      await loginWithToken(result.token);
      if (result.user.role === 'psychologist' || result.user.role === 'admin') navigate('/psychologist');
      else if (result.user.role === 'client') navigate('/client');
      else if (result.user.role === 'researcher') navigate('/researcher');
      else if (result.user.role === 'guest') navigate('/guest');
      else navigate('/dashboard');
    } catch (e: any) {
      setError(e.message || 'Не удалось подтвердить email');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerifyCodeFromLogin() {
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
        body: { email }
      });
    } catch (e: any) {
      setError(e.message || 'Не удалось отправить код повторно');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPasswordRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ accounts?: Array<{ id: string; role: string; email: string; name?: string | null; createdAt: string }> }>('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: forgotEmail.trim().toLowerCase() }
      });
      const accounts = res.accounts || [];
      setResetAccounts(accounts);
      if (accounts.length === 0) {
        setError('Аккаунты для этого email не найдены');
        return;
      }
      setSelectedResetAccountId(accounts[0].id);
      setForgotStep('select');
    } catch (e: any) {
      setError(e.message || 'Не удалось отправить код');
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
          userId: selectedResetAccountId
        }
      });
      setForgotStep('code');
    } catch (e: any) {
      setError(e.message || 'Не удалось отправить код');
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
          newPassword
        }
      });
      setForgotMode(false);
      setForgotStep('request');
      setForgotCode('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (e: any) {
      setError(e.message || 'Не удалось сбросить пароль');
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
          code: forgotCode.trim()
        }
      });
      setForgotStep('reset');
    } catch (e: any) {
      setError(e.message || 'Неверный код');
    } finally {
      setLoading(false);
    }
  }


  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div className="card" style={{ width: 'min(480px, 94vw)', padding: 40, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Вход</h1>
          <div className="small" style={{ color: 'var(--text-muted)' }}>
            Войдите в свой аккаунт
          </div>
        </div>

        {error && (
          <div style={{ 
            padding: 12, 
            background: 'rgba(255, 107, 107, 0.1)', 
            border: '1px solid rgba(255, 107, 107, 0.3)', 
            borderRadius: 10, 
            color: '#ff6b6b',
            marginBottom: 20,
            fontSize: 14
          }}>
            {error}
            {showVerifyHint && !verifyMode && (
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setVerifyMode(true);
                    setForgotMode(false);
                  }}
                  style={{ padding: '8px 12px', fontSize: 13 }}
                >
                  Подтвердить email
                </button>
              </div>
            )}
          </div>
        )}

        {verifyMode ? (
          <form onSubmit={handleVerifyEmailFromLogin} style={{ display: 'grid', gap: 16 }}>
            <div className="small" style={{ color: 'var(--text-muted)' }}>
              Подтвердите почту, чтобы войти в аккаунт.
            </div>
            <input
              type="email"
              value={verifyEmail}
              onChange={e => setVerifyEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
            />
            <input
              type="text"
              value={verifyCode}
              onChange={e => setVerifyCode(formatCodeInput(e.target.value))}
              required
              maxLength={7}
              placeholder="123-456"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
            />
            <button type="submit" className="button" disabled={loading}>
              {loading ? 'Проверяем...' : 'Подтвердить email'}
            </button>
            <button type="button" className="button secondary" disabled={loading} onClick={handleResendVerifyCodeFromLogin}>
              Отправить код повторно
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setVerifyMode(false);
                setShowVerifyHint(false);
                setVerifyCode('');
                setError(null);
              }}
            >
              Вернуться ко входу
            </button>
          </form>
        ) : !forgotMode ? (
        <form onSubmit={handleLogin} style={{ display: 'grid', gap: 20 }}>
          <div>
            <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Логин
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              placeholder="Введите логин"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
            />
          </div>

          <div>
            <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Введите пароль"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
            />
          </div>

          <button
            type="submit"
            className="button"
            disabled={loading}
            style={{ padding: '14px 24px', fontSize: 16, fontWeight: 600, marginTop: 8 }}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <div className="small" style={{ marginBottom: 8, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="button secondary" onClick={() => setForgotMode(true)} style={{ padding: '8px 12px' }}>
                Забыли пароль?
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setVerifyMode(true);
                  setForgotMode(false);
                  setVerifyEmail(username.trim().toLowerCase());
                }}
                style={{ padding: '8px 12px' }}
              >
                Подтвердить email
              </button>
            </div>
            <div className="small" style={{ color: 'var(--text-muted)' }}>
              Нет аккаунта?{' '}
              <Link to="/register" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                Зарегистрироваться
              </Link>
            </div>
          </div>
        </form>
        ) : (
          <>
            {forgotStep === 'request' ? (
              <form onSubmit={handleForgotPasswordRequest} style={{ display: 'grid', gap: 16 }}>
                <div className="small" style={{ color: 'var(--text-muted)' }}>
                  Введите email, на него отправим код для сброса.
                </div>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
                />
                <button type="submit" className="button" disabled={loading}>
                  {loading ? 'Отправка...' : 'Отправить код'}
                </button>
              </form>
            ) : forgotStep === 'select' ? (
              <form onSubmit={handleSendResetCodeForSelectedAccount} style={{ display: 'grid', gap: 16 }}>
                <div className="small" style={{ color: 'var(--text-muted)' }}>
                  Выберите аккаунт, пароль которого хотите восстановить.
                </div>
                <select
                  value={selectedResetAccountId}
                  onChange={e => setSelectedResetAccountId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
                >
                  {resetAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name || 'Без имени'} · {acc.role} · {new Date(acc.createdAt).toLocaleDateString('ru-RU')}
                    </option>
                  ))}
                </select>
                <button type="submit" className="button" disabled={loading}>
                  {loading ? 'Отправка...' : 'Отправить код для выбранного аккаунта'}
                </button>
              </form>
            ) : forgotStep === 'code' ? (
              <form onSubmit={handleVerifyResetCode} style={{ display: 'grid', gap: 16 }}>
                <div className="small" style={{ color: 'var(--text-muted)' }}>
                  Введите код из письма в формате XXX-XXX.
                </div>
                <input
                  type="text"
                  value={forgotCode}
                  onChange={e => setForgotCode(formatCodeInput(e.target.value))}
                  required
                  placeholder="123-456"
                  maxLength={7}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
                />
                <button type="submit" className="button" disabled={loading}>
                  {loading ? 'Проверяем...' : 'Подтвердить код'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} style={{ display: 'grid', gap: 16 }}>
                <div className="small" style={{ color: 'var(--text-muted)' }}>
                  Задайте новый пароль.
                </div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Новый пароль"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
                />
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Подтвердите новый пароль"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
                />
                <button type="submit" className="button" disabled={loading}>
                  {loading ? 'Сохраняем...' : 'Сбросить пароль'}
                </button>
              </form>
            )}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setForgotMode(false);
                  setForgotStep('request');
                  setForgotEmail('');
                  setSelectedResetAccountId('');
                  setResetAccounts([]);
                  setForgotCode('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
              >
                Вернуться ко входу
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
