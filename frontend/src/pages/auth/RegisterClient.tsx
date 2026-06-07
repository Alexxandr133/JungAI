import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LegalRegistrationConsent } from '../../components/LegalRegistrationConsent';
import { api } from '../../lib/api';

export default function RegisterClient() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [clientInfo, setClientInfo] = useState<{ name?: string; email?: string } | null>(null);
  const [emailTakenHint, setEmailTakenHint] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedSpecial, setAcceptedSpecial] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Токен регистрации не найден');
      setChecking(false);
      return;
    }

    // Проверяем токен
    async function checkToken() {
      try {
        const result = await api<{
          valid: boolean;
          client?: { name?: string; email?: string };
          emailAlreadyRegistered?: boolean;
        }>(`/api/auth/check-registration-token/${token}`);
        if (result.valid && result.client) {
          setClientInfo(result.client);
          setName(result.client.name || '');
          setEmail(result.client.email || '');
          setEmailTakenHint(Boolean(result.emailAlreadyRegistered));
        }
      } catch (e: any) {
        setError(e.message || 'Недействительный или истекший токен регистрации');
      } finally {
        setChecking(false);
      }
    }

    checkToken();
  }, [token]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const emailNorm = String(email ?? '').trim().toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm);
    if (!emailOk) {
      setError('Укажите корректный email — он будет логином для входа');
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

    if (!token) {
      setError('Токен регистрации не найден');
      return;
    }

    setLoading(true);
    try {
      const result = await api<{ token?: string; user: any; client: any; requiresEmailVerification?: boolean }>(
        '/api/auth/register-client',
        {
          method: 'POST',
          body: {
            token,
            password,
            name: name || undefined,
            email: emailNorm,
            phone: phone || undefined,
            age: age || undefined,
            gender: gender || undefined
          }
        }
      );

      if (result.requiresEmailVerification) {
        setError('Требуется подтверждение email — проверьте почту');
        return;
      }
      if (!result.token) {
        setError('Не удалось получить сессию после регистрации');
        return;
      }
      await loginWithToken(result.token);
      navigate('/client/profile');
    } catch (e: any) {
      setError(e.message || 'Ошибка при регистрации');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="small" style={{ opacity: 0.7 }}>Проверка токена регистрации...</div>
        </div>
      </div>
    );
  }

  if (error && !clientInfo) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
        <div className="card" style={{ maxWidth: 500, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>Ошибка регистрации</h2>
          <div style={{ color: '#ff6b6b', marginBottom: 20 }}>{error}</div>
          <button className="button" onClick={() => navigate('/login')} style={{ padding: '10px 20px' }}>
            Перейти на страницу входа
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div className="card" style={{ width: 'min(500px, 94vw)', padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Регистрация</h1>
          <div className="small" style={{ color: 'var(--text-muted)' }}>
            Заполните данные для завершения регистрации
          </div>
        </div>

        {emailTakenHint && (
          <div
            style={{
              padding: 12,
              marginBottom: 16,
              borderRadius: 10,
              fontSize: 14,
              lineHeight: 1.45,
              background: 'rgba(250, 204, 21, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.45)',
              color: 'var(--text)'
            }}
          >
            На почту, которую указал психолог, уже зарегистрирован аккаунт. Укажите{' '}
            <strong>другой email</strong> в поле ниже или{' '}
            <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
              войдите
            </Link>
            , если это ваш профиль.
          </div>
        )}

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

        <form onSubmit={handleRegister} style={{ display: 'grid', gap: 16 }}>
          <div>
            <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Имя *</div>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
              placeholder="Ваше имя"
            />
          </div>

          <div>
            <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Email *</div>
            <input
              type="email"
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                setEmailTakenHint(false);
              }}
              required
              autoComplete="email"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
              placeholder="email@example.com"
            />
            <div className="small" style={{ marginTop: 6, color: 'var(--text-muted)' }}>
              По этому адресу клиент входит в аккаунт
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Телефон</div>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
                placeholder="+7 900 000-00-00"
              />
            </div>
            <div>
              <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Возраст</div>
              <input
                type="number"
                value={age}
                onChange={e => setAge(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
                placeholder="Возраст"
              />
            </div>
          </div>

          <div>
            <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Пол</div>
            <select
              value={gender}
              onChange={e => setGender(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              <option value="">Не указано</option>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </select>
          </div>

          <div>
            <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Пароль *</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
              placeholder="Минимум 6 символов"
            />
          </div>

          <div>
            <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Подтвердите пароль *</div>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
              placeholder="Повторите пароль"
            />
          </div>

          <LegalRegistrationConsent
            acceptedTerms={acceptedTerms}
            onAcceptedTermsChange={setAcceptedTerms}
            acceptedSpecial={acceptedSpecial}
            onAcceptedSpecialChange={setAcceptedSpecial}
            showSpecialCategory
          />

          <button
            type="submit"
            className="button"
            disabled={loading || !acceptedTerms || !acceptedSpecial}
            style={{ padding: '12px 24px', fontSize: 16, fontWeight: 600, marginTop: 8 }}
          >
            {loading ? 'Регистрация...' : 'Завершить регистрацию'}
          </button>
        </form>
      </div>
    </div>
  );
}
