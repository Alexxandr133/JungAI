import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MATCH_TOPIC_TAGS, PROFILE_TAG_SUGGESTIONS, searchProfileTags } from 'jungai-shared';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { LandingNavbar } from '../../components/landing/LandingNavbar';
import { LandingFooter } from '../../components/landing/LandingFooter';
import { PsychologistMiniCard } from '../../components/PsychologistMiniCard';
import '../../styles/landing-tokens.css';
import './Match.css';

const FALLBACK_BANDS = [
  { id: 'budget', min: 0, max: 3500, label: 'до 3 500 ₽' },
  { id: 'mid', min: 3500, max: 5500, label: '3 500 – 5 500 ₽' },
  { id: 'premium', min: 5500, max: null as number | null, label: 'от 5 500 ₽' },
];

type WhoFor = 'self' | 'couple' | 'child';
type TimePreference = 'any' | 'morning' | 'day' | 'evening';

type MatchCard = {
  id: string;
  name: string;
  bio: string | null;
  therapyMethod: string | null;
  specialization: string[];
  worksWith?: string[];
  experience: number;
  avatarUrl: string | null;
  sessionPriceRub: number | null;
  nearestSlot: { slotStart: string; startHm: string; dayKey: string } | null;
  score: number;
  reasons: string[];
  matchedTopics?: string[];
  matchLine?: string;
};

const STEP_LABELS = ['Для кого', 'Тема', 'Время', 'Бюджет', 'Подбор'] as const;
const CUSTOM_MAX = 300;
const QUIZ_KEY = 'client_quiz_result';
const RESULTS_KEY = 'jungai_match_results';

const WHO_LABEL: Record<WhoFor, string> = {
  self: 'индивидуально',
  couple: 'с парами',
  child: 'с детьми',
};

const TIME_LABEL: Record<TimePreference, string> = {
  any: 'любое время',
  morning: 'утро',
  day: 'день',
  evening: 'вечер',
};

type PersistedResults = {
  matches: MatchCard[];
  total: number;
  relaxed: boolean;
  whoFor: WhoFor;
  topics: string[];
  customTopic: string;
  timePreference: TimePreference;
  priceBand: string;
};

