'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useNotifications } from '@/hooks/queries';

export function NotificationBell() {
  const { data } = useNotifications();
  const unread = data?.filter((n) => !n.readAt).length ?? 0;
  return (
    <Link href="/notifications" className="relative flex size-9 items-center justify-center rounded-card text-ink-3 hover:bg-line-soft hover:text-ink" aria-label={`Notifications, ${unread} unread`}>
      <Bell className="size-4" />
      {unread > 0 ? (
        <span className="tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white" data-testid="unread-count">
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
