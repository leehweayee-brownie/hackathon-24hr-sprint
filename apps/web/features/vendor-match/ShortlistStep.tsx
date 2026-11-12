'use client';

import type { MatchFit, MatchResult, VendorMatch } from '@vp/shared';
import { ArrowRight, CircleCheck, CircleX, FileQuestion, Loader2, Send, ShieldCheck, Star, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PanelCard, PanelHeader } from '@/components/ui/PanelCard';
import { SupplierAvatar } from '@/features/vendor-checks/CheckTableParts';
import { cn } from '@/utils/cn';
import { shortMyr } from './RequirementsStep';

const FIT: Record<MatchFit, { icon: typeof CircleCheck; color: string; label: string; badge: string }> = {
  qualified: { icon: CircleCheck, color: 'text-teal-600', label: 'Qualified', badge: 'bg-teal-100 text-teal-800' },
  conditional: { icon: TriangleAlert, color: 'text-amber-500', label: 'Qualifies with conditions', badge: 'bg-amber-100 text-amber-800' },
  excluded: { icon: CircleX, color: 'text-brand', label: 'Excluded', badge: 'bg-brand-100 text-brand-800' },
};

function Fact({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium leading-4 text-gray-700">{children}</span>;
}

function MatchRow({
  m,
  checkId,
  busy,
  onInvite,
  onRequest,
}: {
  m: VendorMatch;
  checkId: string | null;
  busy: 'invite' | 'request' | null;
  onInvite: () => void;
  onRequest: () => void;
}) {
  const [open, setOpen] = useState(false);
  const f = FIT[m.fit];
  const requestable = m.gaps.filter((g) => g.requestable && g.docType);
  return (
    <li className={cn('flex flex-col gap-3 border-b border-gray-100 px-5 py-4 last:border-b-0', m.fit === 'excluded' && 'bg-gray-50/70')} data-testid="match-row" data-fit={m.fit}>
      <div className="flex flex-wrap items-start gap-3">
        <f.icon className={cn('mt-1.5 size-5 shrink-0', f.color)} aria-label={f.label} />
        <SupplierAvatar id={m.supplierId} name={m.supplierName} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className={cn('text-sm font-semibold leading-5', m.fit === 'excluded' ? 'text-gray-500' : 'text-gray-800')}>{m.supplierName}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium leading-4', f.badge)}>{f.label}</span>
          </p>
          <p className={cn('text-sm leading-5', m.fit === 'excluded' ? 'text-gray-500' : 'text-gray-700')}>{m.summary}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {m.cidbGrade ? <Fact>CIDB {m.cidbGrade}</Fact> : null}
            {m.liabilityCover !== null ? <Fact>{shortMyr(m.liabilityCover)} cover</Fact> : null}
            {m.rating.count > 0 && m.rating.average !== null ? (
              <Fact>
                <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden /> {m.rating.average.toFixed(1)} · {m.rating.count} {m.rating.count === 1 ? 'job' : 'jobs'}
              </Fact>
            ) : (
              <Fact>{m.pastJobs > 0 ? `${m.pastJobs} past ${m.pastJobs === 1 ? 'job' : 'jobs'}, not rated` : 'No ratings yet'}</Fact>
            )}
            {m.trustScore !== null ? (
              <Fact>
                <ShieldCheck className="size-3 text-gray-500" aria-hidden /> Trust {m.trustScore}
              </Fact>
            ) : null}
          </div>
          {m.gaps.length > 0 && m.fit !== 'excluded' ? (
            <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 self-start text-xs font-medium leading-4 text-gray-500 hover:text-gray-800" aria-expanded={open}>
              {open ? 'Hide' : 'Show'} {m.gaps.length} {m.gaps.length === 1 ? 'gap' : 'gaps'}
            </button>
          ) : null}
          {open ? (
            <ul className="flex flex-col gap-1 rounded-lg bg-amber-50 px-3 py-2">
              {m.gaps.map((g, i) => (
                <li key={`${g.kind}-${i}`} className="flex items-start gap-2 text-xs leading-4 text-amber-900">
                  <TriangleAlert className="mt-px size-3 shrink-0 text-amber-500" aria-hidden /> {g.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {checkId ? (
            <Link href={`/buyer/checks/${checkId}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium leading-5 text-gray-800 hover:bg-gray-50">
              View check <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : m.fit === 'qualified' ? (
            <button type="button" onClick={onInvite} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium leading-5 text-white hover:bg-brand-hover disabled:opacity-60" data-testid="invite">
              {busy === 'invite' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />} Invite to tender
            </button>
          ) : m.fit === 'conditional' ? (
            <>
              {requestable.length > 0 ? (
                <button type="button" onClick={onRequest} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium leading-5 text-gray-800 shadow-[0_1px_0_rgba(0,0,0,0.05)] hover:bg-gray-50 disabled:opacity-60" data-testid="request-document">
                  {busy === 'request' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileQuestion className="size-4 text-brand" aria-hidden />}
                  Request {requestable.length === 1 ? 'document' : `${requestable.length} documents`}
                </button>
              ) : null}
              <button type="button" onClick={onInvite} disabled={!!busy} className="rounded-lg px-3 py-2 text-sm font-medium leading-5 text-brand hover:bg-brand-tint disabled:opacity-60">
                {busy === 'invite' ? 'Inviting…' : 'Invite anyway'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** Step 3: ranked shortlist. Qualified first, then conditional (fewest gaps first), then excluded with the reason shown. */
export function ShortlistStep({
  result,
  checks,
  busy,
  onInvite,
  onRequest,
}: {
  result: MatchResult;
  checks: Record<string, string>;
  busy: { supplierId: string; action: 'invite' | 'request' } | null;
  onInvite: (m: VendorMatch) => void;
  onRequest: (m: VendorMatch) => void;
}) {
  const count = (fit: MatchFit) => result.matches.filter((m) => m.fit === fit).length;
  return (
    <PanelCard data-testid="shortlist">
      <PanelHeader
        title="Shortlist"
        subtitle={`${count('qualified')} qualified · ${count('conditional')} with conditions · ${count('excluded')} excluded, from ${result.poolSize} verified ${result.poolSize === 1 ? 'vendor' : 'vendors'}`}
      >
        <span className="hidden shrink-0 text-xs leading-4 text-gray-500 sm:block">Ranked by fit, gaps, ratings and trust score</span>
      </PanelHeader>
      {result.matches.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-500">No vendors with verified documents yet.</p>
      ) : (
        <ul>
          {result.matches.map((m) => (
            <MatchRow
              key={m.supplierId}
              m={m}
              checkId={checks[m.supplierId] ?? m.openCheckId}
              busy={busy?.supplierId === m.supplierId ? busy.action : null}
              onInvite={() => onInvite(m)}
              onRequest={() => onRequest(m)}
            />
          ))}
        </ul>
      )}
      <p className="border-t border-gray-100 bg-gray-50 px-5 py-3 text-xs leading-4 text-gray-500">
        Fit comes from verified document facts: actual CIDB grade, actual cover, and validity across the contract period. Ratings come from your past approved jobs.
      </p>
    </PanelCard>
  );
}
