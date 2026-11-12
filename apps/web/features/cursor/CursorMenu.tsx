'use client';

/* eslint-disable @next/next/no-img-element -- small static thumbnails from Figma */
import { ChevronRight, Palette } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useUiStore } from '@/store/ui';
import { cn } from '@/utils/cn';
import { CURSOR_THEMES } from './themes';

/**
 * Figma sidebar "Cursor theme" row and its flyout: None plus four drink cursors,
 * with an "In use" badge on the current one. Opens to the right of the sidebar.
 */
export function CursorMenu({ collapsed = false }: { collapsed?: boolean }) {
  const theme = useUiStore((s) => s.cursorTheme);
  const setTheme = useUiStore((s) => s.setCursorTheme);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={collapsed ? 'Cursor Setting' : undefined}
        title={collapsed ? 'Cursor Setting' : undefined}
        className={cn(
          'flex w-full items-center gap-3.5 rounded-lg py-2 text-left text-sm leading-5 text-gray-700 transition-colors hover:bg-gray-50',
          collapsed ? 'justify-center px-2' : 'px-2.5',
          open && 'bg-gray-50',
        )}
        data-testid="cursor-setting"
      >
        <Palette className="size-4 shrink-0 text-gray-500" aria-hidden />
        {collapsed ? null : (
          <>
            <span className="min-w-0 flex-1 truncate">Cursor Setting</span>
            <ChevronRight className="size-4 shrink-0 text-gray-400" aria-hidden />
          </>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Cursor theme"
          className="absolute bottom-0 left-full z-40 ml-2 flex w-[259px] flex-col gap-1 rounded-xl border border-gray-200 bg-white p-3 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)]"
        >
          {CURSOR_THEMES.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => setTheme(t.id)}
                className="flex min-h-10 items-center gap-2.5 rounded-lg px-2 py-1 text-left hover:bg-gray-50"
                data-testid={`cursor-${t.id}`}
              >
                {t.thumb ? (
                  <span className="flex size-8 shrink-0 items-center justify-center">
                    <img src={t.thumb} alt="" className="max-h-8 max-w-8 object-contain" />
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-gray-800">{t.label}</span>
                {active ? <span className="shrink-0 rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium leading-4 text-teal-800">In use</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
