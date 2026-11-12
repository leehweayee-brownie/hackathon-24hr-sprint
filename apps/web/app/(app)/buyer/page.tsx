'use client';

import { VendorCheckStatus } from '@vp/shared';
import { ArrowRight, CalendarClock, CircleCheck, CircleX, ClipboardCheck, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { KpiCard } from '@/features/dashboard/KpiCard';
import { SoftBadge } from '@/features/dashboard/SoftBadge';
import { CheckStatusBadge, ScoreCell, SupplierAvatar, reviewButtonClass, shortCompanyName } from '@/features/vendor-checks/CheckTableParts';
import { useVendorChecks } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils/cn';
import { formatDate, formatMoney, formatRelative } from '@/utils/format';

/** Column widths from the Figma "Table / Review queue row". */
const COLS = {
  tender: 'w-[230px] shrink-0',
  value: 'w-[110px] shrink-0 text-right',
  score: 'w-[120px] shrink-0',
  status: 'w-[100px] shrink-0',
  created: 'w-[100px] shrink-0',
  action: 'w-[76px] shrink-0 flex justify-end',
};

export default function BuyerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const checks = useVendorChecks();
  if (checks.isLoading) return <PageSkeleton />;

  const all = checks.data?.items ?? [];
  const queue = all
    .filter((c) => c.status === VendorCheckStatus.IN_REVIEW || c.status === VendorCheckStatus.MORE_INFO)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const approved = all.filter((c) => c.status === VendorCheckStatus.APPROVED).length;
  const rejected = all.filter((c) => c.status === VendorCheckStatus.REJECTED).length;
  const expiring = all.reduce((n, c) => n + (c.timeline?.filter((t) => t.state === 'expiring' || t.state === 'expired').length ?? 0), 0);
  const oldestUpdate = queue.reduce<string | null>((oldest, c) => (!oldest || c.updatedAt < oldest ? c.updatedAt : oldest), null);

  // AI flag: high-risk suppliers waiting for a decision, counted once per supplier, the biggest contract first.
  const risky = queue.filter((c) => c.band === 'red' && c.trustScore !== null).sort((a, b) => b.contractValue - a.contractValue);
  const riskySuppliers = [...new Map(risky.map((c) => [c.supplierId, c])).values()];
  const queueSuppliers = new Set(queue.map((c) => c.supplierId)).size;
  const queueValue = queue.reduce((n, c) => n + c.contractValue, 0);
  const top = risky[0];
  const sameScore = risky.every((c) => c.trustScore === top?.trustScore);
  const share = top && queueValue > 0 ? Math.round((top.contractValue / queueValue) * 100) : 0;
  const others = riskySuppliers.filter((c) => c.supplierId !== top?.supplierId).map((c) => c.supplierName);

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-8 text-gray-800">Welcome, {user?.organizationName}</h1>
          <p className="text-sm leading-5 text-gray-500">Last login {formatDate(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <Link href="/buyer/checks/new" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium leading-5 text-white hover:bg-brand-hover">
          <Plus className="size-4" aria-hidden /> New vendor check
        </Link>
      </div>

      {/* Figma "Alert / AI flagged vendors" */}
      {top ? (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4" role="status">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-yellow-200 bg-white">
            <Sparkles className="size-5 text-yellow-500" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-sm font-semibold leading-5 text-gray-800">
              {riskySuppliers.length} of {queueSuppliers} {queueSuppliers === 1 ? 'vendor' : 'vendors'} in your queue{' '}
              {sameScore ? `scored ${top.trustScore} / 100` : 'scored below 60 / 100'}
            </p>
            <p className="text-sm leading-5 text-gray-600">
              {top.supplierName} ({formatMoney(top.contractValue)}
              {queue.length > 1 ? ` — ${share}% of the value in review` : ''})
              {others.length > 0 ? ` and ${others.join(', ')}` : ''} {riskySuppliers.length === 1 ? 'needs' : 'need'} a closer look before you approve.
            </p>
          </div>
          <Link href={`/buyer/checks/${top.id}`} className="shrink-0 rounded-lg bg-brand px-3 py-2 text-sm font-medium leading-5 text-white hover:bg-brand-hover">
            Review {shortCompanyName(top.supplierName)} first
          </Link>
        </div>
      ) : null}

      {/* Figma "KPI row" */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          className="min-h-0"
          label="In review"
          value={queue.length}
          valueClassName="text-blue-600"
          hint={oldestUpdate ? `Oldest update ${formatRelative(oldestUpdate)}` : 'Nothing waiting for you'}
          icon={ClipboardCheck}
          iconBox="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KpiCard className="min-h-0" label="Approved" value={approved} valueClassName="text-teal-600" hint="Cleared to receive POs" icon={CircleCheck} iconBox="bg-teal-50" iconColor="text-teal-600" />
        <KpiCard
          className="min-h-0"
          label="Rejected"
          value={rejected}
          hint={rejected === 0 ? 'No vendors rejected' : 'Not cleared for POs'}
          icon={CircleX}
          iconBox="bg-gray-100"
          iconColor="text-gray-500"
        />
        <KpiCard
          className="min-h-0"
          label="Expiring documents"
          value={expiring}
          badge={expiring === 0 ? <SoftBadge tone="teal">All valid</SoftBadge> : <SoftBadge tone="amber">Needs attention</SoftBadge>}
          hint="Across vendors you rely on"
          icon={CalendarClock}
          iconBox="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* Figma "Card / Queue" */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="text-base font-semibold leading-6 text-gray-800">Queue</h2>
            <p className="text-xs leading-4 text-gray-500">{queue.length} open</p>
          </div>
          <Link href="/buyer/checks" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium leading-5 text-brand hover:bg-brand-tint">
            <ArrowRight className="size-4" aria-hidden /> All checks
          </Link>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[960px]" role="table" aria-label="Review queue">
            <div className="flex gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-medium uppercase leading-4 tracking-[0.4px] text-gray-500" role="row">
              <span className="min-w-0 flex-1" role="columnheader">Vendor</span>
              <span className={COLS.tender} role="columnheader">Tender</span>
              <span className={COLS.value} role="columnheader">Value</span>
              <span className={COLS.score} role="columnheader">Score</span>
              <span className={COLS.status} role="columnheader">Status</span>
              <span className={COLS.created} role="columnheader">Created</span>
              <span className={COLS.action} role="columnheader" aria-label="Action" />
            </div>

            {queue.length === 0 ? (
              <p className="border-b border-gray-200 px-5 py-8 text-center text-sm text-gray-500">No checks waiting. Start one for a supplier.</p>
            ) : (
              queue.map((c) => (
                <div
                  key={c.id}
                  role="row"
                  onClick={() => router.push(`/buyer/checks/${c.id}`)}
                  className="flex cursor-pointer items-center gap-4 border-b border-gray-200 px-5 py-3.5 hover:bg-gray-50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3" role="cell">
                    <SupplierAvatar id={c.supplierId} name={c.supplierName} />
                    <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-gray-800">{c.supplierName}</span>
                  </div>
                  <span className={cn(COLS.tender, 'text-sm leading-5 text-gray-600')} role="cell">
                    {c.tenderTitle}
                  </span>
                  <span className={cn(COLS.value, 'tabular text-sm font-medium leading-5 text-gray-800')} role="cell">
                    {formatMoney(c.contractValue)}
                  </span>
                  <div className={COLS.score} role="cell">
                    <ScoreCell check={c} />
                  </div>
                  <div className={COLS.status} role="cell">
                    <CheckStatusBadge status={c.status} short />
                  </div>
                  <span className={cn(COLS.created, 'text-sm leading-5 text-gray-500')} role="cell">
                    {formatRelative(c.createdAt)}
                  </span>
                  <div className={COLS.action} role="cell">
                    <Link
                      href={`/buyer/checks/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className={reviewButtonClass}
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <p className="min-w-0 flex-1 text-sm leading-5 text-gray-500">
            Showing {queue.length} of {queue.length} open {queue.length === 1 ? 'check' : 'checks'}
          </p>
          <p className="text-xs leading-4 text-gray-400">Score: 0–59 high risk · 60–74 medium · 75–100 low</p>
        </div>
      </section>
    </div>
  );
}
