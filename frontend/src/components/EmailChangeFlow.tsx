import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type Props = {
  forced?: boolean;
  initiallyOpen?: boolean;
};

function isMigrationEmail(email: string): boolean {
  const domain = String(email || '').trim().toLowerCase().split('@')[1] || '';
  return domain === 'jungai.local' || domain.endsWith('.jungai.local');
}

function formatCodeInput(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function EmailChangeFlow({ forced = false, initiallyOpen = false }: Props) {
  const { user, token, loginWithToken, logout } = useAuth();
  const [open, setOpen] = useState(Boolean(initiallyOpen));
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [nextEmail, setNextEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mustChangeEmail = useMemo(() => {
    if (!user?.email) return false;
    return isMigrationEmail(user.email);
  }, [user?.email]);

  const isOpen = forced ? mustChangeEmail : open;
  if (!user || !token || (forced && !mustChangeEmail)) return null;

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await api('/api/auth/change-email/request', {
        method: 'POST',
        token: token || undefined,
        body: { email: nextEmail.trim().toLowerCase() }
      });
      setStep('verify');
      setMessage('Код отправлен на новую почту');
    } catch (e: any) {
      setError(e.message || 'Не удалось отправить код');
    } finally {
      setLoading(false);
    }
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await api<{ ok: boolean; token: string }>('/api/auth/change-email/verify', {
        method: 'POST',
        token: token || undefined,
        body: { code: code.trim() }
      });
      await loginWithToken(res.token);
      setCode('');
      setNextEmail('');
      setStep('request');
      setMessage('Почта успешно обновлена');
      if (!forced) setOpen(false);
    } catch (e: any) {
      setError(e.message || 'Неверный код');
    } finally {
      setLoading(false);
    }
  }

  const card = (
    <div className="card" style={{ width: 'min(520px, 94vw)', padding: 24, borderRadius: 16 }}>
      <h3 style={{ margin: 0, marginBottom: 8, fontSize: 22 }}>
        {forced ? 'Нужно обновить email' : 'Изменение email'}
      </h3>
      <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        Текущая почта: <strong>{user.email}</strong>
      </div>
      {message && <div className="card" style={{ padding: 10, marginBottom: 12, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)' }}>{message}</div>}
      {error && <div className="card" style={{ padding: 10, marginBottom: 12, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444' }}>{error}</div>}

      {step === 'request' ? (
        <form onSubmit={sendCode} style={{ display: 'grid', gap: 12 }}>
          <input
            type="email"
            required
            value={nextEmail}
            onChange={e => setNextEmail(e.target.value)}
            placeholder="real@email.com"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
          />
          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Отправка...' : 'Отправить код'}
          </button>
        </form>
      ) : (
        <form onSubmit={confirmCode} style={{ display: 'grid', gap: 12 }}>
          <input
            type="text"
            required
            value={code}
            onChange={e => setCode(formatCodeInput(e.target.value))}
            placeholder="123-456"
            maxLength={7}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="button secondary" type="button" onClick={() => setStep('request')} disabled={loading}>
              Назад
            </button>
            <button className="button" type="submit" disabled={loading}>
              {loading ? 'Проверка...' : 'Подтвердить и сохранить'}
            </button>
          </div>
        </form>
      )}

      {!forced && (
        <div style={{ marginTop: 12 }}>
          <button className="button secondary" type="button" onClick={() => setOpen(false)} disabled={loading}>
            Закрыть
          </button>
        </div>
      )}
      {forced && (
        <div className="small" style={{ marginTop: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Для продолжения работы укажите реальную почту.</span>
          <button type="button" className="button secondary" onClick={logout} disabled={loading}>Выйти</button>
        </div>
      )}
    </div>
  );

  if (forced) {
    if (!isOpen) return null;
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.82)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', zIndex: 4000 }} onClick={e => e.stopPropagation()}>
        <div onClick={e => e.stopPropagation()}>{card}</div>
      </div>
    );
  }

  return (
    <>
      <button type="button" className="button secondary" onClick={() => setOpen(true)}>
        Изменить email
      </button>
      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.72)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 3000 }}>
          <div onClick={e => e.stopPropagation()}>{card}</div>
        </div>
      )}
    </>
  );
}

export function ForcedEmailMigrationModal() {
  return <EmailChangeFlow forced />;
}
