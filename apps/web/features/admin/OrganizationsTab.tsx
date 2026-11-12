'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Trash2, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { adminService } from '@/services/admin';
import { errorMessage } from '@/services/http';
import { toast } from '@/store/ui';
import { formatDate } from '@/utils/format';
import { ROLE_LABELS } from '@/utils/roles';

export function OrganizationsTab() {
  const qc = useQueryClient();
  const orgs = useQuery({ queryKey: ['admin-orgs'], queryFn: adminService.organizations });
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin-orgs'] });
  const suspend = useMutation({ mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) => adminService.suspendUser(id, suspended), onSuccess: invalidate, onError: (e) => toast({ title: 'Failed', description: errorMessage(e), tone: 'danger' }) });
  const remove = useMutation({ mutationFn: (id: string) => adminService.deleteUser(id), onSuccess: () => { invalidate(); setPendingDelete(null); toast({ title: 'User deleted', tone: 'neutral' }); }, onError: (e) => toast({ title: 'Failed', description: errorMessage(e), tone: 'danger' }) });
  if (orgs.isLoading) return <PageSkeleton />;
  return (
    <div className="space-y-4">
      {(orgs.data ?? []).map((o) => (
        <Card key={o.id}>
          <CardHeader title={<span className="flex items-center gap-2">{o.name} <Badge tone={o.type === 'BUYER' ? 'info' : o.type === 'ADMIN' ? 'neutral' : 'success'}>{o.type}</Badge></span>} description={`${o.registrationNo ?? 'No registration no.'} · since ${formatDate(o.createdAt)}`} />
          <ul className="divide-y divide-line-soft">
            {o.users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                <div>
                  <p className="font-medium text-ink">{u.name} <span className="font-normal text-muted">· {u.email}</span></p>
                  <p className="text-[12px] text-muted">{ROLE_LABELS[u.role]}{u.emailVerifiedAt ? '' : ' · email not verified'}{u.suspendedAt ? ' · suspended' : ''}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => suspend.mutate({ id: u.id, suspended: !u.suspendedAt })}>
                    {u.suspendedAt ? <><UserCheck className="size-3.5" /> Reinstate</> : <><Ban className="size-3.5" /> Suspend</>}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setPendingDelete({ id: u.id, name: u.name })}><Trash2 className="size-3.5" /></Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <Modal open={!!pendingDelete} onClose={() => setPendingDelete(null)} title="Delete user?" description={pendingDelete?.name} footer={<><Button variant="secondary" onClick={() => setPendingDelete(null)}>Cancel</Button><Button variant="danger" onClick={() => pendingDelete && remove.mutate(pendingDelete.id)} loading={remove.isPending}>Delete</Button></>}>
        <p className="text-[13px] text-muted">This cannot be undone.</p>
      </Modal>
    </div>
  );
}
