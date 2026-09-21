import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LANDING_TOPIC_TAGS, PROFILE_TAGS, searchProfileTags } from 'jungai-shared';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { LandingNavbar } from '../../components/landing/LandingNavbar';
import { LandingFooter } from '../../components/landing/LandingFooter';
import { PsychologistMiniCard } from '../../components/PsychologistMiniCard';
import { usePageMeta } from '../../hooks/usePageMeta';
import { SEO_PAGES } from '../../content/seoPages';
import '../../styles/landing-tokens.css';
import './Catalog.css';

type CatalogItem = {
  id: string;
  name: string;
  bio?: string | null;
  therapyMethod?: string | null;
  specialization?: string[];
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

export default function PsychologistsCatalog() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [format, setFormat] = useState('');
  const [price, setPrice] = useState('');
  const [tagSearch, setTagSearch] = useState('');

  usePageMeta({
    title: SEO_PAGES['/psychologists'].title,
    description: SEO_PAGES['/psychologists'].description,
    path: '/psychologists',
  });

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const res = await api<{ psychologists: CatalogItem[]; total?: number }>(
          '/api/psychologists/public',
          { token: token ?? undefined }
        );
        setItems(res.psychologists || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const tagFilterChips = useMemo(() => {
    const q = tagSearch.trim();
    if (q) return searchProfileTags(q, 12);
    return FILTER_TAGS as readonly string[];
  }, [tagSearch]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const band = PRICE_OPTIONS.find((p) => p.id === price);
    return items.filter((p) => {
      if (q) {
        const hay = `${p.name} ${p.bio || ''} ${p.therapyMethod || ''} ${(p.specialization || []).join(' ')} ${(p.worksWith || []).join(' ')}`.toLowerCase();
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
  }, [items, search, tag, format, price]);

  const filtersActive = Boolean(search || tag || format || price);

  async function writeTo(psychId: string) {
    if (!token || user?.role !== 'client') return;
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
        navigate(`/chat?roomId=${encodeURIComponent(created.chatRoomId)}`);
      } else {
        navigate('/chat');
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Не удалось написать специалисту');
    }
  }

  return (
    <div className="landing psy-catalog-page">
      <LandingNavbar variant="catalog" />
      <main className="landing-container psy-catalog">
        <header className="psy-catalog__head">
          <h1 className="landing-h1">Психологи</h1>
          <p className="landing-lead">
            {loading ? 'Загрузка…' : `${items.length} верифицированных специалистов`}
          </p>
          <Link to="/match" className="landing-btn landing-btn--primary" style={{ marginTop: 16 }}>
            Подобрать по анкете
          </Link>
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

        {loading ? (
          <p className="landing-body">Загрузка каталога…</p>
        ) : filtered.length === 0 ? (
          <div className="landing-card" style={{ padding: 24 }}>
            <p className="landing-body">Никого не нашли по фильтрам.</p>
            <button
              type="button"
              className="landing-btn landing-btn--primary"
              style={{ marginTop: 12 }}
              onClick={() => {
                setSearch('');
                setTag(null);
                setFormat('');
                setPrice('');
              }}
            >
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <div className="psy-catalog__grid">
            {filtered.map((p) => (
              <PsychologistMiniCard
                key={p.id}
                data={{
                  id: p.id,
                  name: p.name,
                  bio: p.bio,
                  therapyMethod: p.therapyMethod,
                  specialization: p.specialization,
                  worksWith: p.worksWith,
                  experience: p.experience,
                  avatarUrl: p.avatarUrl,
                  sessionPriceRub: p.sessionPriceRub,
                  nearestSlot: p.nearestSlot,
                  verified: true,
                  rating: p.rating,
                  reviewsCount: p.reviewsCount,
                }}
                highlightTags={tag ? [tag] : []}
                profileCtaLabel="Профиль"
                showWrite={Boolean(token && user?.role === 'client')}
                onWrite={() => void writeTo(p.id)}
              />
            ))}
          </div>
        )}
      </main>
      <LandingFooter />
    </div>
  );
}