function persistQuiz(payload: Record<string, unknown>) {
  try {
    localStorage.setItem(QUIZ_KEY, JSON.stringify(payload));
    sessionStorage.setItem('jungai_match_query', JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function persistResults(data: PersistedResults) {
  try {
    sessionStorage.setItem(RESULTS_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function persistMatchReturnPath(path: string) {
  try {
    sessionStorage.setItem('jungai_match_return', path);
  } catch {
    /* ignore */
  }
}

function loadResults(): PersistedResults | null {
  try {
    const raw = sessionStorage.getItem(RESULTS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedResults;
    if (!Array.isArray(data.matches)) return null;
    return data;
  } catch {
    return null;
  }
}

function clearResults() {
  try {
    sessionStorage.removeItem(RESULTS_KEY);
  } catch {
    /* ignore */
  }
}

export default function ClientMatch() {
  const { token } = useAuth();
  const location = useLocation();
  const restored = loadResults();

  const [step, setStep] = useState(() => (restored ? 4 : 0));
  const [whoFor, setWhoFor] = useState<WhoFor>(() => restored?.whoFor || 'self');
  const [topics, setTopics] = useState<string[]>(() => restored?.topics || []);
  const [customTopic, setCustomTopic] = useState(() => restored?.customTopic || '');
  const [tagQuery, setTagQuery] = useState('');
  const [topicList, setTopicList] = useState<string[]>([...MATCH_TOPIC_TAGS]);
  const [priceBands, setPriceBands] = useState(FALLBACK_BANDS);
  const [timePreference, setTimePreference] = useState<TimePreference>(
    () => restored?.timePreference || 'any'
  );
  const [priceBand, setPriceBand] = useState<string>(() => restored?.priceBand || 'mid');
  const [matches, setMatches] = useState<MatchCard[] | null>(() => restored?.matches ?? null);
  const [total, setTotal] = useState(() => restored?.total ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relaxed, setRelaxed] = useState(() => Boolean(restored?.relaxed));

  useEffect(() => {
    api<{ topics: string[]; priceBands: typeof FALLBACK_BANDS }>('/api/psychologists/match/meta')
      .then((res) => {
        if (res.topics?.length) setTopicList(res.topics);
        if (res.priceBands?.length) setPriceBands(res.priceBands as typeof FALLBACK_BANDS);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (matches) persistMatchReturnPath(location.pathname);
  }, [matches, location.pathname]);

  const tagChoices = useMemo(() => {
    const q = tagQuery.trim();
    if (q) return searchProfileTags(q, 16);
    const base = topicList.length ? topicList : PROFILE_TAG_SUGGESTIONS;
    return (base as readonly string[]).filter((t) => !topics.includes(t)).slice(0, 16);
  }, [tagQuery, topicList, topics]);

  const band = priceBands.find((b) => b.id === priceBand);

  function buildBody(extra?: { ignorePrice?: boolean; ignoreAudience?: boolean; limit?: number }) {
    return {
      whoFor,
      topics,
      customTopic: customTopic.trim() || null,
      timePreference,
      priceBand,
      priceMin: extra?.ignorePrice ? null : band?.min ?? null,
      priceMax: extra?.ignorePrice ? null : band?.max ?? null,
      ignorePrice: Boolean(extra?.ignorePrice),
      ignoreAudience: Boolean(extra?.ignoreAudience),
      limit: extra?.limit ?? 4,
      offset: 0,
    };
  }

  function toggleTopic(t: string) {
    setTopics((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      if (prev.length >= 3) return prev;
      return [...prev, t];
    });
    setTagQuery('');
  }

  function buildNotePrefill(): string {
    const parts = [
      topics.length ? topics.join(', ') : null,
      WHO_LABEL[whoFor],
      customTopic.trim() || null,
    ].filter(Boolean);
    return `Запрос из анкеты: ${parts.join(' · ')}`;
  }

  async function runMatch() {
    setLoading(true);
    setError(null);
    setRelaxed(false);
    try {
      let body = buildBody({ limit: 4 });
      let res = await api<{ matches: MatchCard[]; total: number }>('/api/psychologists/match', {
        method: 'POST',
        body,
        token: token || undefined,
      });
      let list = res.matches || [];
      let didRelax = false;

      if (!list.length) {
        body = buildBody({ ignorePrice: true, limit: 4 });
        res = await api<{ matches: MatchCard[]; total: number }>('/api/psychologists/match', {
          method: 'POST',
          body,
          token: token || undefined,
        });
        list = res.matches || [];
        didRelax = true;
      }
      if (!list.length) {
        body = buildBody({ ignorePrice: true, ignoreAudience: true, limit: 4 });
        res = await api<{ matches: MatchCard[]; total: number }>('/api/psychologists/match', {
          method: 'POST',
          body,
          token: token || undefined,
        });
        list = res.matches || [];
        didRelax = true;
      }

      setMatches(list);
      setTotal(res.total || list.length);
      setRelaxed(didRelax && list.length > 0);
      setStep(4);

      persistResults({
        matches: list,
        total: res.total || list.length,
        relaxed: didRelax && list.length > 0,
        whoFor,
        topics,
        customTopic: customTopic.trim(),
        timePreference,
        priceBand,
      });
      persistMatchReturnPath(location.pathname);

      persistQuiz({
        ...body,
        topics,
        customTopic: customTopic.trim() || null,
        whoFor,
        timePreference,
        priceBand,
        priceBandLabel: band?.label,
        timeLabel: TIME_LABEL[timePreference],
        whoLabel: WHO_LABEL[whoFor],
        notePrefill: buildNotePrefill(),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось подобрать специалистов');
    } finally {
      setLoading(false);
    }
  }

  function goStep(i: number) {
    if (i < step) setStep(i);
    // Можно снова открыть «Подбор», если результаты ещё в сессии
    if (i === 4 && matches) setStep(4);
  }

  function restartQuiz() {
    clearResults();
    setStep(0);
    setMatches(null);
    setRelaxed(false);
    setTotal(0);
  }

  return (
    <div className="landing client-match-page">
      <LandingNavbar variant="catalog" />
      <main className="client-match landing-container">
        <header className="client-match__hero">
          <h1 className="landing-h1" style={{ fontSize: 'clamp(28px, 4vw, 36px)' }}>
            Подобрать психолога
          </h1>
          <p className="landing-lead" style={{ fontSize: 17, marginTop: 8 }}>
            Короткая анкета — и рекомендации под ваш запрос, время и бюджет.
          </p>
          <div className="client-match__steps" role="list">
            {STEP_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                role="listitem"
                className={`client-match__step${step === i ? ' is-active' : ''}${step > i || (i === 4 && matches) ? ' is-done' : ''}`}
                onClick={() => goStep(i)}
                disabled={i > step && !(i === 4 && matches)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {error ? <div className="client-match__error">{error}</div> : null}

        {step === 0 && (
          <section className="landing-card client-match__panel">
            <h2 className="landing-h3">Для кого подбираем психолога?</h2>
            <div className="client-match__options">
              {(
                [
                  ['self', 'Для себя', 'Индивидуальная работа'],
                  ['couple', 'Для пары', 'Парная / семейная'],
                  ['child', 'Для ребёнка', 'Детская / подростковая'],
                ] as const
              ).map(([id, title, sub]) => (
                <button
                  key={id}
                  type="button"
                  className={`client-match__option${whoFor === id ? ' is-on' : ''}`}
                  onClick={() => setWhoFor(id)}
                >
                  <strong>{title}</strong>
                  <span>{sub}</span>
                </button>
              ))}
            </div>
            <button type="button" className="landing-btn landing-btn--primary" onClick={() => setStep(1)}>
              Далее
            </button>
          </section>
        )}

        {step === 1 && (
          <section className="landing-card client-match__panel">
            <h2 className="landing-h3">Над чем бы вы хотели поработать?</h2>
            <p className="landing-small">Выбрано {topics.length} из 3 · до трёх — так рекомендация точнее</p>
            {topics.length > 0 ? (
              <div className="client-match__chips" style={{ marginBottom: 12 }}>
                {topics.map((t) => (
                  <button key={t} type="button" className="client-match__chip is-on" onClick={() => toggleTopic(t)}>
                    {t} ×
                  </button>
                ))}
              </div>
            ) : null}
            <input
              className="client-match__input"
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              placeholder="Поиск темы: тревога, отношения…"
            />
            <div className="client-match__chips">
              {tagChoices.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`client-match__chip${topics.includes(t) ? ' is-on' : ''}`}
                  disabled={!topics.includes(t) && topics.length >= 3}
                  onClick={() => toggleTopic(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <label className="client-match__notes">
              Своими словами
              <textarea
                value={customTopic}
                maxLength={CUSTOM_MAX}
                onChange={(e) => setCustomTopic(e.target.value.slice(0, CUSTOM_MAX))}
                rows={3}
                placeholder="Пара слов о запросе"
              />
              <span className="landing-small">
                Этот текст психолог увидит в заявке на запись — пишите как есть · {customTopic.length}/{CUSTOM_MAX}
              </span>
            </label>
            <div className="client-match__nav">
              <button type="button" className="landing-btn landing-btn--ghost" onClick={() => setStep(0)}>
                Назад
              </button>
              <button
                type="button"
                className="landing-btn landing-btn--primary"
                disabled={!topics.length && !customTopic.trim()}
                onClick={() => setStep(2)}
              >
                Далее
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="landing-card client-match__panel">
            <h2 className="landing-h3">Когда удобнее встречаться?</h2>
            <p className="landing-small">
              Не жёсткий фильтр — сохраним и подставим в заявку. Точный слот выберете в профиле.
            </p>
            <div className="client-match__options client-match__options--2">
              {(
                [
                  ['any', 'Любое время'],
                  ['morning', 'Утро'],
                  ['day', 'День'],
                  ['evening', 'Вечер'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`client-match__option${timePreference === id ? ' is-on' : ''}`}
                  onClick={() => setTimePreference(id)}
                >
                  <strong>{label}</strong>
                </button>
              ))}
            </div>
            <div className="client-match__nav">
              <button type="button" className="landing-btn landing-btn--ghost" onClick={() => setStep(1)}>
                Назад
              </button>
              <button type="button" className="landing-btn landing-btn--primary" onClick={() => setStep(3)}>
                Далее
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="landing-card client-match__panel">
            <h2 className="landing-h3">Комфортный диапазон стоимости</h2>
            <div className="client-match__options">
              {priceBands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`client-match__option${priceBand === b.id ? ' is-on' : ''}`}
                  onClick={() => setPriceBand(b.id)}
                >
                  <strong>{b.label}</strong>
                  <span>за сессию</span>
                </button>
              ))}
            </div>
            <div className="client-match__nav">
              <button type="button" className="landing-btn landing-btn--ghost" onClick={() => setStep(2)}>
                Назад
              </button>
              <button
                type="button"
                className="landing-btn landing-btn--primary"
                disabled={loading}
                onClick={() => void runMatch()}
              >
                {loading ? 'Подбираем…' : 'Показать специалистов'}
              </button>
            </div>
          </section>
        )}

        {step === 4 && matches && (
          <section className="client-match__results">
            {relaxed && matches.length > 0 ? (
              <div className="client-match__relax" role="status">
                Мы расширили критерии поиска
              </div>
            ) : null}

            {matches.length === 0 ? (
              <div className="landing-card client-match__panel client-match__empty">
                <h2 className="landing-h3">Сейчас нет точного совпадения</h2>
                <p className="landing-body">Загляните в каталог или пройдите анкету ещё раз с другими темами.</p>
                <div className="client-match__nav">
                  <Link to="/psychologists" className="landing-btn landing-btn--primary">
                    Весь каталог
                  </Link>
                  <button
                    type="button"
                    className="landing-btn landing-btn--ghost"
                    onClick={restartQuiz}
                  >
                    Пройти заново
                  </button>
                </div>
              </div>
            ) : (
              <>
                <header className="client-match__results-head">
                  <h2 className="landing-h2" style={{ fontSize: 28, margin: 0 }}>
                    Рекомендуем
                  </h2>
                  <p className="landing-small" style={{ margin: '6px 0 0' }}>
                    {Math.min(matches.length, 4)} специалистов под ваш запрос
                    {total > matches.length ? ` · всего близких: ${total}` : ''}
                  </p>
                </header>
                <div className="client-match__grid">
                  {matches.slice(0, 4).map((m) => (
                    <PsychologistMiniCard
                      key={m.id}
                      data={{
                        id: m.id,
                        name: m.name,
                        bio: m.bio,
                        therapyMethod: m.therapyMethod,
                        specialization: m.specialization,
                        worksWith: m.worksWith,
                        experience: m.experience,
                        avatarUrl: m.avatarUrl,
                        sessionPriceRub: m.sessionPriceRub,
                        nearestSlot: m.nearestSlot,
                        verified: true,
                        matchLine: m.matchLine,
                        reasons: m.reasons,
                      }}
                      highlightTags={[...(m.matchedTopics || []), ...topics]}
                      profileCtaLabel="Профиль и запись"
                      profileTo={`/psychologists/${m.id}?from=match`}
                    />
                  ))}
                </div>
                <div className="client-match__nav" style={{ marginTop: 20 }}>
                  <Link to="/psychologists" className="landing-btn landing-btn--tertiary">
                    Смотреть весь каталог →
                  </Link>
                  <button type="button" className="landing-btn landing-btn--ghost" onClick={restartQuiz}>
                    Пройти заново
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </main>
      <LandingFooter />
    </div>
  );
}
