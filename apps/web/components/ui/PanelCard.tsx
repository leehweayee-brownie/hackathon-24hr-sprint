import type { ComponentType, ReactNode, SVGProps } from 'react';
import { cn } from '@/utils/cn';

/** Figma card (Preline): white, gray-200 border, 12px radius, 2xs shadow. */
export function PanelCard({ children, className, ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('flex w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]', className)} {...props}>
      {children}
    </section>
  );
}

/** Figma "Card header": optional 32px blue-50 icon box, 16/24 semibold title, 12/16 subtitle, actions on the right. */
export function PanelHeader({
  icon: Icon,
  title,
  subtitle,
  children,
  bordered = true,
}: {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  bordered?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-3 px-5 py-4', bordered && 'border-b border-gray-200')}>
      {Icon ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
          <Icon className="size-4 text-blue-600" aria-hidden />
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="text-base font-semibold leading-6 text-gray-800">{title}</h2>
        {subtitle ? <p className="text-xs leading-4 text-gray-500">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Secondary button from the design: white, gray-200 border, 2xs shadow. */
export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium leading-5 text-gray-800 shadow-[0_1px_0_rgba(0,0,0,0.05)] hover:bg-gray-50 disabled:opacity-50';
/** Primary brand button from the design. */
export const brandButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium leading-5 text-white hover:bg-brand-hover disabled:opacity-50';
