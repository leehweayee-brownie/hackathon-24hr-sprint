'use client';

import { ScrollText } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAudit } from '@/hooks/queries';
import { formatDateTime } from '@/utils/format';

export function AuditPanel({ entity, entityId }: { entity: string; entityId: string }) {
  const { data, isLoading } = useAudit(entity, entityId);
  const list = data ?? [];
  return (
    <Card data-testid="audit-panel">
      <CardHeader title="Audit log" description="Every view, correction and decision." />
      <CardBody className="p-0">
        {isLoading ? <p className="px-5 py-4 text-[13px] text-muted">Loading…</p> : list.length === 0 ? (
          <EmptyState icon={ScrollText} title="No activity yet" className="m-5" />
        ) : (
          <ol className="divide-y divide-line-soft">
            {list.map((a) => (
              <li key={a.id} className="px-5 py-2.5 text-[13px]">
                <div className="flex justify-between gap-3">
                  <span className="font-medium text-ink">{a.action.replace(/[._]/g, ' ')}</span>
                  <span className="shrink-0 text-[12px] text-muted">{formatDateTime(a.createdAt)}</span>
                </div>
                <p className="text-[12px] text-muted">
                  {a.actorName ?? 'System'}
                  {a.metadata && Object.keys(a.metadata).length > 0 ? ` · ${Object.entries(a.metadata).slice(0, 3).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(', ')}` : ''}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
