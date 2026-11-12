'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { keys, useAccessRequests } from '@/hooks/queries';
import { errorMessage } from '@/services/http';
import { passportService } from '@/services/passport';
import { toast } from '@/store/ui';
import { formatRelative } from '@/utils/format';

export function AccessRequestsPanel() {
  const qc = useQueryClient();
  const requests = useAccessRequests('PENDING');
  const respond = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'grant' | 'decline' }) => passportService.respondAccessRequest(id, action),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: ['access-requests'] });
      void qc.invalidateQueries({ queryKey: keys.shares });
      toast({ title: v.action === 'grant' ? 'Access granted' : 'Request declined', description: v.action === 'grant' ? 'A share link was created for the buyer.' : undefined, tone: 'success' });
    },
    onError: (e) => toast({ title: 'Could not update request', description: errorMessage(e), tone: 'danger' }),
  });
  const list = requests.data ?? [];
  return (
    <Card data-testid="access-requests">
      <CardHeader title="Access requests" description="Buyers asking to see your passport." />
      <CardBody className="p-0">
        {list.length === 0 ? (
          <EmptyState icon={Inbox} title="No pending requests" className="m-5" />
        ) : (
          <ul className="divide-y divide-line-soft">
            {list.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-[13px] font-medium text-ink">{r.buyerName}</p>
                  <p className="text-[12px] text-muted">
                    {r.requestedByName ? `${r.requestedByName} · ` : ''}
                    {formatRelative(r.createdAt)}
                    {r.message ? ` · “${r.message}”` : ''}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => respond.mutate({ id: r.id, action: 'decline' })} loading={respond.isPending}>
                    Decline
                  </Button>
                  <Button size="sm" onClick={() => respond.mutate({ id: r.id, action: 'grant' })} loading={respond.isPending}>
                    Grant access
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
