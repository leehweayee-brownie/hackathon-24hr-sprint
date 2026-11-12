'use client';

import { RULE_LABELS, Severity, type Finding, type RuleCode } from '@vp/shared';
import { AlertOctagon, AlertTriangle, FileText, Info } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/utils/cn';

const SEVERITY_STYLE: Record<Severity, { icon: typeof Info; border: string; text: string; bg: string; label: string }> = {
  [Severity.CRITICAL]: { icon: AlertOctagon, border: 'border-l-danger', text: 'text-danger', bg: 'bg-danger-soft', label: 'Critical' },
  [Severity.WARNING]: { icon: AlertTriangle, border: 'border-l-warning', text: 'text-warning', bg: 'bg-warning-soft', label: 'Warning' },
  [Severity.INFO]: { icon: Info, border: 'border-l-info', text: 'text-info', bg: 'bg-info-soft', label: 'Info' },
};

export function FindingCard({ finding, documentHref, className }: { finding: Finding; documentHref?: (documentId: string) => string; className?: string }) {
  const style = SEVERITY_STYLE[finding.severity] ?? SEVERITY_STYLE[Severity.INFO];
  const Icon = style.icon;
  const docs = finding.documentIds ?? [];
  return (
    <div className={cn('rounded-card border border-line border-l-[3px] bg-panel px-4 py-3 shadow-card', style.border, className)} data-testid="finding-card" data-rule={finding.rule}>
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full', style.bg, style.text)}>
          <Icon className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-[13px] font-semibold text-ink">{RULE_LABELS[finding.rule as RuleCode] ?? finding.rule}</p>
            <span className={cn('text-[11px] font-medium uppercase tracking-[0.05em]', style.text)}>{style.label}</span>
          </div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">{finding.message}</p>
          {docs.length > 0 && documentHref ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {docs.map((id, i) => (
                <Link key={id} href={documentHref(id)} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[12px] text-primary hover:bg-primary-soft">
                  <FileText className="size-3" aria-hidden /> Document {i + 1}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
        {finding.deduction > 0 ? (
          <span className={cn('tabular shrink-0 text-[15px] font-semibold', style.text)} aria-label={`Deduction ${finding.deduction} points`}>
            −{finding.deduction}
          </span>
        ) : null}
      </div>
    </div>
  );
}
