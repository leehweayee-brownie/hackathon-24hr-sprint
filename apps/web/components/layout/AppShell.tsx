'use client';

import { Bell, ChevronDown, CircleHelp, ClipboardCheck, FileText, LayoutDashboard, LogOut, Menu, PanelRightClose, PanelRightOpen, Settings2, User, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { CursorMenu } from '@/features/cursor/CursorMenu';
import { readCursorTheme, readSidebarCollapsed, toast, useUiStore } from '@/store/ui';
import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';
import { areaForUser, type Area } from '@/utils/roles';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  exact?: boolean;
}
interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV: Record<Area, NavSection[]> = {
  supplier: [
    {
      title: 'Overview',
      items: [
        { href: '/supplier', label: 'Dashboard', icon: LayoutDashboard, exact: true },
        { href: '/supplier/documents', label: 'Documents', icon: FileText },
        { href: '/supplier/passport', label: 'Passport & Sharing', icon: User },
      ],
    },
    { title: 'Account', items: [{ href: '/notifications', label: 'Notifications', icon: Bell }] },
  ],
  buyer: [
    {
      title: 'Overview',
      items: [
        { href: '/buyer', label: 'Dashboard', icon: LayoutDashboard, exact: true },
        { href: '/buyer/checks', label: 'Vendor checks', icon: ClipboardCheck },
      ],
    },
    { title: 'Account', items: [{ href: '/notifications', label: 'Notifications', icon: Bell }] },
  ],
  admin: [
    { title: 'Overview', items: [{ href: '/admin', label: 'Administration', icon: Settings2, exact: true }] },
    { title: 'Account', items: [{ href: '/notifications', label: 'Notifications', icon: Bell }] },
  ],
};

const AREA_BADGE: Record<Area, string> = { supplier: 'Supplier', buyer: 'Buyer', admin: 'Admin' };

