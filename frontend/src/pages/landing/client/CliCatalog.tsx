import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api';
import './CliCatalog.css';

type Psychologist = {
  id: string;
  name: string;
  bio?: string | null;
  specialization?: string[];
  avatarUrl?: string | null;
  verified?: boolean;
};

type CliCatalogProps = {
  requestFilter: string | null;
};

function matchesRequest(p: Psychologist, request: string | null): boolean {
  if (!request) return true;
  const hay = `${(p.specialization || []).join(' ')} ${p.bio || ''} ${p.name}`.toLowerCase();
  const tokens = request.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
  if (!tokens.length) return hay.includes(request.toLowerCase());
  return tokens.some((t) => hay.includes(t));
}

export function CliCatalog({ requestFilter }: CliCatalogProps) {
  const [items, setItems] = useState<Psychologist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ psychologists: Psychologist[] }>('/api/psychologists/public');
        if (!cancelled) setItems(res.psychologists || []);
      } catch (e) {
        console.error('Failed to load psychologists', e);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const filtered = items.filter((p) => matchesRequest(p, requestFilter));
    const list = filtered.length ? filtered : items;
    return list.slice(0, 6);
  }, [items, requestFilter]);

  return (
    <section id="catalog" className="cli-catalog" aria-labelledby="cli-catalog-heading">
      <div className="landing-container">
        <h2 id="cli-catalog-heading" className="landing-h2 cli-catalog__title">
          Подберём специалиста под ваш запрос
        </h2>
        <p className="landing-lead cli-catalog__sub">
          Короткая анкета: для кого нужна встреча, с какой проблемой обращаетесь, удобное время и бюджет.
          Покажем несколько подходящих психологов — дальше можно открыть профиль и записаться на слот.
        </p>
        <div className="cli-catalog__match-cta">
          <Link to="/match" className="landing-btn landing-btn--primary">
            Подобрать специалиста
          </Link>
        </div>

        {loading ? (
          <p className="landing-small" style={{ textAlign: 'center' }}>
            Загрузка…
          </p>
        ) : visible.length === 0 ? (
          <p className="landing-body" style={{ textAlign: 'center' }}>
            Сейчас в каталоге нет специалистов. Загляните позже или напишите нам.
          </p>
        ) : (
          <div className="cli-catalog__grid">
            {visible.map((p) => {
              const method = p.specialization?.[0] || 'Аналитическая психология';
              const approach = (p.bio || '').trim().slice(0, 120);
              return (
                <article key={p.id} className="landing-card cli-catalog__card">
                  <div className="cli-catalog__avatar-wrap">
                    {p.avatarUrl ? (
                      <img
                        className="cli-catalog__avatar"
                        src={p.avatarUrl}
                        alt=""
                        width={72}
                        height={72}
                        loading="lazy"
                      />
                    ) : (
                      <div className="cli-catalog__avatar cli-catalog__avatar--placeholder" aria-hidden>
                        {(p.name || '?').charAt(0)}
                      </div>
                    )}
                  </div>
                  <h3 className="landing-h3 cli-catalog__name">{p.name}</h3>
                  <p className="cli-catalog__method">{method}</p>
                  {approach ? (
                    <p className="landing-small cli-catalog__approach">
                      {approach}
                      {(p.bio || '').length > 120 ? '…' : ''}
                    </p>
                  ) : null}
                  <p className="landing-small cli-catalog__price">Стоимость сессии — в профиле до записи</p>
                  <Link to={`/psychologists/${p.id}`} className="landing-btn landing-btn--primary cli-catalog__cta">
                    Записаться
                  </Link>
                </article>
              );
            })}
          </div>
        )}

        <div className="cli-catalog__footer">
          <Link to="/psychologists" className="landing-btn landing-btn--tertiary">
            Смотреть всех специалистов →
          </Link>
        </div>
      </div>
    </section>
  );
}
