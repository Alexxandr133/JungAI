import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ClientNavbar } from '../../components/ClientNavbar';

type Rank = {
  level: number;
  title: string;
  description: string;
  pointsRequired: number;
  icon: string;
};

const RANKS: Rank[] = [
  { level: 1, title: 'Начинающий Герой', description: 'Вы только начинаете свой путь', pointsRequired: 0, icon: '🌱' },
  { level: 2, title: 'Искатель', description: 'Вы активно исследуете свой внутренний мир', pointsRequired: 100, icon: '🔍' },
  { level: 3, title: 'Путник', description: 'Вы движетесь по пути самопознания', pointsRequired: 250, icon: '🚶' },
  { level: 4, title: 'Исследователь Тени', description: 'Вы начинаете понимать свою тень', pointsRequired: 500, icon: '🌑' },
  { level: 5, title: 'Знаток Архетипов', description: 'Вы глубоко понимаете архетипы', pointsRequired: 1000, icon: '🎭' },
  { level: 6, title: 'Мудрец', description: 'Вы достигли глубокого понимания', pointsRequired: 2000, icon: '🧙' },
  { level: 7, title: 'Мастер Интеграции', description: 'Вы интегрировали все аспекты себя', pointsRequired: 3500, icon: '✨' },
  { level: 8, title: 'Просветлённый', description: 'Вы достигли высшего уровня самопознания', pointsRequired: 5000, icon: '🌟' }
];

export default function ClientRank() {
  useAuth();

  const [currentPoints, setCurrentPoints] = useState(145);
  const [archetype, setArchetype] = useState('Герой');

  useEffect(() => {
    const saved = localStorage.getItem('client_rank_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setCurrentPoints(data.points || 145);
        setArchetype(data.archetype || 'Герой');
      } catch {}
    }
  }, []);

  const currentRank = RANKS.find(r => currentPoints >= r.pointsRequired) || RANKS[0];
  const nextRank = RANKS.find(r => r.pointsRequired > currentPoints) || RANKS[RANKS.length - 1];
  const progress = nextRank ? ((currentPoints - currentRank.pointsRequired) / (nextRank.pointsRequired - currentRank.pointsRequired)) * 100 : 100;
  const pointsToNext = nextRank ? nextRank.pointsRequired - currentPoints : 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ClientNavbar />
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: '100%',
          overflowX: 'hidden'
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Мой архетипический ранг</h1>
        </div>

        {/* Current Rank */}
        <div className="card" style={{ marginTop: 12, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>{currentRank.icon}</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{currentRank.title}</div>
          <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{currentRank.description}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
            <div>
              <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Архетип</div>
              <div style={{ fontWeight: 700 }}>{archetype}</div>
            </div>
            <div>
              <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Очки</div>
              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{currentPoints}</div>
            </div>
          </div>
        </div>

        {/* Progress to Next Rank */}
        {nextRank && (
          <div className="card" style={{ marginTop: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Прогресс до следующего ранга</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 32 }}>{currentRank.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{nextRank.title}</div>
                <div className="small" style={{ color: 'var(--text-muted)' }}>{nextRank.description}</div>
              </div>
            </div>
            <div style={{ width: '100%', height: 12, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--accent))', transition: 'width 0.3s' }} />
            </div>
            <div className="small" style={{ color: 'var(--text-muted)' }}>
              Осталось {pointsToNext} очков до уровня {nextRank.level}
            </div>
          </div>
        )}

        {/* All Ranks */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Все ранги</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {RANKS.map(rank => {
              const isCurrent = rank.level === currentRank.level;
              const isUnlocked = currentPoints >= rank.pointsRequired;
              return (
                <div 
                  key={rank.level} 
                  className="card" 
                  style={{ 
                    padding: 16, 
                    opacity: isUnlocked ? 1 : 0.5,
                    border: isCurrent ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 32 }}>{rank.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ fontWeight: 700 }}>{rank.title}</div>
                        {isCurrent && <span className="small" style={{ background: 'var(--accent)', color: '#0b0f1a', padding: '2px 8px', borderRadius: 999 }}>Текущий</span>}
                        {!isUnlocked && <span className="small" style={{ color: 'var(--text-muted)' }}>🔒</span>}
                      </div>
                      <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{rank.description}</div>
                      <div className="small" style={{ color: 'var(--text-muted)' }}>Уровень {rank.level} · {rank.pointsRequired} очков</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

