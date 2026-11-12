import { ShieldCheck } from 'lucide-react';
import { cn } from '@/utils/cn';

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-[-0.01em] text-ink', className)}>
      <span className="flex size-7 items-center justify-center rounded-[6px] bg-primary text-white">
        <ShieldCheck className="size-4" aria-hidden />
      </span>
      {compact ? null : <span>Vendor Passport</span>}
    </span>
  );
}
