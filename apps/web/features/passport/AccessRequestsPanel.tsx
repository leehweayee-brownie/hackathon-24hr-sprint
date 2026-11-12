'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { PanelCard, PanelHeader, brandButtonClass, secondaryButtonClass } from '@/components/ui/PanelCard';
import { keys, useAccessRequests } from '@/hooks/queries';
import { errorMessage } from '@/services/http';
import { passportService } from '@/services/passport';
import { toast } from '@/store/ui';
import { formatRelative, initials } from '@/utils/format';

/** Figma "Card / Access requests": solid brand "N new" badge, requester with avatar, quoted message, Decline / Grant access. */
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
    <PanelCard data-testid="access-requests">
      <PanelHeader icon={Lock} title="Access requests" subtitle="Buyers asking to see your passport.">
        {list.length > 0 ? <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-xs font-medium leading-4 text-white">{list.length} new</span> : null}
      </PanelHeader>
      {list.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-500">No pending requests.</p>
      ) : (
        <ul>
          {list.map((r) => {
            const busy = respond.isPending && respond.variables?.id === r.id;
            return (
              <li key={r.id} className="flex flex-col gap-3 border-b border-gray-100 px-5 pb-5 pt-4 last:border-b-0">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-blue-100 text-xs font-semibold leading-4 text-blue-800">{initials(r.buyerName ?? '?')}</span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-sm font-medium leading-5 text-gray-800">{r.buyerName}</p>
                    <p className="truncate text-xs leading-4 text-gray-500">
                      {r.requestedByName ? `${r.requestedByName} · ` : ''}
                      {formatRelative(r.createdAt)}
                    </p>
                  </div>
                </div>
                {r.message ? <p className="rounded-lg border-l-2 border-gray-300 bg-gray-50 px-3 py-2.5 text-sm leading-5 text-gray-700">“{r.message}”</p> : null}
                <div className="flex gap-2">
                  <button type="button" className={`${secondaryButtonClass} flex-1`} disabled={busy} onClick={() => respond.mutate({ id: r.id, action: 'decline' })}>
                    Decline
                  </button>
                  <button type="button" className={`${brandButtonClass} flex-1`} disabled={busy} onClick={() => respond.mutate({ id: r.id, action: 'grant' })}>
                    Grant access
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}
