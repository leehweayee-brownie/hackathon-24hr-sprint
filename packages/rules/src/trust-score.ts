import { Finding, SEVERITY_ORDER, TrustScoreResult, scoreBand } from '@vp/shared';

/** Deterministic score: 100 minus every deduction, floored at 0. */
export function computeTrustScore(findings: Finding[]): TrustScoreResult {
  const deductions = [...findings]
    .filter((f) => f.deduction > 0)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.deduction - a.deduction);
  const total = deductions.reduce((sum, f) => sum + f.deduction, 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - total)));
  return { score, band: scoreBand(score), deductions };
}
