import { useMemo } from 'react';
import {
  COMPENSATION_AXES,
  INDIVIDUATION_STAGES,
  allStageVertices,
  computeRayRender,
  selfCenterFromStages,
  type IndividuationHexResult,
  type StageId,
  type StageProfile,
  type ViewMode,
} from '../../data/individuationModel';
import './IndividuationHexagram.css';

const CX = 160;
const CY = 160;
const R = 118;
const R_OUTER = 148;
const R_UROBOROS = R * 1.28;

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

function stageVertexOuter(stageId: StageId) {
  const stage = INDIVIDUATION_STAGES.find((s) => s.id === stageId)!;
  const angle = -Math.PI / 2 + (Math.PI / 3) * stage.ccwIndex;
  return {
    x: CX + R_OUTER * Math.cos(angle),
    y: CY + R_OUTER * Math.sin(angle),
  };
}

/** Дуга S1 → S2 → … → S6 против часовой */
function ccwArcPath(): string {
  const start = stageVertexOuter('S1');
  const end = stageVertexOuter('S6');
  return `M ${start.x} ${start.y} A ${R_OUTER} ${R_OUTER} 0 1 0 ${end.x} ${end.y}`;
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
  const willTriangle = ['S1', 'S2', 'S3'].map((id) => vertices.find((v) => v.stage.id === id)!);
  const meaningTriangle = ['S4', 'S5', 'S6'].map((id) => vertices.find((v) => v.stage.id === id)!);
  const centerMeta = selfCenterFromStages(stageProfiles);

  function rayData(stageId: StageId) {
    const prof = profileFor(stageProfiles, stageId);
    const render = computeRayRender(prof, hasResult);
    const tip = pointOnRay(stageId, render.lengthFactor, vertices);
    return { prof, render, tip };
  }

  return (
    <svg
      viewBox="0 0 320 320"
      className={`ind-hex ${animated ? 'ind-hex--animated' : ''} ${hasResult ? 'ind-hex--result' : ''}`}
      style={{ width: size, height: size }}
      aria-label="Гексаграмма индивидуации — шесть стадий спиральной динамики"
    >
      <defs>
        {INDIVIDUATION_STAGES.map((stage) => (
          <linearGradient
            key={`grad-${stage.id}`}
            id={`ind-ray-grad-${stage.id}`}
            x1={CX}
            y1={CY}
            x2={vertices.find((v) => v.stage.id === stage.id)!.x}
            y2={vertices.find((v) => v.stage.id === stage.id)!.y}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={stage.color} stopOpacity="0.25" />
            <stop offset="55%" stopColor={stage.color} stopOpacity="0.75" />
            <stop offset="100%" stopColor={stage.color} stopOpacity="1" />
          </linearGradient>
        ))}
        <radialGradient id="ind-center-gold" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 248, 220, 0.95)" />
          <stop offset="45%" stopColor="rgba(212, 175, 55, 0.55)" />
          <stop offset="100%" stopColor="rgba(15, 23, 42, 0.2)" />
        </radialGradient>
        <marker id="ind-ccw-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="rgba(212, 175, 55, 0.75)" />
        </marker>
      </defs>

      <circle cx={CX} cy={CY} r={R_UROBOROS} className="ind-hex__uroboros" fill="none" />

      <path d={ccwArcPath()} className="ind-hex__ccw-arc" markerEnd="url(#ind-ccw-arrow)" fill="none" />
      <text x={CX} y={CY + R_OUTER + 16} textAnchor="middle" className="ind-hex__ccw-label">
        ↺ S1 → S6 против часовой
      </text>

      <polygon points={hexOutline} className="ind-hex__outline" />

      <polygon
        points={willTriangle.map((v) => `${v.x},${v.y}`).join(' ')}
        className="ind-hex__triangle ind-hex__triangle--will"
      />
      <text
        x={(willTriangle[0].x + willTriangle[2].x) / 2 + 18}
        y={(willTriangle[0].y + willTriangle[2].y) / 2}
        className="ind-hex__triangle-label ind-hex__triangle-label--will"
      >
        Воля · S1→S3
      </text>

      <polygon
        points={meaningTriangle.map((v) => `${v.x},${v.y}`).join(' ')}
        className="ind-hex__triangle ind-hex__triangle--meaning"
      />
      <text
        x={(meaningTriangle[0].x + meaningTriangle[2].x) / 2 - 18}
        y={(meaningTriangle[0].y + meaningTriangle[2].y) / 2}
        className="ind-hex__triangle-label ind-hex__triangle-label--meaning"
      >
        Смысл · S4→S6
      </text>

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
            strokeOpacity={
              viewMode === 'axes' ? 0.35 + Math.min(tension / 80, 0.5) : viewMode === 'overview' ? 0.14 : 0.06
            }
          />
        );
      })}

      <circle
        cx={CX}
        cy={CY}
        r={centerMeta.radius}
        fill="url(#ind-center-gold)"
        className={`ind-hex__center ${centerMeta.dispersed ? 'ind-hex__center--dispersed' : 'ind-hex__center--balanced'}`}
        style={{ opacity: centerMeta.glow }}
      />
      <text x={CX} y={CY + 5} textAnchor="middle" className="ind-hex__center-label">
        ∅
      </text>
      <text x={CX} y={CY + 20} textAnchor="middle" className="ind-hex__center-sublabel">
        Самость
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
          r={7}
          className="ind-hex__vertex-target"
          stroke={v.stage.color}
        />
      ))}

      {INDIVIDUATION_STAGES.map((stage, i) => {
        const { prof, render, tip } = rayData(stage.id);
        const isActive = activeStage === stage.id;
        const isDimmed = !!activeStage && !isActive;
        const isProgress = progressStageIndex !== undefined && i <= progressStageIndex;
        const showShadow = viewMode === 'shadow' && (render.deficit || render.fixation);

        if (viewMode === 'shadow' && !showShadow) return null;

        const labelPos = tip.vertex;
        const nodeR = Math.max(9, Math.min(14, 7 + render.lengthFactor * 6));
        const ccwDelay = animated ? `${i * 0.1}s` : undefined;

        return (
          <g
            key={stage.id}
            className={`ind-hex__stage-group${isDimmed ? ' ind-hex__stage-group--dim' : ''}`}
            style={ccwDelay ? { animationDelay: ccwDelay } : undefined}
          >
            <line
              x1={CX}
              y1={CY}
              x2={tip.x}
              y2={tip.y}
              stroke={`url(#ind-ray-grad-${stage.id})`}
              strokeWidth={isActive ? 7 : 6}
              strokeLinecap="round"
              strokeOpacity={render.opacity}
              style={{ filter: render.filter }}
              className={`ind-hex__ray ${render.fixation ? 'ind-hex__ray--fixation' : ''} ${render.deficit ? 'ind-hex__ray--deficit' : ''} ${render.breathe ? 'ind-hex__ray--breathe' : ''} ${isProgress ? 'ind-hex__ray--lit' : ''} ${isActive ? 'ind-hex__ray--active' : ''} ${animated ? 'ind-hex__ray--ccw-in' : ''}`}
              strokeDasharray={render.dash}
            />
            <g
              style={{ cursor: onStageClick ? 'pointer' : undefined, filter: render.filter }}
              onClick={() => onStageClick?.(stage.id)}
              role={onStageClick ? 'button' : undefined}
            >
              <circle
                cx={tip.x}
                cy={tip.y}
                r={isActive ? nodeR + 3 : nodeR}
                fill={stage.color}
                fillOpacity={render.opacity}
                stroke={isActive ? '#fff' : 'rgba(255,255,255,0.35)'}
                strokeWidth={isActive ? 2.5 : 1.5}
                className={`ind-hex__node ${isActive ? 'ind-hex__node--active' : ''} ${render.fixation ? 'ind-hex__node--fixation' : ''}`}
              />
              {isActive && hasResult && (
                <text x={tip.x} y={tip.y - nodeR - 10} textAnchor="middle" className="ind-hex__node-metrics">
                  D {prof.D}% · F {prof.F}% · I {prof.I}%
                </text>
              )}
              <text
                x={labelPos.x}
                y={labelPos.y + (labelPos.y > CY ? 26 : -16)}
                textAnchor="middle"
                className="ind-hex__node-label"
              >
                {stage.id}
              </text>
              <text
                x={labelPos.x}
                y={labelPos.y + (labelPos.y > CY ? 38 : -4)}
                textAnchor="middle"
                className="ind-hex__node-sd"
              >
                {stage.sdLevel}
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
