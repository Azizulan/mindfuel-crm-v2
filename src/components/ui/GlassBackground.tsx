import React from 'react';

/**
 * Animated SVG gradient backdrop — floating coloured blobs with subtle drift.
 * Renders once at the app shell as a fixed full-viewport layer behind everything.
 * The frosted glass surfaces refract this through `backdrop-filter: blur`.
 */
const GlassBackground: React.FC = () => (
  <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-background">
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 1600 1000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full"
    >
      <defs>
        <linearGradient id="gbg_g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 0.85 }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-chart-3)', stopOpacity: 0.55 }} />
        </linearGradient>
        <linearGradient id="gbg_g2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'var(--color-chart-4)', stopOpacity: 0.9 }} />
          <stop offset="50%" style={{ stopColor: 'var(--color-chart-2)', stopOpacity: 0.65 }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-chart-1)', stopOpacity: 0.6 }} />
        </linearGradient>
        <radialGradient id="gbg_g3" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: 'var(--color-destructive)', stopOpacity: 0.8 }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-chart-5)', stopOpacity: 0.35 }} />
        </radialGradient>
        <filter id="gbg_b1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60" /></filter>
        <filter id="gbg_b2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="45" /></filter>
        <filter id="gbg_b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="80" /></filter>
      </defs>
      <g className="glass-bg-blob-1">
        <ellipse cx="280" cy="850" rx="420" ry="300" fill="url(#gbg_g1)" filter="url(#gbg_b1)" transform="rotate(-30 280 850)" />
        <rect x="1050" y="120" width="500" height="380" rx="120" fill="url(#gbg_g2)" filter="url(#gbg_b2)" transform="rotate(15 1300 310)" />
      </g>
      <g className="glass-bg-blob-2">
        <circle cx="1320" cy="780" r="260" fill="url(#gbg_g3)" filter="url(#gbg_b3)" opacity="0.65" />
        <ellipse cx="80" cy="220" rx="320" ry="200" fill="var(--color-accent)" filter="url(#gbg_b2)" opacity="0.7" />
        <ellipse cx="800" cy="450" rx="280" ry="180" fill="url(#gbg_g2)" filter="url(#gbg_b3)" opacity="0.35" />
      </g>
    </svg>
  </div>
);

export default GlassBackground;
