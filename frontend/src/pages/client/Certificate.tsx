import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ClientNavbar } from '../../components/ClientNavbar';
import './Certificate.css';

const GIFT_MESSAGE =
  'бесплатная сессия для близкого человека. Мы подберём психолога исходя из запроса.';

export default function ClientCertificate() {
  const { token, user } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await api('/api/client/certificate-request', {
        token,
        method: 'POST',
        body: { email, message: GIFT_MESSAGE },
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Не удалось отправить заявку');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="client-cert-shell">
      <ClientNavbar />
      <main className="client-cert-stage">
        <div className="client-cert-stage__glow" aria-hidden />
        <div className="client-cert-layout">
          <aside className="client-cert-visual">
            <div className="client-cert-card" aria-hidden>
              <div className="client-cert-card__seal">Бесплатно</div>
              <div className="client-cert-card__label">Подарочный сертификат</div>
              <div className="client-cert-card__title">1 сессия близкому</div>
              <p className="client-cert-card__text">
                Подарок на одну бесплатную сессию. Мы подберём психолога под запрос.
              </p>
              <div className="client-cert-card__foil" />
            </div>
          </aside>

          <section className="client-cert-form-wrap">
            <h1>Подарочный сертификат</h1>
            <p className="client-cert-lead">
              Подарок — 1 бесплатная сессия для близкого человека. Дальше мы подберём психолога исходя из
              запроса.
            </p>

            <form className="client-cert-form" onSubmit={onSubmit}>
              {done ? (
                <div className="client-cert-ok">
                  <strong>Заявка отправлена</strong>
                  <span>Мы напишем на указанный email и на почту команды JungAI.</span>
                  <Link to="/client" className="button" style={{ marginTop: 16, alignSelf: 'flex-start' }}>
                    На главную
                  </Link>
                </div>
              ) : (
                <>
                  <div className="client-cert-gift">
                    <div className="client-cert-gift__label">Что входит в подарок</div>
                    <p>{GIFT_MESSAGE}</p>
                  </div>
                  <label>
                    Email для связи
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </label>
                  {error && <div className="client-cert-error">{error}</div>}
                  <button type="submit" className="button client-cert-submit" disabled={loading}>
                    {loading ? 'Отправляем…' : 'Отправить заявку'}
                  </button>
                </>
              )}
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