/** Figma "Sidebar" (Preline): 260px, white, brand-tinted active item. Collapsed: 72px icon rail. */
function Sidebar({
  area,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  area: Area;
  onNavigate: () => void;
  collapsed?: boolean;
  /** Desktop only: shows the collapse button in the logo row. */
  onToggleCollapse?: () => void;
}) {
  const { user } = useAuth();
  const logout = useLogout();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <div className={cn('flex h-full flex-col border-r border-gray-200 bg-white transition-[width] duration-200', collapsed ? 'w-[72px]' : 'w-[260px]')}>
      {/* Figma "Logo" row: logo, wordmark, and a 32px outlined collapse button on the right */}
      <div className={cn('flex shrink-0 items-center', collapsed ? 'flex-col gap-3 py-4' : 'h-[65px] gap-2.5 px-6')}>
        <Logo compact={collapsed} className={collapsed ? undefined : 'min-w-0 flex-1'} />
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={`${collapsed ? 'Expand' : 'Collapse'} sidebar (⌘B)`}
            className="-mr-3.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-800 shadow-[0_1px_0_rgba(0,0,0,0.05)] hover:bg-gray-50 data-[collapsed=true]:mr-0"
            data-collapsed={collapsed}
          >
            {collapsed ? <PanelRightClose className="size-4" aria-hidden /> : <PanelRightOpen className="size-4" aria-hidden />}
          </button>
        ) : null}
      </div>

      <nav className={cn('flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden py-1', collapsed ? 'px-3' : 'px-4')} aria-label="Main">
        {NAV[area].map((section) => (
          <div key={section.title} className="flex flex-col gap-0.5">
            {collapsed ? (
              <div className="mx-2 mb-2 mt-4 border-t border-gray-200" role="separator" aria-label={section.title} />
            ) : (
              <p className="px-2.5 pb-1.5 pt-4 text-xs font-medium uppercase leading-4 tracking-[0.4px] text-gray-400">{section.title}</p>
            )}
            {section.items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-3.5 whitespace-nowrap rounded-lg py-2 text-sm leading-5 transition-colors',
                    collapsed ? 'justify-center px-2' : 'px-2.5',
                    active ? 'bg-brand-tint font-medium text-brand-700' : 'text-gray-700 hover:bg-gray-50',
                  )}
                >
                  <Icon className={cn('size-4 shrink-0', active ? 'text-brand' : 'text-gray-500')} aria-hidden />
                  {collapsed ? null : item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Figma sidebar bottom: "Cursor theme" (named Cursor Setting here) and "Sign out" rows above the user */}
      <div className={cn('border-t border-gray-200 py-2', collapsed ? 'px-3' : 'px-4')}>
        <CursorMenu collapsed={collapsed} />
      </div>
      <div className={cn('border-t border-gray-200 py-2', collapsed ? 'px-3' : 'px-4')}>
        <button
          type="button"
          onClick={logout}
          aria-label={collapsed ? 'Sign out' : undefined}
          title={collapsed ? 'Sign out' : undefined}
          className={cn(
            'flex w-full items-center gap-3.5 rounded-lg py-2 text-left text-sm leading-5 text-gray-700 transition-colors hover:bg-gray-50',
            collapsed ? 'justify-center px-2' : 'px-2.5',
          )}
        >
          <LogOut className="size-4 shrink-0 text-gray-500" aria-hidden />
          {collapsed ? null : 'Sign out'}
        </button>
      </div>

      <div ref={menuRef} className={cn('relative border-t border-gray-200', collapsed ? 'px-2 py-4' : 'p-4')}>
        {menuOpen ? (
          <div className={cn('absolute bottom-full z-10 mb-2 rounded-lg border border-gray-200 bg-white p-1 shadow-lg', collapsed ? 'left-2 w-44' : 'inset-x-4')} role="menu">
            <button type="button" role="menuitem" onClick={logout} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
              <LogOut className="size-4 text-gray-500" aria-hidden /> Sign out
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={collapsed ? `Account menu for ${user?.name ?? 'user'}` : undefined}
          title={collapsed ? user?.name : undefined}
          className={cn('flex w-full items-center gap-2.5 rounded-lg text-left', collapsed && 'justify-center')}
        >
          <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full border-2 border-white bg-brand-100 text-sm font-semibold leading-5 text-brand-800">
            {initials(user?.name ?? '?')}
          </span>
          {collapsed ? null : (
            <>
              <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <span className="w-full truncate text-sm font-medium leading-5 text-gray-800">{user?.name}</span>
                <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium leading-4 text-brand-800">{AREA_BADGE[area]}</span>
                <span className="w-full truncate text-xs leading-4 text-gray-500">{user?.organizationName}</span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-gray-400" aria-hidden />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const open = useUiStore((s) => s.sidebarOpen);
  const setOpen = useUiStore((s) => s.setSidebarOpen);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const setCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const area = areaForUser(user) ?? 'supplier';

  // Restore after mount so the server render and first client render match.
  const setCursorTheme = useUiStore((s) => s.setCursorTheme);
  useEffect(() => {
    if (readSidebarCollapsed()) setCollapsed(true);
    const cursor = readCursorTheme();
    if (cursor !== 'none') setCursorTheme(cursor);
  }, [setCollapsed, setCursorTheme]);

  // ⌘B / Ctrl+B toggles the desktop sidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setCollapsed(!useUiStore.getState().sidebarCollapsed);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCollapsed]);

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-50">
      <aside className="hidden h-full shrink-0 lg:block">
        <Sidebar area={area} onNavigate={() => undefined} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 bg-gray-900/40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="relative h-full w-fit" onClick={(e) => e.stopPropagation()}>
            <Sidebar area={area} onNavigate={() => setOpen(false)} />
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Figma "Topbar": white, bottom border, 12px padding */}
        <header className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white p-3">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden">
            <Menu className="size-4" />
          </button>
          <Logo compact className="lg:hidden" />
          <div className="flex-1" />
          <button
            type="button"
            aria-label="Help"
            onClick={() => toast({ title: 'Need help?', description: 'Ask your organisation admin, or see the demo guide in the project README.', tone: 'neutral' })}
            className="flex size-[38px] items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          >
            <CircleHelp className="size-[18px]" aria-hidden />
          </button>
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
