/**
 * CIDB contractor grades and the maximum tender/contract value each grade may take on.
 * Configuration, not code: check against current CIDB rules before going live.
 * `null` means no upper limit.
 */
export type CidbGrade = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7';

export interface CidbGradeLimit {
  grade: CidbGrade;
  /** Maximum contract value in MYR, or null for unlimited. */
  maxContractValue: number | null;
  label: string;
}

export const CIDB_GRADE_LIMITS: Record<CidbGrade, CidbGradeLimit> = {
  G1: { grade: 'G1', maxContractValue: 200_000, label: 'Up to RM200,000' },
  G2: { grade: 'G2', maxContractValue: 500_000, label: 'Up to RM500,000' },
  G3: { grade: 'G3', maxContractValue: 1_000_000, label: 'Up to RM1 million' },
  G4: { grade: 'G4', maxContractValue: 3_000_000, label: 'Up to RM3 million' },
  G5: { grade: 'G5', maxContractValue: 5_000_000, label: 'Up to RM5 million' },
  G6: { grade: 'G6', maxContractValue: 10_000_000, label: 'Up to RM10 million' },
  G7: { grade: 'G7', maxContractValue: null, label: 'No limit' },
};

export const CIDB_GRADES: CidbGrade[] = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'];

export function isCidbGrade(value: string | null | undefined): value is CidbGrade {
  return !!value && (CIDB_GRADES as string[]).includes(value);
}

/** Returns the max contract value for a grade, or null for unlimited / unknown grade (undefined). */
export function cidbGradeLimit(grade: string | null | undefined): number | null | undefined {
  if (!isCidbGrade(grade)) return undefined;
  return CIDB_GRADE_LIMITS[grade].maxContractValue;
}

/** True when the grade permits a contract of the given value. Unknown grades are treated as not allowed. */
export function gradeAllowsContract(grade: string | null | undefined, contractValue: number): boolean {
  const limit = cidbGradeLimit(grade);
  if (limit === undefined) return false;
  if (limit === null) return true;
  return contractValue <= limit;
}
