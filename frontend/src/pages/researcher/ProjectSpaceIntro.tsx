import { useEffect, useRef, useState } from 'react';
import './ProjectSpaceIntro.css';

type Props = {
  onComplete: () => void;
};

type Star = { x: number; y: number; z: number; r: number };

const TITLE = 'SPACE';
const LOADING_LINES = [
  'Подключение к проекту…',
  'Загрузка материалов…',
  'Подготовка рабочей области…',
];
const SUBTITLE = 'Исследовательская среда';

export function ProjectSpaceIntro({ onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [letterCount, setLetterCount] = useState(0);
  const [lineCount, setLineCount] = useState(0);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  useEffect(() => {
    const timers: number[] = [];
    const schedule = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    schedule(() => setLetterCount(1), 350);
    schedule(() => setLetterCount(2), 500);
    schedule(() => setLetterCount(3), 650);
    schedule(() => setLetterCount(4), 800);
    schedule(() => setLetterCount(5), 950);

    schedule(() => setLineCount(1), 1200);
    schedule(() => setLineCount(2), 1750);
    schedule(() => setLineCount(3), 2300);
    schedule(() => setShowSubtitle(true), 2850);

    schedule(() => setPhase('out'), 3400);
    schedule(onComplete, 4000);

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let stars: Star[] = [];

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      stars = Array.from({ length: 280 }, () => ({
        x: Math.random() * canvas!.width,
        y: Math.random() * canvas!.height,
        z: Math.random() * 1.5 + 0.2,
        r: Math.random() * 1.6 + 0.3,
      }));
    }

    function draw() {
      ctx!.fillStyle = '#030712';
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);

      for (const s of stars) {
        s.y += s.z * 0.35;
        if (s.y > canvas!.height) {
          s.y = 0;
          s.x = Math.random() * canvas!.width;
        }
        const alpha = 0.35 + s.z * 0.45;
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(220, 230, 255, ${alpha})`;
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className={`project-space-intro project-space-intro--${phase}`} aria-hidden>
      <canvas ref={canvasRef} className="project-space-intro__canvas" />
      <div className={`project-space-intro__glow${letterCount > 0 ? ' project-space-intro__glow--on' : ''}`} />

      <div className="project-space-intro__content">
        <h1 className="project-space-intro__title" aria-label="SPACE">
          {TITLE.split('').map((ch, i) => (
            <span
              key={i}
              className={`project-space-intro__letter${i < letterCount ? ' project-space-intro__letter--on' : ''}`}
            >
              {ch}
            </span>
          ))}
        </h1>

        <ul className="project-space-intro__steps">
          {LOADING_LINES.map((line, i) => (
            <li
              key={line}
              className={`project-space-intro__step${i < lineCount ? ' project-space-intro__step--on' : ''}`}
            >
              {line}
            </li>
          ))}
        </ul>

        <p className={`project-space-intro__subtitle${showSubtitle ? ' project-space-intro__subtitle--on' : ''}`}>
          {SUBTITLE}
        </p>
      </div>
    </div>
  );
}
