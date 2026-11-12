'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useNotifications } from '@/hooks/queries';

/** Figma Topbar "Notifications": 38px round outlined button, brand dot when anything is unread. */
export function NotificationBell() {
  const { data } = useNotifications();
  const unread = data?.filter((n) => !n.readAt).length ?? 0;
  return (
    <Link
      href="/notifications"
      className="relative flex size-[38px] items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      aria-label={`Notifications, ${unread} unread`}
    >
      <Bell className="size-[18px]" aria-hidden />
      {unread > 0 ? <span className="absolute right-[9px] top-[9px] size-2 rounded-full border border-white bg-brand" data-testid="unread-count" /> : null}
    </Link>
  );
}
