import { useCallback, useEffect, useState } from 'react';
import { ResearcherNavbar } from '../../components/ResearcherNavbar';
import { PlatformIcon } from '../../components/icons';
import { IndividuationDashboard } from '../../components/individuation/IndividuationDashboard';
import { IndividuationHexagram } from '../../components/individuation/IndividuationHexagram';
import { IndividuationTestRunner } from '../../components/individuation/IndividuationTestRunner';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  COMPENSATION_AXES,
  INDIVIDUATION_STAGES,
  loadResearcherIndividuationResult,
  clearResearcherIndividuationResult,
  saveResearcherIndividuationResult,
  type CognitiveHexResult,
  type IndividuationHexResult,
  type StageId,
} from '../../data/individuationModel';
import './IndividuationModel.css';

type Tab = 'model' | 'test' | 'participants';

type ParticipantRow = {
  participantLabel: string;
  clientId: string;
  testType: string;
  completedAt: string;
  summary?: string;
};

export default function ResearcherIndividuationModel() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('model');
  const [activeStage, setActiveStage] = useState<StageId>('S1');
  const [testKind, setTestKind] = useState<'individuation-hex' | 'cognitive-hex' | null>(null);
  const [hexResult, setHexResult] = useState<IndividuationHexResult | null>(() =>
    loadResearcherIndividuationResult('individuation-hex') as IndividuationHexResult | null
  );
  const [cogResult, setCogResult] = useState<CognitiveHexResult | null>(() =>
    loadResearcherIndividuationResult('cognitive-hex') as CognitiveHexResult | null
  );
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const active = INDIVIDUATION_STAGES.find((s) => s.id === activeStage) ?? INDIVIDUATION_STAGES[0];

  const loadParticipants = useCallback(async () => {
    if (!token) return;
    setLoadingParticipants(true);
    try {
      const res = await api<{ items: ParticipantRow[] }>('/api/research/individuation/participants', { token });
      setParticipants(res.items ?? []);
    } catch {
      setParticipants([]);
    } finally {
      setLoadingParticipants(false);
    }
  }, [token]);

  useEffect(() => {
    if (tab === 'participants') loadParticipants();
  }, [tab, loadParticipants]);

  function onTestComplete(result: IndividuationHexResult | CognitiveHexResult) {
    if (result.kind === 'individuation-hex') {
      setHexResult(result);
      saveResearcherIndividuationResult('individuation-hex', result);
    } else {
      setCogResult(result);
      saveResearcherIndividuationResult('cognitive-hex', result);
    }
    setTestKind(null);
  }

  function retakeIndividuationHex() {
    clearResearcherIndividuationResult('individuation-hex');
    setHexResult(null);
    setTestKind('individuation-hex');
  }

  return (
    <div className="individuation-page-wrap">
      <ResearcherNavbar />
      <main className="individuation-page">
        <header className="individuation-page__header">
          <h1>
            <span className="individuation-page__icon">
              <PlatformIcon name="orbit" size={32} strokeWidth={1.4} />
            </span>
            Модель индивидуации
          </h1>
          <p className="individuation-page__lead">
            Шесть стадий спиральной динамики на гексаграмме (движение против часовой стрелки), три оси компенсаций и
            когнитивный слой. Диагностика для участников и исследователя.
          </p>
          <nav className="individuation-tabs">
            <button type="button" className={tab === 'model' ? 'active' : ''} onClick={() => setTab('model')}>
              Модель
            </button>
            <button type="button" className={tab === 'test' ? 'active' : ''} onClick={() => setTab('test')}>
              Диагностика
            </button>
            <button type="button" className={tab === 'participants' ? 'active' : ''} onClick={() => setTab('participants')}>
              Участники
            </button>
          </nav>
        </header>

        {tab === 'model' && (
          <>
            <div className="individuation-page__grid">
              <div className="individuation-hex-wrap card">
                <IndividuationHexagram
                  activeStage={activeStage}
                  onStageClick={setActiveStage}
                  result={hexResult}
                  size={460}
                />
                <div className="individuation-hex-legend">
                  {INDIVIDUATION_STAGES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={activeStage === s.id ? 'individuation-hex-legend__item active' : 'individuation-hex-legend__item'}
                      onClick={() => setActiveStage(s.id)}
                    >
                      <span className="ind-legend-dot" style={{ background: s.color }} />
                      {s.id}: {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="individuation-detail card">
                <div className="individuation-detail__axis">{active.archetype}</div>
                <h2>{active.label}</h2>
                <p className="individuation-detail__short">{active.focus}</p>
                <div className="individuation-detail__color" style={{ background: active.color }} />
                <div className="individuation-detail__integrations">
                  <h3>Измерения D / F / I</h3>
                  <ul>
                    <li><strong>D</strong> — дефицит: стадия вытеснена (бледный луч, разрыв)</li>
                    <li><strong>F</strong> — фиксация: ригидное доминирование (пульсация)</li>
                    <li><strong>I</strong> — интеграция: ресурс доступен гибко (длина луча)</li>
                  </ul>
                </div>
              </div>
            </div>

            <section className="individuation-axes card">
              <h2>Три оси компенсаций</h2>
              <div className="individuation-axes__grid">
                {COMPENSATION_AXES.map((axis) => (
                  <div key={axis.id}>
                    <h3>{axis.label}</h3>
                    <p>{axis.conflict}</p>
                    <p className="small">{axis.individuationGoal}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'test' && (
          <section className="card" style={{ padding: 20 }}>
            {testKind ? (
              <IndividuationTestRunner
                kind={testKind}
                onComplete={onTestComplete}
                onCancel={() => setTestKind(null)}
              />
            ) : hexResult ? (
              <>
                <IndividuationDashboard result={hexResult} onRetake={retakeIndividuationHex} />
                <div className="ind-test-picker" style={{ marginTop: 20 }}>
                  <button type="button" className="button secondary" onClick={() => setTestKind('cognitive-hex')}>
                    Пройти когнитивную гексаграмму
                  </button>
                  {cogResult && (
                    <div className="card" style={{ marginTop: 12, padding: 16, background: 'var(--surface-2)' }}>
                      <strong>Когнитивный профиль:</strong> {cogResult.interpretation}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="ind-test-picker">
                <h2>Диагностика</h2>
                <p className="small" style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                  Пройдите тест на этой странице. Результат сохраняется локально для исследователя.
                </p>
                <div className="ind-test-picker__grid">
                  <button type="button" className="ind-test-picker__card" onClick={() => setTestKind('individuation-hex')}>
                    <span className="ind-test-picker__emoji">⬡</span>
                    <strong>Гексаграмма индивидуации</strong>
                    <span>36 дилемм · ~15 мин</span>
                  </button>
                  <button type="button" className="ind-test-picker__card" onClick={() => setTestKind('cognitive-hex')}>
                    <span className="ind-test-picker__emoji">🧩</span>
                    <strong>Когнитивная гексаграмма</strong>
                    <span>12 вопросов · ~5 мин</span>
                  </button>
                </div>
                {cogResult && (
                  <div className="card" style={{ marginTop: 16, padding: 16, background: 'var(--surface-2)' }}>
                    <strong>Когнитивный профиль:</strong> {cogResult.interpretation}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {tab === 'participants' && (
          <section className="card" style={{ padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>Прохождения участников</h2>
            <p className="small" style={{ color: 'var(--text-muted)' }}>
              Клиенты проходят тесты в разделе «Тесты». Здесь — обезличенный список завершённых диагностик.
            </p>
            {loadingParticipants && <p className="small">Загрузка…</p>}
            {!loadingParticipants && participants.length === 0 && (
              <p className="small">Пока нет результатов по гексаграммам индивидуации.</p>
            )}
            <div className="ind-participants-table">
              <div className="ind-participants-table__head">
                <span>Участник</span>
                <span>Тест</span>
                <span>Дата</span>
                <span>Кратко</span>
              </div>
              {participants.map((row, i) => (
                <div key={`${row.clientId}-${row.testType}-${i}`} className="ind-participants-table__row">
                  <span>{row.participantLabel}</span>
                  <span>{row.testType === 'individuation-hex' ? 'Индивидуация' : 'Когнитивная'}</span>
                  <span>{new Date(row.completedAt).toLocaleDateString('ru-RU')}</span>
                  <span className="small">{row.summary ?? '—'}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
