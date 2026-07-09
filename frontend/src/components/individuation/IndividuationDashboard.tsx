import { useState } from 'react';
import {
  COMPENSATION_AXES,
  INDIVIDUATION_STAGES,
  type IndividuationHexResult,
  type StageId,
  type ViewMode,
} from '../../data/individuationModel';
import { IndividuationHexagram } from './IndividuationHexagram';
import './IndividuationDashboard.css';

type Props = {
  result: IndividuationHexResult;
  onRetake?: () => void;
};

export function IndividuationDashboard({ result, onRetake }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [activeStage, setActiveStage] = useState<StageId | null>(null);
  const [openAxis, setOpenAxis] = useState<string | null>(null);

  const domFix = INDIVIDUATION_STAGES.find((s) => s.id === result.dominantFixation);
  const domDef = INDIVIDUATION_STAGES.find((s) => s.id === result.dominantDeficit);
  const growth = INDIVIDUATION_STAGES.find((s) => s.id === result.growthPoint);
  const active = activeStage ? INDIVIDUATION_STAGES.find((s) => s.id === activeStage) : null;
  const activeProf = activeStage ? result.stages.find((s) => s.stage === activeStage) : null;

  return (
    <div className="ind-dash">
      <div className="ind-dash__top">
        <div className="ind-dash__viz card">
          <div className="ind-dash__modes">
            {(['overview', 'axes', 'shadow'] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={viewMode === m ? 'ind-dash__mode active' : 'ind-dash__mode'}
                onClick={() => setViewMode(m)}
              >
                {m === 'overview' ? 'Обзор' : m === 'axes' ? 'Оси' : 'Тень'}
              </button>
            ))}
          </div>
          <IndividuationHexagram
            result={result}
            viewMode={viewMode}
            activeStage={activeStage}
            onStageClick={setActiveStage}
            animated
            size={460}
          />
          <p className="ind-dash__viz-hint small">
            Длина луча зависит от D/I/F: интеграция до вершины, фиксация за пределы гексаграммы, дефицит — пунктир.
            Кликните стадию для метрик.
          </p>
        </div>

        <div className="ind-dash__metrics card">
          <h3>Метрики профиля</h3>
          <div className="ind-dash__metric">
            <span className="ind-dash__metric-label">Доминанта (фиксация)</span>
            <strong style={{ color: domFix?.color }}>{domFix?.label ?? '—'}</strong>
          </div>
          <div className="ind-dash__metric">
            <span className="ind-dash__metric-label">Тень (дефицит)</span>
            <strong style={{ color: domDef?.color }}>{domDef?.label ?? '—'}</strong>
          </div>
          <div className="ind-dash__metric">
            <span className="ind-dash__metric-label">Точка роста</span>
            <strong style={{ color: growth?.color }}>{growth?.label ?? '—'}</strong>
          </div>
          <p className="ind-dash__interp">{result.interpretation}</p>
          {onRetake && (
            <button type="button" className="button secondary" onClick={onRetake} style={{ marginTop: 12 }}>
              Пройти снова
            </button>
          )}
        </div>
      </div>

      {active && activeProf && (
        <div className="ind-dash__stage-detail card">
          <h3>{active.label}</h3>
          <p className="small">{active.focus}</p>
          <div className="ind-dash__bars">
            <div><span>D (дефицит)</span><div className="bar"><i style={{ width: `${activeProf.D}%`, background: active.color, opacity: 0.4 }} /></div><span>{activeProf.D}%</span></div>
            <div><span>F (фиксация)</span><div className="bar"><i style={{ width: `${activeProf.F}%`, background: active.color, opacity: 0.75 }} /></div><span>{activeProf.F}%</span></div>
            <div><span>I (интеграция)</span><div className="bar"><i style={{ width: `${activeProf.I}%`, background: active.color }} /></div><span>{activeProf.I}%</span></div>
          </div>
        </div>
      )}

      <section className="ind-dash__axes card">
        <h3>Оси компенсаций</h3>
        {COMPENSATION_AXES.map((axis) => (
          <div key={axis.id} className="ind-dash__accordion">
            <button type="button" className="ind-dash__accordion-head" onClick={() => setOpenAxis(openAxis === axis.id ? null : axis.id)}>
              <span>{axis.label}</span>
              <span>{openAxis === axis.id ? '−' : '+'}</span>
            </button>
            {openAxis === axis.id && (
              <div className="ind-dash__accordion-body">
                <p><strong>Конфликт:</strong> {axis.conflict}</p>
                <p><strong>Функция:</strong> {axis.jungFunction}</p>
                <p><strong>Индивидуация:</strong> {axis.individuationGoal}</p>
                <p className="small">Напряжение оси: {Math.round(result.axisTension[axis.id] ?? 0)}</p>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
