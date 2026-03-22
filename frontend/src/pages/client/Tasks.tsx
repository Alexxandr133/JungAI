import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ClientNavbar } from '../../components/ClientNavbar';
import { syncClientActivityPoints, type SyncResult } from '../../lib/clientActivityPoints';

function loadRankPoints(): number {
  try {
    const raw = localStorage.getItem('client_rank_data');
    if (!raw) return 0;
    const p = JSON.parse(raw);
    return typeof p.points === 'number' ? p.points : 0;
  } catch {
    return 0;
  }
}

type RankRow = {
  level: number;
  title: string;
  tagline: string;
  pointsRequired: number;
  icon: string;
};

const RANKS: RankRow[] = [
  { level: 1, title: 'Новичок', tagline: 'Старт — всё ок', pointsRequired: 0, icon: '🌱' },
  { level: 2, title: 'Знаток', tagline: 'Уже в теме', pointsRequired: 120, icon: '📘' },
  { level: 3, title: 'Исследователь', tagline: 'Заходишь почаще', pointsRequired: 350, icon: '🔭' },
  { level: 4, title: 'Мастер', tagline: 'Прям хорошая вовлечённость', pointsRequired: 800, icon: '⭐' },
  { level: 5, title: 'Эксперт', tagline: 'Серьёзно в процессе', pointsRequired: 1600, icon: '💎' },
  { level: 6, title: 'Ветеран', tagline: 'Долго с нами', pointsRequired: 3000, icon: '🏅' }
];

function computeCurrentRank(points: number): RankRow {
  let best = RANKS[0];
  for (const r of RANKS) {
    if (points >= r.pointsRequired) best = r;
  }
  return best;
}

function computeNextRank(points: number): RankRow | null {
  return RANKS.find(r => r.pointsRequired > points) ?? null;
}

function useLayoutBreakpoints(desktopBp = 1024, mobileBp = 640) {
  const [flags, setFlags] = useState(() => {
    if (typeof window === 'undefined') return { isDesktop: false, isMobile: false };
    const w = window.innerWidth;
    return { isDesktop: w >= desktopBp, isMobile: w <= mobileBp };
  });
  useEffect(() => {
    const dMq = window.matchMedia(`(min-width: ${desktopBp}px)`);
    const mMq = window.matchMedia(`(max-width: ${mobileBp}px)`);
    const on = () =>
      setFlags({
        isDesktop: dMq.matches,
        isMobile: mMq.matches
      });
    on();
    dMq.addEventListener('change', on);
    mMq.addEventListener('change', on);
    return () => {
      dMq.removeEventListener('change', on);
      mMq.removeEventListener('change', on);
    };
  }, [desktopBp, mobileBp]);
  return flags;
}

