import { RULE_LABELS, Severity, type DocumentView, type Finding, type PassportView } from '@vp/shared';
import { CircleAlert, CircleX, FileText, Info, Percent, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { PanelCard, PanelHeader } from '@/components/ui/PanelCard';
import { SoftBadge, type BadgeTone } from '@/features/dashboard/SoftBadge';
import { TrustScoreGauge } from '@/features/dashboard/TrustScoreGauge';
import { cn } from '@/utils/cn';

const BAND: Record<'green' | 'amber' | 'red', { tone: BadgeTone; label: string }> = {
  red: { tone: 'red', label: 'High risk' },
  amber: { tone: 'amber', label: 'Review needed' },
  green: { tone: 'teal', label: 'Low risk' },
};

const SEVERITY = {
  [Severity.CRITICAL]: { icon: CircleX, iconColor: 'text-red-600', text: 'text-red-600', accent: 'bg-red-500', circle: 'bg-brand-100 text-brand', publicIcon: CircleAlert },
  [Severity.WARNING]: { icon: TriangleAlert, iconColor: 'text-amber-600', text: 'text-amber-600', accent: 'bg-amber-500', circle: 'bg-amber-100 text-amber-600', publicIcon: TriangleAlert },
  [Severity.INFO]: { icon: Info, iconColor: 'text-blue-600', text: 'text-blue-600', accent: 'bg-blue-500', circle: 'bg-blue-100 text-blue-600', publicIcon: Info },
} as const;

type Variant = 'supplier' | 'public';

/**
 * Figma "Deduction": white card with a 3px severity accent, icon, title + severity, message, evidence chips, points.
 * The public variant uses the 28px tinted icon circle and opens evidence in place instead of linking into the supplier app.
 */
function Deduction({ finding, documents, variant, onViewDocument }: { finding: Finding; documents: DocumentView[]; variant: Variant; onViewDocument?: (id: string) => void }) {
  const s = SEVERITY[finding.severity];
  const isPublic = variant === 'public';
  const chip = 'inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-[3px] text-xs font-medium leading-4 text-brand hover:bg-brand-tint';
  const evidence = finding.documentIds.map((id) => documents.find((d) => d.id === id)).filter((d): d is DocumentView => !!d);
  return (
    <li className="relative flex items-start gap-3 overflow-hidden rounded-lg border border-gray-200 bg-white py-4 pl-5 pr-4">
      <span className={cn('absolute -bottom-px -left-px -top-px w-[3px]', s.accent)} aria-hidden />
      {isPublic ? (
        <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', s.circle)}>
          <s.publicIcon className="size-4" aria-hidden />
        </span>
      ) : (
        <s.icon className={cn('mt-0.5 size-4 shrink-0', s.iconColor)} aria-hidden />
      )}
      <div className={cn('flex min-w-0 flex-1 flex-col', isPublic ? 'gap-1.5' : 'gap-2')}>
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold leading-5 text-gray-800">{RULE_LABELS[finding.rule] ?? finding.rule}</span>
          <span className={cn('text-xs font-medium uppercase leading-4 tracking-[0.4px]', s.text)}>{finding.severity}</span>
        </p>
        <p className={cn('text-sm leading-5', isPublic ? 'text-gray-600' : 'text-gray-700')}>{finding.message}</p>
        {evidence.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {evidence.map((d) =>
              isPublic ? (
                onViewDocument ? (
                  <button key={d.id} type="button" onClick={() => onViewDocument(d.id)} className={chip}>
                    <FileText className="size-3 shrink-0" aria-hidden /> {d.fileName}
                  </button>
                ) : (
                  <span key={d.id} className={chip}>
                    <FileText className="size-3 shrink-0" aria-hidden /> {d.fileName}
                  </span>
                )
              ) : (
                <Link key={d.id} href={`/supplier/documents/${d.id}`} className={chip}>
                  <FileText className="size-3 shrink-0" aria-hidden /> {d.fileName}
                </Link>
              ),
            )}
          </div>
        ) : null}
      </div>
      <p className={cn('tabular shrink-0 text-base font-semibold leading-6', s.text)}>−{finding.deduction}</p>
    </li>
  );
}

/** Figma "Card / Trust score": 152px gauge with band badge, and "Why this score" deductions. */
export function TrustScoreCard({
  passport,
  variant = 'supplier',
  onViewDocument,
}: {
  passport: PassportView;
  variant?: Variant;
  onViewDocument?: (id: string) => void;
}) {
  const isPublic = variant === 'public';
  const band = BAND[passport.band] ?? BAND.red;
  const findings = passport.findings ?? [];
  const total = findings.reduce((n, f) => n + f.deduction, 0);
  return (
    <PanelCard>
      <PanelHeader
        icon={isPublic ? undefined : Percent}
        title="Trust score"
        subtitle="Deterministic: the rules engine scores what the documents say. The AI only reads."
        bordered={isPublic}
      />
      <div className={cn('flex flex-col p-5 sm:flex-row sm:items-start', isPublic ? 'gap-8' : 'gap-6')}>
        <div
          className={cn('flex w-full shrink-0 flex-col items-center gap-2 pt-2', isPublic ? 'sm:w-[190px]' : 'sm:w-[170px]')}
          data-testid="trust-score-ring"
          data-score={passport.trustScore}
          data-band={passport.band}
        >
          <TrustScoreGauge score={passport.trustScore} tone={band.tone} size={152} scoreClassName="text-[36px] leading-10" />
          <p className="text-xs font-medium uppercase leading-4 tracking-[0.4px] text-gray-500">Trust score</p>
          <SoftBadge tone={band.tone}>{band.label}</SoftBadge>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-medium leading-4 text-gray-500">
            <p className="flex-1 uppercase tracking-[0.4px]">Why this score</p>
            <p className="tabular normal-case">
              {findings.length} {findings.length === 1 ? 'deduction' : 'deductions'}
              {total > 0 ? ` · −${total}` : ''}
            </p>
          </div>
          {findings.length === 0 ? (
            <p className="rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-500">No deductions. Every check passed.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {findings.map((f, i) => (
                <Deduction key={`${f.rule}-${i}`} finding={f} documents={passport.documents} variant={variant} onViewDocument={onViewDocument} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </PanelCard>
  );
}
