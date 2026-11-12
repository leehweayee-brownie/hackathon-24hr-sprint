'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { keys, useNotifications } from '@/hooks/queries';
import { notificationsService } from '@/services/notifications';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const list = useNotifications();
  const invalidate = () => void qc.invalidateQueries({ queryKey: keys.notifications });
  const markRead = useMutation({ mutationFn: (id: string) => notificationsService.markRead(id), onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: notificationsService.markAllRead, onSuccess: invalidate });
  if (list.isLoading) return <PageSkeleton />;
  const items = list.data ?? [];
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" description={unread ? `${unread} unread` : 'All caught up'} actions={unread ? <Button variant="secondary" onClick={() => markAll.mutate()} loading={markAll.isPending}><CheckCheck className="size-4" /> Mark all read</Button> : null} />
      <Card>
        {items.length === 0 ? <EmptyState icon={Bell} title="No notifications yet" className="m-5" /> : (
          <ul className="divide-y divide-line-soft" data-testid="notifications">
            {items.map((n) => (
              <li key={n.id} className={cn('flex items-start gap-3 px-5 py-3', !n.readAt && 'bg-primary-soft/40')} onClick={() => !n.readAt && markRead.mutate(n.id)}>
                <span className={cn('mt-2 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-primary')} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink">{n.title}</p>
                  <p className="text-[13px] text-ink-3">{n.message}</p>
                  <p className="mt-0.5 text-[12px] text-muted">{formatDateTime(n.createdAt)}{n.link ? <> · <Link href={n.link} className="text-primary hover:underline">Open</Link></> : null}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
