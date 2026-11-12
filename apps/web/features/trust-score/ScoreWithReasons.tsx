'use client';

import type { Finding } from '@vp/shared';
import { CheckCircle2 } from 'lucide-react';
import { FindingCard } from '@/features/findings/FindingCard';
import { TrustScoreRing } from './TrustScoreRing';

export function ScoreWithReasons({
  score,
  findings,
  documentHref,
  title = 'Trust score',
  compact,
}: {
  score: number | null | undefined;
  findings: Finding[];
  documentHref?: (documentId: string) => string;
  title?: string;
  compact?: boolean;
}) {
  const deductions = findings.filter((f) => f.deduction > 0);
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="flex shrink-0 justify-center md:w-48">
        <TrustScoreRing score={score} label={title} size={compact ? 140 : 176} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[13px] font-medium uppercase tracking-[0.05em] text-muted">Why this score</h3>
          {deductions.length > 0 ? (
            <span className="tabular text-[12px] text-muted">
              {deductions.length} deduction{deductions.length === 1 ? '' : 's'} · −{deductions.reduce((s, f) => s + f.deduction, 0)}
            </span>
          ) : null}
        </div>
        {deductions.length === 0 ? (
          <div className="flex items-center gap-2 rounded-card border border-success/30 bg-success-soft px-4 py-3 text-[13px] text-success">
            <CheckCircle2 className="size-4" aria-hidden /> No issues found across the documents.
          </div>
        ) : (
          <ul className="space-y-2" data-testid="score-reasons">
            {deductions.map((f, i) => (
              <li key={`${f.rule}-${i}`}>
                <FindingCard finding={f} documentHref={documentHref} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
