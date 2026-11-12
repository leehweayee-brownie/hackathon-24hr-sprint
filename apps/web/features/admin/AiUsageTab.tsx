'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { Stat } from '@/components/ui/Stat';
import { adminService } from '@/services/admin';
import { formatDate } from '@/utils/format';

function BarChart({ data }: { data: Array<{ day: string; costUsd: number; calls: number }> }) {
  const w = 640;
  const h = 160;
  const pad = 24;
  const max = Math.max(0.01, ...data.map((d) => d.costUsd));
  const bw = data.length ? (w - pad * 2) / data.length : 0;
  return (
    <svg viewBox={`0 0 ${w} ${h + 24}`} className="w-full" role="img" aria-label="AI cost per day">
      <line x1={pad} x2={w - pad} y1={h} y2={h} stroke="var(--color-line)" />
      {data.map((d, i) => {
        const bh = (d.costUsd / max) * (h - 10);
        return (
          <g key={d.day}>
            <rect x={pad + i * bw + 2} y={h - bh} width={Math.max(2, bw - 4)} height={bh} fill="var(--color-primary)" rx={2}>
              <title>{`${formatDate(d.day)}: $${d.costUsd.toFixed(4)} · ${d.calls} calls`}</title>
            </rect>
            {data.length <= 14 || i % Math.ceil(data.length / 14) === 0 ? (
              <text x={pad + i * bw + bw / 2} y={h + 14} textAnchor="middle" fontSize={10} fill="var(--color-muted)">{d.day.slice(5)}</text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function AiUsageTab() {
  const usage = useQuery({ queryKey: ['admin-ai-usage'], queryFn: adminService.aiUsage });
  if (usage.isLoading) return <PageSkeleton />;
  const u = usage.data;
  const perCheck = u?.byCheck ?? [];
  const perSupplier = u?.bySupplier ?? [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Model calls" value={u?.totals.calls ?? 0} hint={u?.model ? `Model ${u.model}` : undefined} />
        <Stat label="Input tokens" value={(u?.totals.inputTokens ?? 0).toLocaleString()} />
        <Stat label="Output tokens" value={(u?.totals.outputTokens ?? 0).toLocaleString()} />
        <Stat label="Cost" value={`$${(u?.totals.costUsd ?? 0).toFixed(2)}`} hint={`${u?.totals.cached ?? 0} served from cache`} />
      </div>
      <Card>
        <CardHeader title="Cost per day" />
        <CardBody>{(u?.byDay.length ?? 0) > 0 ? <BarChart data={u!.byDay} /> : <p className="text-[13px] text-muted">No usage recorded yet.</p>}</CardBody>
      </Card>
      {(perCheck.length > 0 || perSupplier.length > 0) ? (
        <Card>
          <CardHeader title={perCheck.length ? 'Cost per vendor check' : 'Cost per supplier'} />
          <ul className="divide-y divide-line-soft">
            {(perCheck.length ? perCheck : perSupplier).map((r, i) => (
              <li key={i} className="flex justify-between px-5 py-2.5 text-[13px]"><span className="text-ink">{r.supplierName}</span><span className="tabular text-muted">{r.calls} calls · ${r.costUsd.toFixed(4)}</span></li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