export default function ClientTasks() {
  const { token, user } = useAuth();
  const { isDesktop, isMobile } = useLayoutBreakpoints(1024, 640);
  const [syncing, setSyncing] = useState(false);
  const [sync, setSync] = useState<SyncResult | null>(null);
  const [lastDelta, setLastDelta] = useState(0);

  const runSync = useCallback(async () => {
    if (!token || !user?.id) {
      setSync(null);
      return;
    }
    setSyncing(true);
    try {
      const res = await syncClientActivityPoints(token, user.id);
      setSync(res);
      setLastDelta(res.delta);
    } catch {
      setSync(null);
    } finally {
      setSyncing(false);
    }
  }, [token, user?.id]);

  useEffect(() => {
    runSync();
  }, [runSync]);

  const pointsTotal = token && user?.id ? (sync?.pointsTotal ?? loadRankPoints()) : 0;

  const currentRank = useMemo(() => computeCurrentRank(pointsTotal), [pointsTotal]);
  const nextRank = useMemo(() => computeNextRank(pointsTotal), [pointsTotal]);

  const progress = useMemo(() => {
    if (!nextRank) return 100;
    const span = nextRank.pointsRequired - currentRank.pointsRequired;
    if (span <= 0) return 100;
    const p = ((pointsTotal - currentRank.pointsRequired) / span) * 100;
    return Math.min(100, Math.max(0, p));
  }, [pointsTotal, currentRank, nextRank]);

  const pointsToNext = nextRank ? nextRank.pointsRequired - pointsTotal : 0;

  const rows = [
    {
      key: 'dreams',
      icon: '💭',
      title: 'Сны',
      count: sync?.ownDreamCount ?? 0,
      to: '/dreams/new',
      action: 'Записать сон'
    },
    {
      key: 'journal',
      icon: '📔',
      title: 'Дневник',
      count: sync?.journalCount ?? 0,
      to: '/client/journal',
      action: 'Открыть дневник'
    },
    {
      key: 'chat',
      icon: '💬',
      title: 'Чат с психологом',
      count: sync?.therapistMessagesCount ?? 0,
      to: '/chat',
      action: 'Открыть чат'
    },
    {
      key: 'sessions',
      icon: '📅',
      title: 'Сессии',
      count: sync?.sessionsHeldCount ?? 0,
      to: '/client/sessions',
      action: 'Расписание'
    },
    {
      key: 'ai',
      icon: '🤖',
      title: 'ИИ-помощник',
      count: sync?.aiUserMessages ?? 0,
      to: '/client/ai',
      action: 'Открыть помощника'
    }
  ];

  const pointsDisplay = token && user?.id ? (syncing && !sync ? '…' : pointsTotal) : '—';

  const heroCard = (
    <div
      className="card"
      style={{
        padding: isDesktop ? 28 : isMobile ? 18 : 22,
        borderRadius: isMobile ? 16 : 20,
        background: 'linear-gradient(160deg, rgba(124,92,255,0.14), rgba(255,255,255,0.02))',
        border: '1px solid rgba(124,92,255,0.2)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: isMobile ? 'stretch' : 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexDirection: isMobile ? 'column' : 'row',
          flexWrap: isMobile ? 'nowrap' : 'wrap'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 12 : 16,
            flex: isMobile ? undefined : 1,
            minWidth: 0
          }}
        >
          <span style={{ fontSize: isDesktop ? 56 : isMobile ? 40 : 48, lineHeight: 1 }}>{currentRank.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="small" style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, fontSize: isMobile ? 12 : undefined }}>
              Сейчас ты
            </div>
            <div style={{ fontSize: isDesktop ? 26 : isMobile ? 20 : 22, fontWeight: 800 }}>{currentRank.title}</div>
            <div style={{ fontSize: isMobile ? 13 : 14, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.45 }}>
              {currentRank.tagline}
            </div>
          </div>
        </div>
        <div
          style={{
            textAlign: isMobile ? 'center' : isDesktop ? 'right' : 'left',
            paddingTop: isMobile ? 4 : 0,
            borderTop: isMobile ? '1px solid rgba(255,255,255,0.08)' : 'none',
            padding: isMobile ? '12px 0 0' : undefined
          }}
        >
          <div className="small" style={{ color: 'var(--text-muted)', fontSize: isMobile ? 12 : undefined }}>
            Очков
          </div>
          <div
            style={{
              fontSize: isDesktop ? 40 : isMobile ? 32 : 34,
              fontWeight: 800,
              color: 'var(--accent)',
              lineHeight: 1.1
            }}
          >
            {pointsDisplay}
          </div>
          {lastDelta > 0 && !syncing && token && (
            <div style={{ fontSize: isMobile ? 12 : 13, color: '#4ade80', fontWeight: 600, marginTop: 6 }}>
              +{lastDelta} свежими действиями
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          flexWrap: isMobile ? 'nowrap' : 'wrap',
          gap: isMobile ? 10 : 10,
          marginTop: isMobile ? 16 : 18,
          alignItems: isMobile ? 'stretch' : 'center'
        }}
      >
        <button
          type="button"
          className="button secondary"
          disabled={syncing || !token}
          onClick={() => runSync()}
          style={{
            padding: isMobile ? '12px 16px' : '10px 16px',
            fontSize: isMobile ? 15 : 14,
            width: isMobile ? '100%' : 'auto',
            minHeight: isMobile ? 48 : undefined
          }}
        >
          {syncing ? 'Тянем данные…' : 'Обновить'}
        </button>
        {!token && (
          <span className="small" style={{ color: 'var(--text-muted)', textAlign: isMobile ? 'center' : 'left', lineHeight: 1.5 }}>
            Войди — подтянем сны и дневник.
          </span>
        )}
        {token && (
          <span className="small" style={{ color: 'var(--text-muted)', textAlign: isMobile ? 'center' : 'left', lineHeight: 1.5 }}>
            Что-то только что добавил? Нажми обновить.
          </span>
        )}
      </div>
    </div>
  );

  const progressCard =
    nextRank ? (
      <div
        className="card"
        style={{
          padding: isMobile ? 16 : 18,
          borderRadius: isMobile ? 14 : 16,
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: isMobile ? 14 : 15, lineHeight: 1.35 }}>
            До «{nextRank.title}» ещё {pointsToNext} очк.
          </div>
          <span style={{ fontSize: isMobile ? 20 : 22 }}>{nextRank.icon}</span>
        </div>
        <div style={{ width: '100%', height: isMobile ? 10 : 8, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--primary), var(--accent))',
              transition: 'width 0.35s ease'
            }}
          />
        </div>
      </div>
    ) : token ? (
      <div
        className="card"
        style={{
          padding: isMobile ? 16 : 16,
          borderRadius: 16,
          textAlign: 'center',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <div style={{ fontWeight: 700, fontSize: isMobile ? 15 : undefined }}>Ты на верхней ступени 🎉</div>
        <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: isMobile ? 13 : undefined }}>
          Дальше — просто кайф от процесса.
        </div>
      </div>
    ) : null;

  const stepsSection = (
    <div>
      <div
        style={{
          fontWeight: 700,
          fontSize: isMobile ? 14 : 15,
          marginBottom: isMobile ? 12 : 10,
          color: 'var(--text-muted)'
        }}
      >
        Ступеньки
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? 'repeat(2, minmax(0, 1fr))' : '1fr',
          gap: isMobile ? 10 : 8
        }}
      >
        {RANKS.map(rank => {
          const isCurrent = rank.level === currentRank.level;
          const isUnlocked = pointsTotal >= rank.pointsRequired;
          return (
            <div
              key={rank.level}
              className="card"
              style={{
                padding: isMobile ? '14px 14px' : '12px 14px',
                borderRadius: isMobile ? 14 : 14,
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? 14 : 12,
                opacity: isUnlocked ? 1 : 0.5,
                border: isCurrent ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.07)',
                background: isCurrent ? 'rgba(124,92,255,0.08)' : 'rgba(255,255,255,0.02)',
                minHeight: isMobile ? 56 : undefined
              }}
            >
              <span style={{ fontSize: isMobile ? 24 : 22 }}>{rank.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: isMobile ? 15 : 14 }}>{rank.title}</span>
                  {isCurrent && (
                    <span
                      style={{
                        fontSize: isMobile ? 11 : 11,
                        fontWeight: 700,
                        background: 'var(--accent)',
                        color: '#0b0f1a',
                        padding: '3px 9px',
                        borderRadius: 999
                      }}
                    >
                      ты тут
                    </span>
                  )}
                  {!isUnlocked && <span style={{ fontSize: 12 }}>🔒</span>}
                </div>
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 3, fontSize: isMobile ? 12 : undefined, lineHeight: 1.4 }}>
                  от {rank.pointsRequired} очк. · {rank.tagline}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const activitySection = (
    <div>
      <div style={{ fontWeight: 700, fontSize: isMobile ? 15 : 15, marginBottom: isMobile ? 12 : 12 }}>
        Сны, дневник, чат, сессии и помощник
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 12 }}>
        {rows.map(r => (
          <div
            key={r.key}
            className="card"
            style={{
              padding: isMobile ? 14 : 16,
              borderRadius: isMobile ? 14 : 16,
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? 12 : 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 10, minWidth: 0 }}>
                <span style={{ fontSize: isMobile ? 26 : 24, flexShrink: 0 }}>{r.icon}</span>
                <span style={{ fontWeight: 800, fontSize: isMobile ? 15 : 15, lineHeight: 1.3 }}>{r.title}</span>
              </div>
              <span
                className="small"
                style={{
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: isMobile ? 14 : 13,
                  flexShrink: 0,
                  minWidth: 24,
                  textAlign: 'right'
                }}
              >
                {token && user?.id ? (syncing ? '…' : r.count) : '—'}
              </span>
            </div>
            <Link
              to={r.to}
              className="button secondary"
              style={{
                padding: isMobile ? '10px 14px' : '8px 14px',
                fontSize: isMobile ? 14 : 13,
                textDecoration: 'none',
                textAlign: 'center',
                minHeight: isMobile ? 44 : undefined
              }}
            >
              {r.action}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );

  const heroBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 14 }}>
      {heroCard}
      {progressCard}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ClientNavbar />
      <main
        style={{
          flex: 1,
          padding: isMobile ? '14px 14px 36px' : '22px clamp(16px, 4vw, 40px) 48px',
          maxWidth: 'min(100%, 1600px)',
          margin: '0 auto',
          width: '100%',
          overflowX: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        <header style={{ marginBottom: isDesktop ? 28 : isMobile ? 18 : 22 }}>
          <h1
            style={{
              margin: 0,
              fontSize: isDesktop ? 34 : isMobile ? 22 : 'clamp(24px, 5vw, 30px)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}
          >
            Баллы и уровень
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              color: 'var(--text-muted)',
              lineHeight: 1.55,
              fontSize: isMobile ? 14 : 15,
              maxWidth: 720
            }}
          >
            Это просто мотивация: живёшь на платформе — очки капают. Не оценка личности и не отчёт перед кем-то.
          </p>
        </header>

        {isDesktop ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.82fr) minmax(280px, 0.78fr)',
              gap: 32,
              alignItems: 'start'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              {heroBlock}
              {stepsSection}
            </div>
            <div style={{ position: 'sticky', top: 88, minWidth: 0 }}>{activitySection}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 24 }}>
            {heroBlock}
            {activitySection}
            {stepsSection}
          </div>
        )}
      </main>
    </div>
  );
}
