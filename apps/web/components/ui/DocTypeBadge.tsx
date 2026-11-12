import { DOC_TYPE_DEFINITIONS, DocType } from '@vp/shared';
import { Award, Banknote, Building2, FileQuestion, FileText, HardHat, Receipt, Shield, Users } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/utils/cn';

export const DOC_TYPE_ICONS: Record<DocType, ComponentType<SVGProps<SVGSVGElement>>> = {
  [DocType.SSM]: Building2,
  [DocType.CIDB]: HardHat,
  [DocType.PUBLIC_LIABILITY]: Shield,
  [DocType.WORKMEN_COMP]: Users,
  [DocType.TAX_CLEARANCE]: Receipt,
  [DocType.BANK_REFERENCE]: Banknote,
  [DocType.ISO]: Award,
  [DocType.OTHER]: FileQuestion,
};

export function DocTypeBadge({ type, short, className }: { type: DocType | null | undefined; short?: boolean; className?: string }) {
  if (!type) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium text-muted', className)}>
        <FileText className="size-3.5" aria-hidden /> Unsorted
      </span>
    );
  }
  const def = DOC_TYPE_DEFINITIONS[type];
  const Icon = DOC_TYPE_ICONS[type];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-2 py-0.5 text-[12px] font-medium text-ink-2', className)}>
      <Icon className="size-3.5 text-primary" aria-hidden />
      {short ? def.shortLabel : def.label}
    </span>
  );
}
