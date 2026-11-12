'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  variant = 'default',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  /** `preline`: the Figma "Modal" spec (480px, 18/28 title, 24px padding, round close button). */
  variant?: 'default' | 'preline';
}) {
  const preline = variant === 'preline';
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            className={cn(
              'w-full',
              preline
                ? 'max-w-[480px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)]'
                : `${size === 'lg' ? 'max-w-2xl' : 'max-w-md'} rounded-card border border-line bg-panel shadow-xl`,
            )}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
          >
            {preline ? (
              <div className="flex items-start gap-3 border-b border-gray-200 px-6 py-5">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h2 className="text-lg font-semibold leading-7 text-gray-800">{title}</h2>
                  {description ? <p className="text-sm leading-5 text-gray-500">{description}</p> : null}
                </div>
                <button type="button" onClick={onClose} aria-label="Close" className="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800">
                  <X className="size-[18px]" aria-hidden />
                </button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
                  {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
                </div>
                <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close" className="-mr-2 px-2">
                  <X className="size-4" />
                </Button>
              </div>
            )}
            {children ? <div className={preline ? 'p-6' : 'px-5 py-4'}>{children}</div> : null}
            {footer ? (
              <div className={cn('flex justify-end gap-2 border-t', preline ? 'border-gray-200 px-6 py-4' : 'border-line-soft px-5 py-3')}>{footer}</div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
