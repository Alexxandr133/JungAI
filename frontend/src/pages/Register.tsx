import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeMenuButton } from '../components/ThemeMenuButton';
import { api } from '../lib/api';

export default function Register() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'psychologist' | 'researcher' | 'client'>('client');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

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

    setLoading(true);
    try {
      const result = await api<{ requiresEmailVerification?: boolean; email?: string }>('/api/auth/register', {
        method: 'POST',
        body: {
          email: emailNorm,
          name: name.trim() || undefined,
          password,
          role
        }
      });
      if (result.requiresEmailVerification) {
        setPendingVerification(true);
      } else {
        setError('Не удалось запустить подтверждение почты');
      }
    } catch (e: any) {
      setError(e.message || 'Ошибка при регистрации');
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
          code: verificationCode.trim()
        }
      });
      await loginWithToken(result.token);
      const pendingRaw = localStorage.getItem('pendingPsychologistContact');
      if (pendingRaw && result.user.role === 'client') {
        try {
          const pending = JSON.parse(pendingRaw) as { psychologistId: string; type: 'chat' | 'session'; message: string };
          const created = await api<{ chatRoomId?: string }>('/api/support/request', {
            method: 'POST',
            token: result.token,
            body: pending
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
      if (result.user.role === 'psychologist' || result.user.role === 'admin') navigate('/psychologist/profile');
      else if (result.user.role === 'researcher') navigate('/researcher/profile');
      else if (result.user.role === 'client') navigate('/client');
      else navigate('/dashboard');
    } catch (e: any) {
      setError(e.message || 'Не удалось подтвердить email');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setError(null);
    setLoading(true);
    try {
      await api('/api/auth/resend-verification', {
        method: 'POST',
        body: { email: email.trim().toLowerCase() }
      });
    } catch (e: any) {
      setError(e.message || 'Не удалось отправить код повторно');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div className="card" style={{ width: 'min(480px, 94vw)', padding: 40, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <ThemeMenuButton />
        </div>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Регистрация</h1>
          <div className="small" style={{ color: 'var(--text-muted)' }}>
            Создайте аккаунт для работы с платформой
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
          </div>
        )}

        {!pendingVerification ? (
        <form onSubmit={handleRegister} style={{ display: 'grid', gap: 20 }}>
          <div>
            <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Роль *
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'psychologist' | 'researcher' | 'client')}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
            >
              <option value="client">Клиент</option>
              <option value="psychologist">Психолог</option>
              <option value="researcher">Исследователь</option>
            </select>
          </div>

          <div>
            <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Имя
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Как к вам обращаться"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
            />
          </div>

          <div>
            <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
            />
            <div className="small" style={{ marginTop: 6, color: 'var(--text-muted)' }}>
              На эту почту придёт код подтверждения
            </div>
          </div>

          <div>
            <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Пароль *
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Введите пароль"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
            />
            <div className="small" style={{ marginTop: 6, color: 'var(--text-muted)' }}>
              Минимум 6 символов
            </div>
          </div>

          <div>
            <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Подтвердите пароль *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Повторите пароль"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
            />
          </div>

          <button
            type="submit"
            className="button"
            disabled={loading}
            style={{ padding: '14px 24px', fontSize: 16, fontWeight: 600, marginTop: 8 }}
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <div className="small" style={{ color: 'var(--text-muted)' }}>
              Уже есть аккаунт?{' '}
              <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                Войти
              </Link>
            </div>
          </div>
        </form>
        ) : (
          <form onSubmit={handleVerifyEmail} style={{ display: 'grid', gap: 20 }}>
            <div className="small" style={{ color: 'var(--text-muted)' }}>
              Мы отправили код подтверждения на ` {email.trim().toLowerCase()} `
            </div>
            <div>
              <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
                Код подтверждения
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={e => setVerificationCode(formatCodeInput(e.target.value))}
                required
                placeholder="123-456"
                maxLength={7}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
              />
            </div>
            <button type="submit" className="button" disabled={loading} style={{ padding: '14px 24px', fontSize: 16, fontWeight: 600 }}>
              {loading ? 'Проверяем...' : 'Подтвердить email'}
            </button>
            <button type="button" className="button secondary" disabled={loading} onClick={handleResendCode}>
              Отправить код повторно
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
