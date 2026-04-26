import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

function formatCodeInput(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function EmailVerificationLockModal() {
  const { user, loginWithToken, logout } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const shouldLock = useMemo(() => {
    if (!user) return false;
    return user.emailVerified === false;
  }, [user]);

  if (!shouldLock || !user?.email) return null;
  const email = user.email;

  async function verifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await api<{ token: string }>('/api/auth/verify-email', {
        method: 'POST',
        body: {
          email,
          code: code.trim()
        }
      });
      await loginWithToken(res.token);
      setCode('');
    } catch (e: any) {
      setError(e.message || 'Не удалось подтвердить email');
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await api('/api/auth/resend-verification', {
        method: 'POST',
        body: { email }
      });
      setMessage('Код отправлен повторно');
    } catch (e: any) {
      setError(e.message || 'Не удалось отправить код');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.82)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', zIndex: 5000 }}>
      <div className="card" style={{ width: 'min(520px, 94vw)', padding: 24, borderRadius: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Подтвердите email</h3>
        <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 14 }}>
          Вы вошли в аккаунт, но функции временно заблокированы до подтверждения почты <b>{email}</b>.
        </div>
        {message && <div className="card" style={{ padding: 10, marginBottom: 12, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)' }}>{message}</div>}
        {error && <div className="card" style={{ padding: 10, marginBottom: 12, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444' }}>{error}</div>}
        <form onSubmit={verifyEmail} style={{ display: 'grid', gap: 10 }}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(formatCodeInput(e.target.value))}
            required
            placeholder="123-456"
            maxLength={7}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="button secondary" type="button" onClick={resendCode} disabled={loading}>
              Отправить код повторно
            </button>
            <button className="button" type="submit" disabled={loading}>
              {loading ? 'Проверка...' : 'Подтвердить'}
            </button>
          </div>
        </form>
        <div style={{ marginTop: 12 }}>
          <button type="button" className="button secondary" onClick={logout} disabled={loading}>
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
}

