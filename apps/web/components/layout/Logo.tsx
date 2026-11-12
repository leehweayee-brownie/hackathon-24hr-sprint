/* eslint-disable @next/next/no-img-element -- static brand asset from Figma */
import { cn } from '@/utils/cn';

/** VendVet brand: Figma "logo" (32×32) + wordmark (Inter 18/28 semibold, gray-900). */
export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img src="/figma/dashboard/logo.svg" alt="" width={32} height={32} className="size-8 shrink-0" />
      {compact ? null : <span className="text-lg font-semibold leading-7 text-gray-900">VendVet</span>}
    </span>
  );
}
