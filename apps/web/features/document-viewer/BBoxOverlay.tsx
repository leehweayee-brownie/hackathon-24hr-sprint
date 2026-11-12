'use client';

import type { DocumentFieldView } from '@vp/shared';
import { cn } from '@/utils/cn';

/** Absolutely positioned highlight boxes over one rendered page (bbox is in page fractions). */
export function BBoxOverlay({
  fields,
  page,
  activeKey,
  onSelect,
}: {
  fields: DocumentFieldView[];
  page: number;
  activeKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {fields
        .filter((f) => f.bbox && f.page === page)
        .map((f) => {
          const b = f.bbox!;
          const active = f.key === activeKey;
          const low = f.needsConfirmation;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelect(f.key)}
              data-testid={`bbox-${f.key}`}
              data-field-anchor={f.key}
              className={cn(
                'pointer-events-auto absolute rounded-[3px] border transition-all duration-220',
                active ? 'z-10 border-primary bg-primary/20 shadow-[0_0_0_3px_rgba(31,94,255,0.25)]' : low ? 'border-warning/80 bg-warning/15 hover:bg-warning/25' : 'border-primary/50 bg-primary/8 hover:bg-primary/18',
              )}
              style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.width * 100}%`, height: `${b.height * 100}%` }}
              title={`${f.label}: ${f.value ?? ''}`}
            />
          );
        })}
    </div>
  );
}
