import { Link } from 'react-router-dom';

const LOGO_SRC = '/jungai-logo.png';

type BrandLogoProps = {
  to: string;
  /** Высота значка (рядом подпись JungAI) */
  height?: number;
};

export function BrandLogo({ to, height = 64 }: BrandLogoProps) {
  return (
    <Link
      to={to}
      aria-label="JungAI"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        textDecoration: 'none',
        color: 'inherit'
      }}
    >
      <img
        src={LOGO_SRC}
        alt=""
        aria-hidden
        height={height}
        width="auto"
        style={{ height, width: 'auto', display: 'block', objectFit: 'contain', flexShrink: 0 }}
        decoding="async"
      />
      <span
        style={{
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: 'var(--text)',
          lineHeight: 1.1,
          whiteSpace: 'nowrap'
        }}
      >
        JungAI
      </span>
    </Link>
  );
}
