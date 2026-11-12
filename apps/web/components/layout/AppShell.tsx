'use client';

import { Bell, ClipboardCheck, FolderUp, Home, IdCard, LogOut, Menu, Settings2, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { useUiStore } from '@/store/ui';
import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';
import { ROLE_LABELS, areaForUser, type Area } from '@/utils/roles';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  exact?: boolean;
}

const NAV: Record<Area, NavItem[]> = {
  supplier: [
    { href: '/supplier', label: 'Overview', icon: Home, exact: true },
    { href: '/supplier/documents', label: 'Documents', icon: FolderUp },
    { href: '/supplier/passport', label: 'Passport & sharing', icon: IdCard },
    { href: '/notifications', label: 'Notifications', icon: Bell },
  ],
  buyer: [
    { href: '/buyer', label: 'Overview', icon: Home, exact: true },
    { href: '/buyer/checks', label: 'Vendor checks', icon: ClipboardCheck },
    { href: '/notifications', label: 'Notifications', icon: Bell },
  ],
  admin: [
    { href: '/admin', label: 'Administration', icon: Settings2, exact: true },
    { href: '/notifications', label: 'Notifications', icon: Bell },
  ],
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const logout = useLogout();
  const pathname = usePathname();
  const open = useUiStore((s) => s.sidebarOpen);
  const setOpen = useUiStore((s) => s.setSidebarOpen);
  const area = areaForUser(user) ?? 'supplier';
  const items = NAV[area];

  const nav = (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              'flex h-9 items-center gap-2.5 rounded-card px-3 text-[13.5px] font-medium transition-colors duration-120',
              active ? 'bg-primary-soft text-primary' : 'text-ink-3 hover:bg-line-soft hover:text-ink',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel lg:flex">
        <div className="px-5 py-5">
          <Logo />
        </div>
        {nav}
        <div className="border-t border-line-soft px-3 py-3">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-line-soft text-[12px] font-semibold text-ink-2">{initials(user?.name ?? '?')}</span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-ink">{user?.name}</p>
              <p className="truncate text-[12px] text-muted">{user ? ROLE_LABELS[user.role] : ''}</p>
            </div>
          </div>
          <p className="truncate px-2 text-[12px] text-muted">{user?.organizationName}</p>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={logout}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-64 flex-col bg-panel" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-4">
              <Logo />
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="Close menu" className="px-2">
                <X className="size-4" />
              </Button>
            </div>
            {nav}
            <div className="px-3 py-3">
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
                <LogOut className="size-4" /> Sign out
              </Button>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-panel/90 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="Open menu" className="px-2">
              <Menu className="size-4" />
            </Button>
            <Logo compact />
          </div>
          <div className="hidden text-[13px] text-muted lg:block">{user?.organizationName}</div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
