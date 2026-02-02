import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function Register() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'psychologist' | 'researcher' | 'client'>('client');

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username || username.length < 3) {
      setError('Логин должен содержать минимум 3 символа');
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
      const result = await api<{ token: string; user: any }>('/api/auth/register', {
        method: 'POST',
        body: {
          username,
          password,
          role
        }
      });

      await loginWithToken(result.token);
      
      // Перенаправляем в зависимости от роли
      if (role === 'psychologist') {
        navigate('/psychologist/profile');
      } else if (role === 'researcher') {
        navigate('/researcher/profile');
      } else if (role === 'client') {
        navigate('/client');
      } else {
        navigate('/dashboard');
      }
    } catch (e: any) {
      setError(e.message || 'Ошибка при регистрации');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div className="card" style={{ width: 'min(480px, 94vw)', padding: 40 }}>
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
              Логин *
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              minLength={3}
              placeholder="Введите логин"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}
            />
            <div className="small" style={{ marginTop: 6, color: 'var(--text-muted)' }}>
              Минимум 3 символа
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
      </div>
    </div>
  );
}
