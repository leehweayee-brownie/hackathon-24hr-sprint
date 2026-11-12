'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { adminService } from '@/services/admin';

export function DocTypesTab() {
  const types = useQuery({ queryKey: ['admin-doc-types'], queryFn: adminService.documentTypes });
  if (types.isLoading) return <PageSkeleton />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(types.data ?? []).map((t) => (
        <Card key={t.type}>
          <CardHeader title={<span className="flex items-center gap-2">{t.label} {t.hasExpiry ? <Badge tone="info">Expires</Badge> : null} {!t.scored ? <Badge>Not scored</Badge> : null}</span>} description={t.description} />
          <ul className="divide-y divide-line-soft">
            {t.fields.map((f) => (
              <li key={f.key} className="flex items-start justify-between gap-3 px-5 py-2 text-[13px]">
                <div><p className="font-medium text-ink">{f.label} <span className="font-mono text-[11px] text-muted">{f.key}</span></p><p className="text-[12px] text-muted">{f.description}</p></div>
                <span className="shrink-0 text-[12px] text-muted">{f.kind}{f.required ? ' · required' : ''}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
