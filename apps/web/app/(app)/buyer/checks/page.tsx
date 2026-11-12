'use client';

import { VendorCheckStatus } from '@vp/shared';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { CheckStatusChip } from '@/components/ui/StatusChip';
import { useVendorChecks } from '@/hooks/queries';
import { cn } from '@/utils/cn';
import { formatDate, formatMoney } from '@/utils/format';
import { CHECK_STATUS_META } from '@/utils/status';

export default function VendorChecksPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('');
  const checks = useVendorChecks(status || undefined);
  if (checks.isLoading) return <PageSkeleton />;
  const rows = checks.data?.items ?? [];
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Vendor checks"
        description="Every check you have started, with its latest score."
        actions={
          <Link href="/buyer/checks/new">
            <Button>
              <Plus className="size-4" /> New vendor check
            </Button>
          </Link>
        }
      />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {['', ...Object.values(VendorCheckStatus)].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={cn('rounded-full border px-3 py-1 text-[12px] font-medium', status === s ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-panel text-ink-3 hover:border-ink-3')}
          >
            {s ? CHECK_STATUS_META[s as VendorCheckStatus].label : 'All'}
          </button>
        ))}
      </div>
      <Card>
        <DataTable
          rows={rows}
          rowKey={(c) => c.id}
          onRowClick={(c) => router.push(`/buyer/checks/${c.id}`)}
          empty="No vendor checks yet."
          columns={[
            { key: 'supplier', header: 'Supplier', render: (c) => <span className="font-medium text-ink">{c.supplierName}</span> },
            { key: 'tender', header: 'Tender', render: (c) => <span className="text-ink-3">{c.tenderTitle}</span> },
            { key: 'value', header: 'Value', align: 'right', render: (c) => <span className="tabular">{formatMoney(c.contractValue)}</span> },
            { key: 'score', header: 'Score', align: 'right', render: (c) => <span className="tabular font-semibold">{c.trustScore ?? '—'}</span> },
            { key: 'status', header: 'Status', render: (c) => <CheckStatusChip status={c.status} /> },
            { key: 'created', header: 'Created', render: (c) => <span className="text-muted">{formatDate(c.createdAt)}</span> },
          ]}
        />
      </Card>
    </div>
  );
}
