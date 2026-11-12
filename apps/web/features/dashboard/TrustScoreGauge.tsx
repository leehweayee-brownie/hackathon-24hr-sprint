import { cn } from '@/utils/cn';

/**
 * Figma "Trust score" ring: gray-100 track, arc from 12 o'clock clockwise with round caps, length = score / 100.
 * Dashboard: 178.871px, 14.5px stroke, 53px score. Passport: 152px ring, same proportions, 36px score.
 */
const ARC_COLOR = { red: '#e32526', amber: '#f59e0b', teal: '#14b8a6' } as const;

export function TrustScoreGauge({
  score,
  tone,
  size = 178.871,
  scoreClassName = 'text-[53.178px] leading-[67.681px]',
}: {
  score: number | null;
  tone: keyof typeof ARC_COLOR;
  size?: number;
  scoreClassName?: string;
}) {
  const stroke = size * (14.5031 / 178.871);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = score === null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={score === null ? 'Trust score not available' : `Trust score ${value} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        {value > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ARC_COLOR[tone]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * c} ${c}`}
            className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
          />
        ) : null}
      </svg>
      <span className={cn('tabular absolute inset-0 flex items-center justify-center font-bold text-gray-900', scoreClassName)}>{score === null ? '–' : value}</span>
    </div>
  );
}
