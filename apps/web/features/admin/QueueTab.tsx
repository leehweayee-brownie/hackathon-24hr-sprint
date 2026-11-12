'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { BellRing, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { Stat } from '@/components/ui/Stat';
import { adminService } from '@/services/admin';
import { errorMessage } from '@/services/http';
import { toast } from '@/store/ui';
import { formatDateTime } from '@/utils/format';

export function QueueTab() {
  const queue = useQuery({ queryKey: ['admin-queue'], queryFn: adminService.queue, refetchInterval: 5000 });
  const reminders = useMutation({ mutationFn: adminService.runReminders, onSuccess: (r) => toast({ title: 'Reminders sent', description: `${r.sent} reminder${r.sent === 1 ? '' : 's'}`, tone: 'success' }), onError: (e) => toast({ title: 'Failed', description: errorMessage(e), tone: 'danger' }) });
  if (queue.isLoading) return <PageSkeleton />;
  const q = queue.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">Queue <span className="font-mono">{q?.queue}</span> · Redis {q?.redis === 'up' ? <span className="text-success">up</span> : <span className="text-danger">down</span>}</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => queue.refetch()}><RefreshCw className="size-4" /> Refresh</Button>
          <Button onClick={() => reminders.mutate()} loading={reminders.isPending} data-testid="run-reminders"><BellRing className="size-4" /> Run reminders now</Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-5">
        <Stat label="Waiting" value={q?.counts.waiting ?? 0} />
        <Stat label="Active" value={q?.counts.active ?? 0} tone="info" />
        <Stat label="Completed" value={q?.counts.completed ?? 0} tone="success" />
        <Stat label="Failed" value={q?.counts.failed ?? 0} tone={(q?.counts.failed ?? 0) > 0 ? 'danger' : 'neutral'} />
        <Stat label="Delayed" value={q?.counts.delayed ?? 0} />
      </div>
      <Card>
        <CardHeader title="Failed extractions" description="Documents that could not be processed after retries" />
        <ul className="divide-y divide-line-soft">
          {(q?.failedDocuments ?? []).map((d) => (
            <li key={d.id} className="px-5 py-2.5 text-[13px]"><p className="font-medium text-ink">{d.fileName} <span className="font-normal text-muted">· {d.supplierName ?? ''}</span></p><p className="text-[12px] text-danger">{d.error ?? 'Unknown error'} · {d.attempts} attempt{d.attempts === 1 ? '' : 's'} · {formatDateTime(d.updatedAt)}</p></li>
          ))}
          {(q?.failedDocuments ?? []).length === 0 ? <li className="px-5 py-6 text-center text-[13px] text-muted">No failed documents.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
