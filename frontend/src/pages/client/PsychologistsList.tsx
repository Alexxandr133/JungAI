import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LANDING_TOPIC_TAGS, PROFILE_TAGS, searchProfileTags } from 'jungai-shared';
import { useAuth } from '../../context/AuthContext';
import { useMessengerUi } from '../../context/MessengerUiContext';
import { api, resolvePublicFileUrl } from '../../lib/api';
import { yearsWord } from '../../lib/ruPlural';
import { ClientNavbar } from '../../components/ClientNavbar';
import { PsychologistMiniCard } from '../../components/PsychologistMiniCard';
import '../../styles/landing-tokens.css';
import '../psychologists/Catalog.css';
import './PsychologistsList.css';

type CatalogItem = {
  id: string;
  name: string;
  email?: string;
  bio?: string | null;
  therapyMethod?: string | null;
  specialization?: string | string[];
  worksWith?: string[];
  audienceFormats?: string[];
  experience?: number;
  avatarUrl?: string | null;
  sessionPriceRub?: number | null;
  nearestSlot?: { slotStart: string } | null;
  verified?: boolean;
  rating?: number | null;
  reviewsCount?: number | null;
};

const PRICE_OPTIONS = [
  { id: '', label: 'Любая стоимость' },
  { id: 'budget', label: 'до 3 500 ₽', min: 0, max: 3500 },
  { id: 'mid', label: '3 500 – 5 500 ₽', min: 3500, max: 5500 },
  { id: 'premium', label: 'от 5 500 ₽', min: 5500, max: null as number | null },
];

const FORMAT_OPTIONS = [
  { id: '', label: 'Любой формат' },
  { id: 'self', label: 'Индивидуально' },
  { id: 'couple', label: 'С парами' },
  { id: 'child', label: 'С детьми' },
];

const FILTER_TAGS = LANDING_TOPIC_TAGS.length ? LANDING_TOPIC_TAGS : PROFILE_TAGS.slice(0, 12);

function asSpecList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

