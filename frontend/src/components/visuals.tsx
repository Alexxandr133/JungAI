import React from 'react';

export const TrendSparkline: React.FC<{
  data: number[];
  color?: string;
  height?: number;
  strokeWidth?: number;
  showArea?: boolean;
  showDots?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
}>
  = ({
  data,
  color = '#19e0ff',
  height = 40,
  strokeWidth = 2,
  showArea = true,
  showDots = true,
  gradientFrom = 'rgba(25,224,255,0.35)',
  gradientTo = 'rgba(25,224,255,0)'
}) => {
  if (!data.length) return <div style={{ height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const paddingY = 6; // add vertical breathing room
  const range = Math.max(1, max - min);

  // Map data points to SVG coordinates (0..100)
  const points: { x: number; y: number }[] = data.map((v, i) => ({
    x: (i / Math.max(1, data.length - 1)) * 100,
    y: 100 - (((v - min) / range) * (100 - paddingY * 2) + paddingY)
  }));

  // Build a smooth path using quadratic Bézier through midpoints
  const buildSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;
      d += ` Q ${curr.x},${curr.y} ${midX},${midY}`;
    }
    // Connect the last midpoint to the last point
    d += ` T ${pts[pts.length - 1].x},${pts[pts.length - 1].y}`;
    return d;
  };

  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L 100,100 L 0,100 Z`;

  const gridLines = 4; // horizontal grid lines
  const gridYs = Array.from({ length: gridLines + 1 }, (_, i) => (i / gridLines) * 100);

  const gradientId = `trendGrad-${Math.abs(color.split('').reduce((a, c) => a + c.charCodeAt(0), 0))}`;

  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height, overflow: 'visible' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={gradientFrom} />
          <stop offset="100%" stopColor={gradientTo} />
        </linearGradient>
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* subtle grid */}
      {gridYs.map((y, idx) => (
        <line key={idx} x1={0} x2={100} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
      ))}

      {/* filled area */}
      {showArea && (
        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      )}

      {/* soft glow underline for depth */}
      <path d={linePath} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={strokeWidth + 2} filter="url(#softGlow)" />

      {/* main line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={strokeWidth} />

      {/* dots */}
      {showDots && points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.4} fill={color} />
      ))}
    </svg>
  );
};

export const SymbolCloud: React.FC<{ items: { label: string; value: number }[] }>
  = ({ items }) => {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {items.map(i => (
        <span key={i.label} style={{ fontWeight: 800, fontSize: `${12 + (i.value / max) * 16}px`, color: 'var(--accent)' }}>{i.label}</span>
      ))}
    </div>
  );
};

export const Heatmap: React.FC<{ matrix: number[][]; rows?: string[]; cols?: string[] }>
  = ({ matrix, rows = [], cols = [] }) => {
  const flat = matrix.flat();
  const max = Math.max(1, ...flat);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${matrix[0]?.length || 0}, 1fr)` }}>
      <div />
      {cols.map(c => <div key={c} className="small" style={{ textAlign: 'center' }}>{c}</div>)}
      {matrix.map((row, ri) => (
        <React.Fragment key={ri}>
          <div className="small" style={{ display: 'flex', alignItems: 'center' }}>{rows[ri] || ''}</div>
          {row.map((v, ci) => (
            <div key={ci} style={{ height: 22, borderRadius: 6, margin: 2, background: `rgba(124,92,255,${0.15 + 0.7 * (v / max)})` }} />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

export const OceanBackground: React.FC<{ opacity?: number }>
  = ({ opacity = 0.9 }) => {
  const waveColorTop = 'rgba(0, 163, 255, 0.28)';
  const waveColorMid = 'rgba(0, 133, 235, 0.24)';
  const waveColorDeep = 'rgba(0, 93, 205, 0.22)';
  const gradientFrom = 'rgba(0, 39, 84, 1)';
  const gradientTo = 'rgba(0, 15, 38, 1)';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', opacity }}>
      {/* Deep ocean vertical gradient */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />

      {/* Caustics light shimmer */}
      <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: 0.12, backgroundImage: 'radial-gradient(circle at 20% 10%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 40%), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 40%), radial-gradient(circle at 50% 70%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 42%)' }} />

      {/* Animated waves using wide SVGs sliding horizontally */}
      <style>
        {`
        @keyframes waveSlide {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}
      </style>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '48vh' }}>
        {/* Back layer */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '40vh', opacity: 0.7 }}>
          <div style={{ position: 'absolute', width: '200%', height: '100%', animation: 'waveSlide 22s linear infinite' }}>
            <svg viewBox="0 0 1200 300" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, width: '50%', height: '100%' }}>
              <path d="M0,160 C150,120 350,200 600,160 C850,120 1050,200 1200,160 L1200,300 L0,300 Z" fill={waveColorDeep} />
            </svg>
            <svg viewBox="0 0 1200 300" preserveAspectRatio="none" style={{ position: 'absolute', left: '50%', width: '50%', height: '100%' }}>
              <path d="M0,160 C150,120 350,200 600,160 C850,120 1050,200 1200,160 L1200,300 L0,300 Z" fill={waveColorDeep} />
            </svg>
          </div>
        </div>

        {/* Mid layer */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '34vh', opacity: 0.8 }}>
          <div style={{ position: 'absolute', width: '200%', height: '100%', animation: 'waveSlide 16s linear infinite' }}>
            <svg viewBox="0 0 1200 300" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, width: '50%', height: '100%' }}>
              <path d="M0,180 C180,140 420,230 600,200 C780,170 1020,240 1200,210 L1200,300 L0,300 Z" fill={waveColorMid} />
            </svg>
            <svg viewBox="0 0 1200 300" preserveAspectRatio="none" style={{ position: 'absolute', left: '50%', width: '50%', height: '100%' }}>
              <path d="M0,180 C180,140 420,230 600,200 C780,170 1020,240 1200,210 L1200,300 L0,300 Z" fill={waveColorMid} />
            </svg>
          </div>
        </div>

        {/* Top layer */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '28vh' }}>
          <div style={{ position: 'absolute', width: '200%', height: '100%', animation: 'waveSlide 10s linear infinite' }}>
            <svg viewBox="0 0 1200 300" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, width: '50%', height: '100%' }}>
              <path d="M0,200 C220,180 420,240 600,220 C780,200 980,240 1200,230 L1200,300 L0,300 Z" fill={waveColorTop} />
            </svg>
            <svg viewBox="0 0 1200 300" preserveAspectRatio="none" style={{ position: 'absolute', left: '50%', width: '50%', height: '100%' }}>
              <path d="M0,200 C220,180 420,240 600,220 C780,200 980,240 1200,230 L1200,300 L0,300 Z" fill={waveColorTop} />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};