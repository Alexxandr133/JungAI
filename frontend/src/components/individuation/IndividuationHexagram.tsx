import { useMemo } from 'react';
import {
  COMPENSATION_AXES,
  INDIVIDUATION_STAGES,
  allStageVertices,
  integrationRayLength,
  type IndividuationHexResult,
  type StageId,
  type StageProfile,
  type ViewMode,
} from '../../data/individuationModel';
import './IndividuationHexagram.css';

const CX = 160;
const CY = 160;
const R = 118;

type Props = {
  result?: IndividuationHexResult | null;
  viewMode?: ViewMode;
  activeStage?: StageId | null;
  onStageClick?: (id: StageId) => void;
  animated?: boolean;
  progressStageIndex?: number;
  size?: number;
};

function profileFor(profiles: StageProfile[], id: StageId): StageProfile {
  return profiles.find((s) => s.stage === id) ?? { stage: id, D: 33, F: 33, I: 34 };
}

function pointOnRay(stageId: StageId, len: number, vertices: ReturnType<typeof allStageVertices>) {
  const v = vertices.find((x) => x.stage.id === stageId)!;
  return {
    x: CX + (v.x - CX) * len,
    y: CY + (v.y - CY) * len,
    vertex: v,
  };
}

export function IndividuationHexagram({
  result,
  viewMode = 'overview',
  activeStage,
  onStageClick,
  animated = false,
  progressStageIndex,
  size = 420,
}: Props) {
  const hasResult = !!result?.stages?.length;
  const stageProfiles = result?.stages ?? INDIVIDUATION_STAGES.map((s) => ({
    stage: s.id,
    D: 33,
    F: 33,
    I: 34,
  }));

  const vertices = useMemo(() => allStageVertices(CX, CY, R), []);
  const hexOutline = vertices.map((v) => `${v.x},${v.y}`).join(' ');
  const ascTriangle = [0, 1, 2].map((i) => vertices[i]);
  const descTriangle = [3, 4, 5].map((i) => vertices[i]);

  function rayData(stageId: StageId) {
    const prof = profileFor(stageProfiles, stageId);
    const len = hasResult ? integrationRayLength(prof) : 0.5;
    const tip = pointOnRay(stageId, len, vertices);
    return { prof, len, tip };
  }

  function stageVisual(prof: StageProfile) {
    const deficit = prof.D > prof.I && prof.D >= prof.F;
    const fixation = prof.F > prof.I && prof.F > prof.D;
    const opacity = fixation
      ? Math.max(0.6, 0.45 + (prof.I / 100) * 0.4)
      : deficit
        ? Math.max(0.55, 0.4 + (prof.I / 100) * 0.35)
        : Math.max(0.82, 0.65 + (prof.I / 100) * 0.35);
    return { opacity, deficit, fixation };
  }

  return (
    <svg
      viewBox="0 0 320 320"
      className={`ind-hex ${animated ? 'ind-hex--animated' : ''} ${hasResult ? 'ind-hex--result' : ''}`}
      style={{ width: size, height: size }}
      aria-label="Гексаграмма индивидуации"
    >
      <polygon points={hexOutline} className="ind-hex__outline" />

      <polygon
        points={ascTriangle.map((v) => `${v.x},${v.y}`).join(' ')}
        className="ind-hex__triangle ind-hex__triangle--asc"
      />
      <polygon
        points={descTriangle.map((v) => `${v.x},${v.y}`).join(' ')}
        className="ind-hex__triangle ind-hex__triangle--desc"
      />

      {COMPENSATION_AXES.map((axis) => {
        const a = vertices.find((v) => v.stage.id === axis.poleA)!;
        const b = vertices.find((v) => v.stage.id === axis.poleB)!;
        const tension = result?.axisTension?.[axis.id] ?? 0;
        return (
          <line
            key={axis.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            className={viewMode === 'axes' ? 'ind-hex__axis ind-hex__axis--active' : 'ind-hex__axis'}
            strokeOpacity={viewMode === 'axes' ? 0.35 + Math.min(tension / 80, 0.5) : 0.1}
          />
        );
      })}

      <circle cx={CX} cy={CY} r={28} className="ind-hex__center" />
      <text x={CX} y={CY + 4} textAnchor="middle" className="ind-hex__center-label">
        ∅
      </text>

      {vertices.map((v) => (
        <line
          key={`spoke-${v.stage.id}`}
          x1={CX}
          y1={CY}
          x2={v.x}
          y2={v.y}
          className="ind-hex__spoke"
          stroke={v.stage.color}
        />
      ))}

      {vertices.map((v) => (
        <circle
          key={`target-${v.stage.id}`}
          cx={v.x}
          cy={v.y}
          r={8}
          className="ind-hex__vertex-target"
          stroke={v.stage.color}
        />
      ))}

      {INDIVIDUATION_STAGES.map((stage, i) => {
        const { prof, len, tip } = rayData(stage.id);
        const vis = stageVisual(prof);
        const isActive = activeStage === stage.id;
        const isProgress = progressStageIndex !== undefined && i <= progressStageIndex;
        const showShadow = viewMode === 'shadow' && (vis.deficit || vis.fixation);
        const nodeR = Math.max(11, Math.min(16, 9 + len * 8));

        if (viewMode === 'shadow' && !showShadow) return null;

        const labelPos = tip.vertex;

        return (
          <g key={stage.id}>
            <line
              x1={CX}
              y1={CY}
              x2={tip.x}
              y2={tip.y}
              stroke={stage.color}
              strokeWidth={6}
              strokeLinecap="round"
              strokeOpacity={vis.opacity}
              className={`ind-hex__ray ${vis.fixation ? 'ind-hex__ray--fixation' : ''} ${vis.deficit ? 'ind-hex__ray--deficit' : ''} ${isProgress ? 'ind-hex__ray--lit' : ''} ${isActive ? 'ind-hex__ray--active' : ''}`}
              strokeDasharray={vis.deficit ? '10 6' : undefined}
            />
            <g
              style={{ cursor: onStageClick ? 'pointer' : undefined }}
              onClick={() => onStageClick?.(stage.id)}
              role={onStageClick ? 'button' : undefined}
            >
              <circle
                cx={tip.x}
                cy={tip.y}
                r={isActive ? nodeR + 3 : nodeR}
                fill={stage.color}
                fillOpacity={vis.fixation ? 0.92 : vis.opacity}
                stroke={isActive ? '#fff' : 'rgba(255,255,255,0.3)'}
                strokeWidth={isActive ? 2.5 : 1.5}
                className={`ind-hex__node ${isActive ? 'ind-hex__node--active' : ''} ${vis.fixation ? 'ind-hex__node--fixation' : ''}`}
              />
              {isActive && hasResult && (
                <text x={tip.x} y={tip.y - nodeR - 8} textAnchor="middle" className="ind-hex__node-i">
                  I {prof.I}%
                </text>
              )}
              <text
                x={labelPos.x}
                y={labelPos.y + (labelPos.y > CY ? 24 : -14)}
                textAnchor="middle"
                className="ind-hex__node-label"
              >
                {isActive ? stage.id : stage.label.split(' ')[0]}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

export function HexProgressRing({ current, total, size = 48 }: { current: number; total: number; size?: number }) {
  const vertices = allStageVertices(size / 2, size / 2, size / 2 - 4);
  const filled = Math.floor((current / total) * 6);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ind-hex-progress">
      {vertices.map((v, i) => (
        <line
          key={i}
          x1={size / 2}
          y1={size / 2}
          x2={v.x}
          y2={v.y}
          className={i < filled ? 'ind-hex-progress__spoke lit' : 'ind-hex-progress__spoke'}
        />
      ))}
    </svg>
  );
}
