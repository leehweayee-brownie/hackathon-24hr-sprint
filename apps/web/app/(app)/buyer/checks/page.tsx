'use client';

import { VendorCheckStatus } from '@vp/shared';
import { isToday } from 'date-fns';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { CheckStatusBadge, ScoreCell, SupplierAvatar, reviewButtonClass } from '@/features/vendor-checks/CheckTableParts';
import { useVendorChecks } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils/cn';
import { formatDate, formatMoney } from '@/utils/format';
import { CHECK_STATUS_META } from '@/utils/status';

/** Figma "Segmented tabs": All, then every status in workflow order. */
const TABS: Array<{ value: VendorCheckStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  ...[VendorCheckStatus.DRAFT, VendorCheckStatus.IN_REVIEW, VendorCheckStatus.MORE_INFO, VendorCheckStatus.APPROVED, VendorCheckStatus.REJECTED].map((s) => ({
    value: s,
    label: CHECK_STATUS_META[s].label,
  })),
];

/** Column widths from the Figma "Approval" row. */
const COLS = {
  supplier: 'min-w-[180px] flex-1',
  tender: 'w-[160px] shrink-0',
  value: 'w-[100px] shrink-0 text-right',
  score: 'w-[100px] shrink-0',
  status: 'w-[190px] shrink-0',
  created: 'w-[110px] shrink-0',
  /** Shown from 1440px wide; narrower screens keep Created only so the supplier name has room. */
  updated: 'hidden w-[110px] shrink-0 min-[1440px]:block',
  action: 'w-[72px] shrink-0 flex justify-end',
};

/** "Today", "11 Nov, 12:29" this year, "15 Oct 2025" before. */
function when(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  return d.getFullYear() === new Date().getFullYear() ? formatDate(iso, 'd MMM, HH:mm') : formatDate(iso);
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function VendorChecksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<VendorCheckStatus | 'ALL'>('ALL');
  const checks = useVendorChecks();
  if (checks.isLoading) return <PageSkeleton />;

  const all = checks.data?.items ?? [];
  const rows = tab === 'ALL' ? all : all.filter((c) => c.status === tab);
  const waiting = new Set(all.filter((c) => c.status === VendorCheckStatus.IN_REVIEW).map((c) => c.supplierId)).size;
  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-8 text-gray-800">Vendor checks</h1>
          <p className="text-sm leading-5 text-gray-500">
            {greeting()}
            {firstName ? `, ${firstName}` : ''} —{' '}
            {waiting === 0
              ? 'no vendors are waiting for your decision.'
              : `${waiting} ${waiting === 1 ? 'vendor is' : 'vendors are'} waiting for your decision.`}
          </p>
        </div>
        <Link href="/buyer/checks/new" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium leading-5 text-white hover:bg-brand-hover">
          <Plus className="size-4" aria-hidden /> New vendor check
        </Link>
      </div>

      {/* Figma "Card / Waiting for your decision" */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto border-b border-gray-200 px-5 py-4">
          <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Filter by status">
            {TABS.map((t) => {
              const active = tab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    'whitespace-nowrap rounded-md px-3 py-1.5 text-sm leading-5 transition-colors',
                    active ? 'bg-white font-medium text-gray-800 shadow-[0_1px_0_rgba(0,0,0,0.05)]' : 'text-gray-500 hover:text-gray-800',
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1010px]" role="table" aria-label="Vendor checks">
            <div className="flex gap-3 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-medium uppercase leading-4 tracking-[0.4px] text-gray-500" role="row">
              <span className={COLS.supplier} role="columnheader">Supplier</span>
              <span className={COLS.tender} role="columnheader">Tender</span>
              <span className={COLS.value} role="columnheader">Value</span>
              <span className={COLS.score} role="columnheader">Score</span>
              <span className={COLS.status} role="columnheader">Status</span>
              <span className={COLS.created} role="columnheader">Created</span>
              <span className={COLS.updated} role="columnheader">Updated</span>
              <span className={COLS.action} role="columnheader" aria-label="Action" />
            </div>

            {rows.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-gray-500">
                {tab === 'ALL' ? 'No vendor checks yet. Start one for a supplier.' : `No checks are ${CHECK_STATUS_META[tab].label.toLowerCase()}.`}
              </p>
            ) : (
              rows.map((c) => (
                <div
                  key={c.id}
                  role="row"
                  onClick={() => router.push(`/buyer/checks/${c.id}`)}
                  className="flex cursor-pointer items-center gap-3 border-b border-gray-200 px-5 py-3 last:border-b-0 hover:bg-gray-50"
                >
                  <div className={cn(COLS.supplier, 'flex items-center gap-3')} role="cell">
                    <SupplierAvatar id={c.supplierId} name={c.supplierName} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-gray-800" title={c.supplierName}>
                      {c.supplierName}
                    </span>
                  </div>
                  <span className={cn(COLS.tender, 'line-clamp-2 text-sm leading-5 text-gray-800')} role="cell" title={c.tenderTitle}>
                    {c.tenderTitle}
                  </span>
                  <span className={cn(COLS.value, 'tabular text-sm font-medium leading-5 text-gray-800')} role="cell">
                    {formatMoney(c.contractValue)}
                  </span>
                  <div className={COLS.score} role="cell">
                    <ScoreCell check={c} barWidth={56} />
                  </div>
                  <div className={COLS.status} role="cell">
                    <CheckStatusBadge status={c.status} />
                  </div>
                  <span className={cn(COLS.created, 'text-sm leading-5 text-gray-800')} role="cell">
                    {when(c.createdAt)}
                  </span>
                  <span className={cn(COLS.updated, 'text-sm leading-5 text-gray-800')} role="cell">
                    {when(c.updatedAt)}
                  </span>
                  <div className={COLS.action} role="cell">
                    <Link href={`/buyer/checks/${c.id}`} onClick={(e) => e.stopPropagation()} className={reviewButtonClass}>
                      Review
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
