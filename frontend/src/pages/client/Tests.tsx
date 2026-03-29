import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientNavbar } from '../../components/ClientNavbar';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { buildHexagram, castLine, type IChingHexagram, type IChingLine } from '../../lib/iching';
import {
  SPIRAL_LEVEL_DEFS,
  TEST_CATALOG,
  orderedScoreEntries,
  questionsForType,
  scoreArchetype,
  scorePersonality,
  scoreShadow,
  scoreSpiral,
  SPIRAL_QUESTIONS
} from '../../data/psychologicalTests';

type Test = {
  id: string;
  title: string;
  description: string;
  type: 'archetype' | 'shadow' | 'personality' | 'i-ching' | 'spiral-dynamics';
  completed: boolean;
  questions?: number;
  duration?: number;
};

type SpiralLevel = {
  id: string;
  name: string;
  color: string;
  description: string;
  score: number;
};

export type ClientTestsProps = {
  /** Для гостя — не грузим и не пишем в API */
  persistResults?: boolean;
};

type TestResult = {
  testId: string;
  kind?: 'spiral-dynamics' | 'i-ching' | 'archetype' | 'shadow' | 'personality';
  levels?: SpiralLevel[];
  dominantLevel?: SpiralLevel;
  interpretation?: string;
  hexagram?: IChingHexagram;
  question?: string;
  archetypeScores?: Record<string, number>;
  dominantKey?: string;
  dominantLabel?: { name: string; description: string; hint: string };
  secondaryKey?: string | null;
  secondaryLabel?: { name: string; description: string; hint: string } | null;
  shadowScores?: Record<string, number>;
  themes?: { id: string; title: string; text: string }[];
  summary?: string;
  driverScores?: Record<string, number>;
  driverKey?: string;
  driverLabel?: { name: string; description: string };
};

function mergeSpiralLevels(stored: {
  levels?: SpiralLevel[];
  dominantLevel?: SpiralLevel;
  interpretation?: string;
}): Pick<TestResult, 'levels' | 'dominantLevel' | 'interpretation'> | null {
  if (!stored?.levels?.length) return null;
  const levels: SpiralLevel[] = stored.levels.map((l) => {
    const d = SPIRAL_LEVEL_DEFS.find((x) => x.id === l.id);
    return {
      id: l.id,
      name: l.name || d?.name || l.id,
      color: l.color || d?.color || '#888',
      description: l.description || d?.description || '',
      score: typeof l.score === 'number' ? l.score : 0
    };
  });
  const domId = stored.dominantLevel?.id;
  const dominantLevel = levels.find((x) => x.id === domId) || levels.reduce((a, b) => (a.score >= b.score ? a : b), levels[0]);
  return {
    levels,
    dominantLevel,
    interpretation: stored.interpretation ?? ''
  };
}

/** Приводит сохранённый JSON (v1 без kind или v2) к TestResult для экрана */
function normalizeStoredResult(testType: string, raw: any): TestResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const testId = raw.testId || (TEST_CATALOG.find((t) => t.type === testType)?.id ?? 't1');
  if (raw.hexagram && raw.hexagram.lines) {
    return {
      testId,
      kind: 'i-ching',
      hexagram: raw.hexagram as IChingHexagram,
      question: raw.question
    };
  }
  if (raw.levels && raw.dominantLevel) {
    const m = mergeSpiralLevels(raw);
    if (!m) return null;
    return { testId, kind: 'spiral-dynamics', ...m };
  }
  if (raw.dominantKey && raw.dominantLabel) {
    return {
      testId,
      kind: 'archetype',
      archetypeScores: raw.archetypeScores,
      dominantKey: raw.dominantKey,
      dominantLabel: raw.dominantLabel,
      secondaryKey: raw.secondaryKey ?? null,
      secondaryLabel: raw.secondaryLabel ?? null,
      interpretation: raw.interpretation
    };
  }
  if (raw.themes && Array.isArray(raw.themes)) {
    return {
      testId,
      kind: 'shadow',
      shadowScores: raw.shadowScores,
      themes: raw.themes,
      summary: raw.summary
    };
  }
  if (raw.driverKey && raw.driverLabel) {
    return {
      testId,
      kind: 'personality',
      driverScores: raw.driverScores,
      driverKey: raw.driverKey,
      driverLabel: raw.driverLabel,
      interpretation: raw.interpretation
    };
  }
  return null;
}

