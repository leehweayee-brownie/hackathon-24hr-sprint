'use client';

import { SEVERITY_ORDER, type Finding } from '@vp/shared';
import { ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { FindingCard } from './FindingCard';

export function FindingsList({ findings, documentHref }: { findings: Finding[]; documentHref?: (id: string) => string }) {
  const sorted = [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.deduction - a.deduction);
  if (sorted.length === 0) return <EmptyState icon={ShieldCheck} title="No findings" description="The documents agree with each other and nothing is expired or missing." />;
  return (
    <ul className="space-y-2">
      {sorted.map((f, i) => (
        <li key={`${f.rule}-${i}`}>
          <FindingCard finding={f} documentHref={documentHref} />
        </li>
      ))}
    </ul>
  );
}
