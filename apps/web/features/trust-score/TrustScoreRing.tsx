'use client';

import { scoreBand, type ScoreBand } from '@vp/shared';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';
import { cn } from '@/utils/cn';
import { BAND_LABEL } from '@/utils/status';

const BAND_COLOR: Record<ScoreBand, string> = { green: 'var(--color-success)', amber: 'var(--color-warning)', red: 'var(--color-danger)' };

export interface TrustScoreRingProps {
  score: number | null | undefined;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showBandLabel?: boolean;
  className?: string;
}

/** SVG ring that fills to the score. Colour is the band (green/amber/red). */
export function TrustScoreRing({ score, size = 160, strokeWidth = 12, label = 'Trust score', showBandLabel = true, className }: TrustScoreRingProps) {
  const reduced = useReducedMotion();
  const value = score ?? 0;
  const band = scoreBand(value);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useMotionValue(reduced ? value : 0);
  const dashOffset = useTransform(progress, (v) => circumference * (1 - v / 100));
  const [display, setDisplay] = useState(reduced ? Math.round(value) : 0);

  useEffect(() => {
    if (reduced) {
      progress.set(value);
      setDisplay(Math.round(value));
      return;
    }
    const controls = animate(progress, value, {
      duration: 0.8,
      ease: [0.2, 0, 0, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, progress, reduced]);

  return (
    <div className={cn('inline-flex flex-col items-center', className)} data-testid="trust-score-ring" data-score={value} data-band={band}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${score ?? 'not available'} out of 100`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-line-soft)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={score === null || score === undefined ? 'var(--color-line)' : BAND_COLOR[band]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashOffset, rotate: -90, transformOrigin: '50% 50%' }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="tabular fill-[var(--color-ink)]" style={{ fontSize: size * 0.26, fontWeight: 600, letterSpacing: '-0.02em' }}>
          {score === null || score === undefined ? '—' : display}
        </text>
      </svg>
      <div className="-mt-1 text-center">
        <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-muted">{label}</p>
        {showBandLabel && score !== null && score !== undefined ? (
          <p className="text-[13px] font-medium" style={{ color: BAND_COLOR[band] }}>
            {BAND_LABEL[band]}
          </p>
        ) : null}
      </div>
    </div>
  );
}
