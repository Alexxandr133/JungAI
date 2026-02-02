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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const result = await api<{ token: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: {
          username,
          password
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
      setError(e.message || 'Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  }


  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div className="card" style={{ width: 'min(480px, 94vw)', padding: 40 }}>
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
          </div>
        )}

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
            <div className="small" style={{ color: 'var(--text-muted)' }}>
              Нет аккаунта?{' '}
              <Link to="/register" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                Зарегистрироваться
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
