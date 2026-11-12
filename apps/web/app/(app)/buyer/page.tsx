'use client';

import { VendorCheckStatus } from '@vp/shared';
import { CalendarClock, ClipboardCheck, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { Stat } from '@/components/ui/Stat';
import { CheckStatusChip } from '@/components/ui/StatusChip';
import { useVendorChecks } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { formatMoney, formatRelative } from '@/utils/format';

export default function BuyerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const checks = useVendorChecks();
  if (checks.isLoading) return <PageSkeleton />;
  const all = checks.data?.items ?? [];
  const queue = all.filter((c) => c.status === VendorCheckStatus.IN_REVIEW || c.status === VendorCheckStatus.MORE_INFO);
  const approved = all.filter((c) => c.status === VendorCheckStatus.APPROVED).length;
  const rejected = all.filter((c) => c.status === VendorCheckStatus.REJECTED).length;
  const expiring = all.reduce((n, c) => n + (c.timeline?.filter((t) => t.state === 'expiring' || t.state === 'expired').length ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={user?.organizationName}
        title="Review queue"
        description="Vendor checks waiting for a decision."
        actions={
          <Link href="/buyer/checks/new">
            <Button>
              <Plus className="size-4" /> New vendor check
            </Button>
          </Link>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="In review" value={queue.length} tone={queue.length > 0 ? 'info' : 'neutral'} icon={<ClipboardCheck className="size-4 text-muted" />} />
        <Stat label="Approved" value={approved} tone="success" />
        <Stat label="Rejected" value={rejected} tone={rejected > 0 ? 'danger' : 'neutral'} />
        <Stat label="Expiring documents" value={expiring} tone={expiring > 0 ? 'warning' : 'neutral'} hint="Across suppliers you rely on" icon={<CalendarClock className="size-4 text-muted" />} />
      </div>
      <Card>
        <CardHeader title="Queue" description={`${queue.length} open`} action={<Link href="/buyer/checks" className="text-[13px] font-medium text-primary hover:underline">All checks</Link>} />
        <DataTable
          rows={queue}
          rowKey={(c) => c.id}
          onRowClick={(c) => router.push(`/buyer/checks/${c.id}`)}
          empty="No checks waiting. Start one for a supplier."
          columns={[
            { key: 'supplier', header: 'Supplier', render: (c) => <span className="font-medium text-ink">{c.supplierName}</span> },
            { key: 'tender', header: 'Tender', render: (c) => <span className="text-ink-3">{c.tenderTitle}</span> },
            { key: 'value', header: 'Value', align: 'right', render: (c) => <span className="tabular">{formatMoney(c.contractValue)}</span> },
            {
              key: 'score',
              header: 'Score',
              align: 'right',
              render: (c) => (
                <span className={`tabular font-semibold ${c.band === 'green' ? 'text-success' : c.band === 'amber' ? 'text-warning' : c.band === 'red' ? 'text-danger' : 'text-muted'}`}>
                  {c.trustScore ?? '—'}
                </span>
              ),
            },
            { key: 'status', header: 'Status', render: (c) => <CheckStatusChip status={c.status} /> },
            { key: 'updated', header: 'Updated', render: (c) => <span className="text-muted">{formatRelative(c.updatedAt)}</span> },
          ]}
        />
      </Card>
    </div>
  );
}