export default function ClientTests({ persistResults = true }: ClientTestsProps) {
  const { token, user } = useAuth();
  const canPersist = persistResults && !!token && user?.role === 'client';

  const [tests, setTests] = useState<Test[]>([]);
  const [latestByType, setLatestByType] = useState<Record<string, { result: any; createdAt: string }>>({});
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [iChingQuestion, setIChingQuestion] = useState('');
  const [iChingLines, setIChingLines] = useState<IChingLine[]>([]);
  const [iChingStep, setIChingStep] = useState<'question' | 'casting' | 'result'>('question');
  const [isCasting, setIsCasting] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const iChingFinalizeDone = useRef(false);

  useEffect(() => {
    setTests(
      TEST_CATALOG.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        type: t.type,
        completed: false,
        questions: t.questions,
        duration: t.duration
      }))
    );
  }, []);

  useEffect(() => {
    if (!canPersist) return;
    let cancelled = false;
    (async () => {
      setLoadingSaved(true);
      try {
        const res = await api<{ items: { testType: string; result: any; createdAt: string }[] }>('/api/tests/my-results', {
          token: token ?? undefined
        });
        const items = res.items || [];
        const map: Record<string, { result: any; createdAt: string }> = {};
        items.forEach((row) => {
          const prev = map[row.testType];
          if (!prev || new Date(row.createdAt) > new Date(prev.createdAt)) {
            map[row.testType] = { result: row.result, createdAt: row.createdAt };
          }
        });
        if (!cancelled) {
          setLatestByType(map);
          setTests((prev) =>
            prev.map((t) => ({
              ...t,
              completed: !!map[t.type]
            }))
          );
        }
      } catch {
        if (!cancelled) setLatestByType({});
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canPersist, token]);

  const saveToServer = useCallback(
    async (testType: string, result: Record<string, unknown>) => {
      if (!canPersist || !token) return;
      try {
        await api('/api/tests/results', {
          method: 'POST',
          token,
          body: { testType, result }
        });
        setLatestByType((prev) => ({
          ...prev,
          [testType]: { result, createdAt: new Date().toISOString() }
        }));
        setTests((prev) => prev.map((t) => (t.type === testType ? { ...t, completed: true } : t)));
      } catch (e) {
        console.error('save test result', e);
      }
    },
    [canPersist, token]
  );

  function startTest(test: Test) {
    setSelectedTest(test);
    setCurrentQuestion(0);
    setAnswers({});
    setTestResult(null);
    if (test.type === 'i-ching') {
      iChingFinalizeDone.current = false;
      setIChingStep('question');
      setIChingQuestion('');
      setIChingLines([]);
    }
  }

  function viewSavedResult(test: Test) {
    const row = latestByType[test.type];
    if (!row?.result) return;
    const n = normalizeStoredResult(test.type, row.result);
    if (n) {
      setSelectedTest(test);
      setTestResult(n);
    }
  }

  function getTestIcon(type: string) {
    switch (type) {
      case 'archetype':
        return '🎭';
      case 'shadow':
        return '🌑';
      case 'personality':
        return '🧠';
      case 'i-ching':
        return '☯️';
      case 'spiral-dynamics':
        return '🌀';
      default:
        return '📝';
    }
  }

  function handleAnswer(questionId: number, optionIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  }

  function currentQuestionsList(): ReturnType<typeof questionsForType> {
    if (!selectedTest) return null;
    return questionsForType(selectedTest.type);
  }

  function finishMcqTest() {
    if (!selectedTest) return;
    const t = selectedTest.type;
    const base = { schemaVersion: 2, testId: selectedTest.id, completedAt: new Date().toISOString() };

    if (t === 'spiral-dynamics') {
      const r = scoreSpiral(answers, SPIRAL_QUESTIONS, SPIRAL_LEVEL_DEFS);
      const payload = {
        ...base,
        kind: 'spiral-dynamics' as const,
        levels: r.levels,
        dominantLevel: r.dominantLevel,
        interpretation: r.interpretation
      };
      setTestResult({
        testId: selectedTest.id,
        kind: 'spiral-dynamics',
        levels: r.levels,
        dominantLevel: r.dominantLevel,
        interpretation: r.interpretation
      });
      void saveToServer('spiral-dynamics', payload);
      return;
    }

    if (t === 'archetype') {
      const r = scoreArchetype(answers);
      const payload = {
        ...base,
        kind: 'archetype' as const,
        archetypeScores: r.archetypeScores,
        dominantKey: r.dominantKey,
        dominantLabel: r.dominantLabel,
        secondaryKey: r.secondaryKey,
        secondaryLabel: r.secondaryLabel,
        interpretation: r.interpretation
      };
      setTestResult({
        testId: selectedTest.id,
        kind: 'archetype',
        ...r,
        interpretation: r.interpretation
      });
      void saveToServer('archetype', payload);
      return;
    }

    if (t === 'shadow') {
      const r = scoreShadow(answers);
      const payload = {
        ...base,
        kind: 'shadow' as const,
        shadowScores: r.shadowScores,
        themes: r.themes,
        summary: r.summary
      };
      setTestResult({
        testId: selectedTest.id,
        kind: 'shadow',
        ...r
      });
      void saveToServer('shadow', payload);
      return;
    }

    if (t === 'personality') {
      const r = scorePersonality(answers);
      const payload = {
        ...base,
        kind: 'personality' as const,
        driverScores: r.driverScores,
        driverKey: r.driverKey,
        driverLabel: r.driverLabel,
        interpretation: r.interpretation
      };
      setTestResult({
        testId: selectedTest.id,
        kind: 'personality',
        ...r,
        interpretation: r.interpretation
      });
      void saveToServer('personality', payload);
    }
  }

  function nextQuestion() {
    const qs = currentQuestionsList();
    if (!selectedTest || !qs) return;
    if (currentQuestion < qs.length - 1) {
      setCurrentQuestion((c) => c + 1);
    } else {
      finishMcqTest();
    }
  }

  function prevQuestion() {
    if (currentQuestion > 0) {
      setCurrentQuestion((c) => c - 1);
    }
  }

  function startIChingCasting() {
    if (!iChingQuestion.trim()) return;
    iChingFinalizeDone.current = false;
    setIChingStep('casting');
    setIChingLines([]);
  }

  function castNextLine() {
    setIsCasting(true);
    setTimeout(() => {
      const line = castLine();
      setIChingLines((prev) => [...prev, line]);
      setIsCasting(false);
    }, 900);
  }

  useEffect(() => {
    if (iChingLines.length < 6) {
      iChingFinalizeDone.current = false;
    }
    if (iChingLines.length !== 6 || iChingStep !== 'casting' || !selectedTest || selectedTest.type !== 'i-ching') return;
    if (iChingFinalizeDone.current) return;
    iChingFinalizeDone.current = true;
    const hexagram = buildHexagram(iChingLines);
    const payload = {
      schemaVersion: 2,
      testId: selectedTest.id,
      kind: 'i-ching' as const,
      completedAt: new Date().toISOString(),
      hexagram,
      question: iChingQuestion
    };
    setTestResult({
      testId: selectedTest.id,
      kind: 'i-ching',
      hexagram,
      question: iChingQuestion
    });
    setIChingStep('result');
    void saveToServer('i-ching', payload);
    setTests((prev) => prev.map((t) => (t.id === selectedTest.id ? { ...t, completed: true } : t)));
  }, [iChingLines, iChingStep, selectedTest, iChingQuestion, saveToServer]);

  function closeResult() {
    setTestResult(null);
    setSelectedTest(null);
    setCurrentQuestion(0);
    setAnswers({});
    setIChingStep('question');
    setIChingQuestion('');
    setIChingLines([]);
  }

  // ——— Результаты: архетип ———
  if (testResult?.kind === 'archetype' && testResult.dominantLabel && selectedTest) {
    const d = testResult.dominantLabel;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ClientNavbar />
        <main style={{ flex: 1, padding: '24px clamp(16px, 5vw, 48px)', maxWidth: '100%', overflowX: 'hidden' }}>
          <div className="card" style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Результат: {d.name}</h2>
              <button className="button secondary" onClick={closeResult} style={{ padding: '6px 12px', fontSize: 13 }}>
                Закрыть
              </button>
            </div>
            <div className="card" style={{ padding: 20, marginBottom: 16, background: 'var(--surface-2)' }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Описание</div>
              <div style={{ lineHeight: 1.7 }}>{d.description}</div>
            </div>
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>На заметку</div>
              <div style={{ lineHeight: 1.7 }}>{d.hint}</div>
            </div>
            {testResult.secondaryLabel && (
              <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                Второй заметный полюс: <strong>{testResult.secondaryLabel.name}</strong>
              </div>
            )}
            <div style={{ lineHeight: 1.7, fontSize: 15 }}>{testResult.interpretation}</div>
            {testResult.archetypeScores && (
              <div style={{ marginTop: 20, display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>Баллы</div>
                {orderedScoreEntries('archetype', testResult.archetypeScores).map(({ key, value, label }) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ——— Тень ———
  if (testResult?.kind === 'shadow' && selectedTest) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ClientNavbar />
        <main style={{ flex: 1, padding: '24px clamp(16px, 5vw, 48px)', maxWidth: '100%', overflowX: 'hidden' }}>
          <div className="card" style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Темы для работы с Тенью</h2>
              <button className="button secondary" onClick={closeResult} style={{ padding: '6px 12px', fontSize: 13 }}>
                Закрыть
              </button>
            </div>
            <p className="small" style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
              Инструмент самонаблюдения, не клиническая оценка.
            </p>
            {(testResult.themes || []).map((th) => (
              <div key={th.id} className="card" style={{ padding: 16, marginBottom: 12, background: 'var(--surface-2)' }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{th.title}</div>
                <div style={{ lineHeight: 1.7 }}>{th.text}</div>
              </div>
            ))}
            <div style={{ lineHeight: 1.7, marginTop: 16 }}>{testResult.summary}</div>
            {testResult.shadowScores && (
              <div style={{ marginTop: 20, display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>Набрано по темам</div>
                {orderedScoreEntries('shadow', testResult.shadowScores).map(({ key, value, label }) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ——— Личность / ТА ———
  if (testResult?.kind === 'personality' && testResult.driverLabel && selectedTest) {
    const d = testResult.driverLabel;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ClientNavbar />
        <main style={{ flex: 1, padding: '24px clamp(16px, 5vw, 48px)', maxWidth: '100%', overflowX: 'hidden' }}>
          <div className="card" style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Доминирующий драйвер: {d.name}</h2>
              <button className="button secondary" onClick={closeResult} style={{ padding: '6px 12px', fontSize: 13 }}>
                Закрыть
              </button>
            </div>
            <div style={{ lineHeight: 1.7, marginBottom: 20 }}>{d.description}</div>
            <div style={{ lineHeight: 1.7 }}>{testResult.interpretation}</div>
            {testResult.driverScores && (
              <div style={{ marginTop: 20, display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>Баллы по драйверам</div>
                {orderedScoreEntries('personality', testResult.driverScores).map(({ key, value, label }) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // И-Цзин результат (и загрузка старых записей без kind)
  if (testResult && selectedTest?.type === 'i-ching' && testResult.hexagram) {
    const hex = testResult.hexagram;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ClientNavbar />
        <main style={{ flex: 1, padding: '24px clamp(16px, 5vw, 48px)', maxWidth: '100%', overflowX: 'hidden' }}>
          <div className="card" style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Гексаграмма {hex.number}: {hex.name}</h2>
              <button className="button secondary" onClick={closeResult} style={{ padding: '6px 12px', fontSize: 13 }}>
                Закрыть
              </button>
            </div>
            {testResult.question && (
              <div className="card" style={{ padding: 16, marginBottom: 24, background: 'var(--surface-2)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Ваш вопрос</div>
                <div style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>&quot;{testResult.question}&quot;</div>
              </div>
            )}
            <div className="card" style={{ padding: 24, marginBottom: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{hex.name}</div>
              <div style={{ fontSize: 16, color: 'var(--text-muted)', marginBottom: 24 }}>{hex.chineseName}</div>
              <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 12, alignItems: 'center', marginBottom: 24 }}>
                {hex.lines.map((line, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', minWidth: 30, textAlign: 'right' }}>{idx + 1}</div>
                    <div
                      style={{
                        width: line.isYang ? 200 : 180,
                        height: line.isYang ? 12 : 8,
                        background: line.isYang ? 'var(--primary)' : 'transparent',
                        border: line.isYang ? 'none' : '4px solid var(--primary)',
                        borderRadius: line.isYang ? 6 : 0,
                        position: 'relative'
                      }}
                    >
                      {line.isChanging && (
                        <div
                          style={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 12,
                            boxShadow: '0 0 12px var(--accent)'
                          }}
                        >
                          ⚡
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', minWidth: 120, textAlign: 'left' }}>
                      {line.value} {line.isYang ? '⚊' : '⚋'} {line.isChanging ? '(меняющаяся)' : ''}
                    </div>
                  </div>
                ))}
              </div>
              {hex.lines.some((l) => l.isChanging) && (
                <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 12, marginBottom: 16, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Меняющиеся линии</div>
                  {hex.lines.map(
                    (line, idx) =>
                      line.isChanging && (
                        <div key={idx} style={{ marginBottom: 8 }}>
                          Линия {idx + 1}: {hex.linesText[idx]}
                        </div>
                      )
                  )}
                </div>
              )}
            </div>
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Суждение</div>
              <div style={{ lineHeight: 1.8 }}>{hex.judgment}</div>
            </div>
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Образ</div>
              <div style={{ lineHeight: 1.8 }}>{hex.image}</div>
            </div>
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Тексты линий</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {hex.linesText.map((text, idx) => (
                  <div key={idx} style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 8, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--primary)' }}>Линия {idx + 1}</div>
                    <div style={{ lineHeight: 1.6 }}>{text}</div>
                  </div>
                ))}
              </div>
            </div>
            {hex.changingTo != null && (
              <div
                className="card"
                style={{
                  padding: 20,
                  background: 'linear-gradient(135deg, var(--primary)22, var(--accent)11)',
                  border: '2px solid var(--primary)',
                  marginBottom: 16
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Переход к гексаграмме {hex.changingTo}</div>
                <div style={{ lineHeight: 1.8 }}>
                  Есть меняющиеся линии — изучите также {hex.changingTo}-ю гексаграмму как вектор сдвига ситуации.
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Спираль (и старые сохранения)
  if (testResult && selectedTest?.type === 'spiral-dynamics' && testResult.dominantLevel && testResult.levels) {
    const dominantLevel = testResult.dominantLevel;
    const levels = testResult.levels;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ClientNavbar />
        <main style={{ flex: 1, padding: '24px clamp(16px, 5vw, 48px)', maxWidth: '100%', overflowX: 'hidden' }}>
          <div className="card" style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Спиральная динамика: профиль</h2>
              <button className="button secondary" onClick={closeResult} style={{ padding: '6px 12px', fontSize: 13 }}>
                Закрыть
              </button>
            </div>
            <div
              className="card"
              style={{
                padding: 20,
                marginBottom: 24,
                background: `linear-gradient(135deg, ${dominantLevel.color}22, ${dominantLevel.color}11)`,
                border: `2px solid ${dominantLevel.color}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 999,
                    background: dominantLevel.color,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 32
                  }}
                >
                  🌀
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{dominantLevel.name}</div>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>
                    {dominantLevel.description}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 16, padding: 16, background: 'var(--surface-2)', borderRadius: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Интерпретация</div>
                <div style={{ lineHeight: 1.6 }}>{testResult.interpretation}</div>
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 18 }}>По уровням</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {levels.map((level) => {
                  const maxScore = Math.max(...levels.map((l) => l.score), 1);
                  const percentage = (level.score / maxScore) * 100;
                  const isDominant = level.id === dominantLevel.id;
                  return (
                    <div key={level.id} style={{ display: 'grid', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 999,
                              background: level.color,
                              border: isDominant ? '2px solid var(--accent)' : 'none'
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 700 }}>{level.name}</div>
                            <div className="small" style={{ color: 'var(--text-muted)' }}>
                              {level.description}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: level.color }}>{level.score}</div>
                      </div>
                      <div style={{ width: '100%', height: 8, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: '100%',
                            background: level.color,
                            transition: 'width 0.5s',
                            boxShadow: isDominant ? `0 0 12px ${level.color}66` : 'none'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (selectedTest?.type === 'i-ching') {
    if (iChingStep === 'question') {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <ClientNavbar />
          <main style={{ flex: 1, padding: '24px clamp(16px, 5vw, 48px)', maxWidth: '100%', overflowX: 'hidden' }}>
            <div className="card" style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
              <div style={{ marginBottom: 20 }}>
                <button
                  className="button secondary"
                  onClick={() => {
                    setSelectedTest(null);
                    setIChingStep('question');
                  }}
                  style={{ padding: '6px 12px', fontSize: 13 }}
                >
                  ← Назад
                </button>
              </div>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>☯️</div>
                <h2 style={{ margin: 0, marginBottom: 12 }}>И-Цзин: бросание монет</h2>
                <div className="small" style={{ color: 'var(--text-muted)' }}>
                  Шесть линий строят гексаграмму по последовательности Кинг Вэна (1–64).
                </div>
              </div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Сформулируйте вопрос</label>
              <textarea
                value={iChingQuestion}
                onChange={(e) => setIChingQuestion(e.target.value)}
                placeholder="Например: что важно учесть в моей текущей ситуации?"
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: 12,
                  border: '1px solid var(--navbar-edge, rgba(255,255,255,0.12))',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  minHeight: 120,
                  fontSize: 15,
                  fontFamily: 'inherit'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <button className="button" disabled={!iChingQuestion.trim()} onClick={() => startIChingCasting()}>
                  Начать →
                </button>
              </div>
            </div>
          </main>
        </div>
      );
    }

    if (iChingStep === 'casting') {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <ClientNavbar />
          <main
            style={{
              flex: 1,
              padding: '24px clamp(16px, 5vw, 48px)',
              maxWidth: '100%',
              overflowX: 'hidden',
              display: 'grid',
              placeItems: 'center'
            }}
          >
            <div className="card" style={{ padding: 32, maxWidth: 600, width: '100%', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 8px' }}>Линия {Math.min(iChingLines.length + (isCasting ? 0 : 1), 6)} из 6</h3>
              <div style={{ margin: '24px 0', minHeight: 120, display: 'grid', placeItems: 'center' }}>
                {isCasting ? (
                  <div style={{ fontSize: 40 }}>🪙</div>
                ) : (
                  <div style={{ fontSize: 40, opacity: 0.5 }}>🪙</div>
                )}
              </div>
              {iChingLines.length > 0 && (
                <div style={{ marginBottom: 24, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Снизу вверх</div>
                  <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 8, alignItems: 'center' }}>
                    {iChingLines.map((line, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 24 }}>{idx + 1}</span>
                        <div
                          style={{
                            width: line.isYang ? 120 : 100,
                            height: 8,
                            background: line.isYang ? 'var(--primary)' : 'transparent',
                            border: line.isYang ? 'none' : '4px solid var(--primary)'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!isCasting && iChingLines.length < 6 && (
                <button className="button" onClick={() => castNextLine()}>
                  Бросить линию
                </button>
              )}
            </div>
          </main>
        </div>
      );
    }
  }

  if (selectedTest) {
    const qs = currentQuestionsList();
    if (!qs) return null;
    const question = qs[currentQuestion];
    const totalQuestions = qs.length;
    const progress = ((currentQuestion + 1) / totalQuestions) * 100;
    const qid = question.id;
    const opts = question.options;
    const optList = Array.isArray(opts) && typeof opts[0] === 'object' && opts[0] !== null && 'text' in (opts[0] as object)
      ? (opts as { text: string }[]).map((o) => o.text)
      : (opts as string[]);

    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ClientNavbar />
        <main style={{ flex: 1, padding: '24px clamp(16px, 5vw, 48px)', maxWidth: '100%', overflowX: 'hidden' }}>
          <div className="card" style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
            <div style={{ marginBottom: 20 }}>
              <button
                className="button secondary"
                onClick={() => {
                  setSelectedTest(null);
                  setCurrentQuestion(0);
                  setAnswers({});
                }}
                style={{ padding: '6px 12px', fontSize: 13 }}
              >
                ← Назад
              </button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>{selectedTest.title}</div>
              <div style={{ width: '100%', height: 8, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                    transition: 'width 0.3s'
                  }}
                />
              </div>
              <div className="small" style={{ marginTop: 8, color: 'var(--text-muted)' }}>
                Вопрос {currentQuestion + 1} из {totalQuestions}
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 18 }}>{question.text}</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {optList.map((label, idx) => (
                  <button
                    key={idx}
                    className={answers[qid] === idx ? 'button' : 'button secondary'}
                    onClick={() => handleAnswer(qid, idx)}
                    style={{ padding: '12px 16px', textAlign: 'left', fontSize: 15 }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <button
                type="button"
                className="button secondary"
                onClick={prevQuestion}
                disabled={currentQuestion === 0}
                style={{ padding: '10px 20px' }}
              >
                ← Предыдущий вопрос
              </button>
              <button
                type="button"
                className="button"
                onClick={nextQuestion}
                disabled={answers[qid] === undefined}
                style={{ padding: '10px 20px' }}
              >
                {currentQuestion === totalQuestions - 1 ? 'Завершить' : 'Далее →'}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ClientNavbar />
      <main style={{ flex: 1, padding: '24px clamp(16px, 5vw, 48px)', maxWidth: '100%', overflowX: 'hidden' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Тесты и техники</h1>
          <p className="small" style={{ color: 'var(--text-muted)', margin: 0 }}>
            Скрининги и самонаблюдение; не заменяют консультацию специалиста.
            {canPersist && loadingSaved && ' Загрузка сохранённых результатов…'}
          </p>
          {!persistResults && (
            <p className="small" style={{ color: 'var(--accent)', marginTop: 8 }}>
              Режим гостя: результаты не сохраняются.
            </p>
          )}
        </div>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {tests.map((test) => (
            <div
              key={test.id}
              className="card card-hover-shimmer"
              style={{ padding: 16, display: 'flex', flexDirection: 'column', minHeight: 300, height: '100%' }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>{getTestIcon(test.type)}</div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{test.title}</div>
              <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 12, flex: 1 }}>
                {test.description}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                {test.questions != null && (
                  <div className="small" style={{ color: 'var(--text-muted)' }}>
                    📝 {test.questions} вопросов
                  </div>
                )}
                {test.duration != null && (
                  <div className="small" style={{ color: 'var(--text-muted)' }}>
                    ⏱ ~{test.duration} мин
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
                <button className="button" onClick={() => startTest(test)} style={{ width: '100%', padding: '10px' }}>
                  {test.completed ? 'Пройти снова' : 'Начать'}
                </button>
                {test.completed && latestByType[test.type] && (
                  <button className="button secondary" onClick={() => viewSavedResult(test)} style={{ width: '100%', padding: '8px' }}>
                    Последний сохранённый результат
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
