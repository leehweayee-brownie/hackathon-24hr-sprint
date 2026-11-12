import type { Finding, TrustScoreResult } from '@vp/shared';
import { runCrossChecks } from './cross-check';
import { computeTrustScore } from './trust-score';
import type { RuleContext } from './types';

export * from './config/cidb-grades';
export * from './normalize';
export * from './dates';
export * from './cross-check';
export * from './trust-score';
export * from './timeline';
export * from './types';

export interface EvaluationResult extends TrustScoreResult {
  findings: Finding[];
}

/** Cross-checks plus trust score in one call. Same input always gives the same result. */
export function evaluate(ctx: RuleContext): EvaluationResult {
  const findings = runCrossChecks(ctx);
  const score = computeTrustScore(findings);
  return { findings, ...score };
}