export default function ClientPsychologistsList() {
  const { token } = useAuth();
  const { openMessenger } = useMessengerUi();
  const navigate = useNavigate();
  const location = useLocation();

  const [myPsychologist, setMyPsychologist] = useState<CatalogItem | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [format, setFormat] = useState('');
  const [price, setPrice] = useState('');
  const [tagSearch, setTagSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        let mine: CatalogItem | null = null;
        try {
          const myPsych = await api<CatalogItem>('/api/clients/my-psychologist', {
            token: token ?? undefined,
          });
          if (myPsych?.id) {
            mine = {
              ...myPsych,
              specialization: asSpecList(myPsych.specialization),
              verified: true,
            };
          }
        } catch (e: unknown) {
          const err = e as { status?: number; code?: string; message?: string };
          const noPsych =
            err?.status === 404 ||
            err?.code === 'NO_PSYCHOLOGIST' ||
            String(err?.message || '')
              .toLowerCase()
              .includes('not selected');
          if (!noPsych) console.error('Failed to load attached psychologist:', e);
        }

        const res = await api<{ psychologists: CatalogItem[] }>('/api/psychologists/public', {
          token: token ?? undefined,
        }).catch(() => ({ psychologists: [] as CatalogItem[] }));

        if (cancelled) return;
        setMyPsychologist(mine);
        setItems(res.psychologists || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (location.hash !== '#catalog') return;
    const el = document.getElementById('catalog');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, loading]);

  const tagFilterChips = useMemo(() => {
    const q = tagSearch.trim();
    if (q) return searchProfileTags(q, 12);
    return FILTER_TAGS as readonly string[];
  }, [tagSearch]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const band = PRICE_OPTIONS.find((p) => p.id === price);
    return items.filter((p) => {
      if (myPsychologist && p.id === myPsychologist.id) return false;
      if (q) {
        const specs = asSpecList(p.specialization);
        const hay = `${p.name} ${p.bio || ''} ${p.therapyMethod || ''} ${specs.join(' ')} ${(p.worksWith || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (tag) {
        const tags = (p.worksWith || []).map((t) => t.toLowerCase());
        const t = tag.toLowerCase();
        if (!tags.some((w) => w === t || w.includes(t) || t.includes(w))) return false;
      }
      if (format) {
        const formats = p.audienceFormats || [];
        if (!formats.includes(format)) return false;
      }
      if (band && band.id) {
        const pr = p.sessionPriceRub;
        if (pr == null) return false;
        if (band.min != null && pr < band.min) return false;
        if (band.max != null && pr > band.max) return false;
      }
      return true;
    });
  }, [items, search, tag, format, price, myPsychologist]);

  const filtersActive = Boolean(search || tag || format || price);
  const avatarSrc = resolvePublicFileUrl(myPsychologist?.avatarUrl || null);

  async function writeTo(psychId: string) {
    if (!token) return;
    try {
      const created = await api<{ chatRoomId?: string }>('/api/support/request', {
        method: 'POST',
        token,
        body: {
          psychologistId: psychId,
          type: 'chat',
          message: 'Здравствуйте! Хочу связаться через каталог JungAI.',
          allowWorkAreaAccess: false,
        },
      });
      if (created?.chatRoomId) {
        openMessenger({ roomId: created.chatRoomId });
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Не удалось написать специалисту');
    }
  }

  return (
    <div className="client-psych">
      <ClientNavbar />
      <main className="client-psych__main">
        <header className="client-psych__head">
          <div>
            <p className="client-psych__eyebrow">Работа с специалистом</p>
            <h1 className="client-psych__h1">Мой психолог</h1>
            <p className="client-psych__lead">
              {myPsychologist
                ? 'Текущий специалист и каталог — можно посмотреть других или записаться заново.'
                : 'Выберите специалиста из каталога или пройдите короткий подбор.'}
            </p>
          </div>
          {!myPsychologist ? (
            <Link to="/client/match" className="button">
              Подобрать по анкете
            </Link>
          ) : null}
        </header>

        {loading ? (
          <p className="client-psych__status">Загрузка…</p>
        ) : (
          <>
            {myPsychologist ? (
              <section className="client-psych__mine" aria-labelledby="my-psych-title">
                <p className="client-psych__section-label">Сейчас с вами</p>
                <div className="client-psych__mine-card">
                  <button
                    type="button"
                    className="client-psych__mine-avatar"
                    onClick={() => navigate(`/psychologists/${myPsychologist.id}`)}
                    aria-label={`Профиль ${myPsychologist.name}`}
                  >
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" />
                    ) : (
                      <span>
                        {myPsychologist.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </span>
                    )}
                  </button>
                  <div className="client-psych__mine-body">
                    <div className="client-psych__mine-title-row">
                      <h2 id="my-psych-title">{myPsychologist.name}</h2>
                      <span className="client-psych__badge">Ваш психолог</span>
                    </div>
                    {myPsychologist.experience != null ? (
                      <p className="client-psych__meta">
                        Опыт: {myPsychologist.experience} {yearsWord(myPsychologist.experience)}
                      </p>
                    ) : null}
                    {myPsychologist.bio ? <p className="client-psych__bio">{myPsychologist.bio}</p> : null}
                    <div className="client-psych__mine-actions">
                      <Link to={`/psychologists/${myPsychologist.id}`} className="button">
                        Открыть профиль
                      </Link>
                      <button type="button" className="button secondary" onClick={() => void writeTo(myPsychologist.id)}>
                        Написать
                      </button>
                      <Link to="/client/sessions" className="button secondary">
                        Сессии
                      </Link>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="client-psych__empty-mine">
                <h2>Психолог ещё не выбран</h2>
                <p>Можно пройти анкету или выбрать специалиста в каталоге ниже.</p>
                <Link to="/client/match" className="button">
                  Подобрать по анкете
                </Link>
              </section>
            )}

            <section id="catalog" className="client-psych__catalog landing psy-catalog-page">
              <div className="psy-catalog" style={{ padding: 0, maxWidth: 'none' }}>
                <header className="client-psych__catalog-head">
                  <h2 className="client-psych__h2">Каталог</h2>
                  <p className="client-psych__lead">
                    {items.length ? `${items.length} специалистов` : 'Каталог загружается…'}
                  </p>
                </header>

                <div className="psy-catalog__toolbar">
                  <input
                    className="psy-catalog__search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск по имени, методу, теме…"
                    type="search"
                  />
                  <div className="psy-catalog__selects">
                    <select
                      className="psy-catalog__select"
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      aria-label="Формат"
                    >
                      {FORMAT_OPTIONS.map((o) => (
                        <option key={o.id || 'any'} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="psy-catalog__select"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      aria-label="Стоимость"
                    >
                      {PRICE_OPTIONS.map((o) => (
                        <option key={o.id || 'any'} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="psy-catalog__tags-wrap">
                  <input
                    className="psy-catalog__tag-search"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Найти тему…"
                    aria-label="Поиск темы"
                  />
                  <div className="psy-catalog__tags" role="list">
                    {tagFilterChips.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="listitem"
                        className={`psy-catalog__tag${tag === t ? ' is-on' : ''}`}
                        onClick={() => setTag((prev) => (prev === t ? null : t))}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {filtersActive ? (
                  <button
                    type="button"
                    className="landing-btn landing-btn--ghost psy-catalog__reset"
                    onClick={() => {
                      setSearch('');
                      setTag(null);
                      setFormat('');
                      setPrice('');
                      setTagSearch('');
                    }}
                  >
                    Сбросить фильтры
                  </button>
                ) : null}

                {filtered.length === 0 ? (
                  <p className="client-psych__status">Никого не нашли — сбросьте фильтры или измените запрос.</p>
                ) : (
                  <div className="psy-catalog__grid">
                    {filtered.map((p) => (
                      <PsychologistMiniCard
                        key={p.id}
                        data={{
                          ...p,
                          specialization: asSpecList(p.specialization),
                        }}
                        profileTo={`/psychologists/${p.id}`}
                        showWrite
                        onWrite={() => void writeTo(p.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
