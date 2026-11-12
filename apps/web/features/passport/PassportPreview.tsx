'use client';

import { DOC_TYPE_DEFINITIONS, type PassportView } from '@vp/shared';
import { BadgeCheck, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DocTypeBadge } from '@/components/ui/DocTypeBadge';
import { DocumentStatusChip } from '@/components/ui/StatusChip';
import { ExpiryTimeline } from '@/features/timeline/ExpiryTimeline';
import { ScoreWithReasons } from '@/features/trust-score/ScoreWithReasons';
import { formatDate, formatDateTime } from '@/utils/format';

const DETAIL_LABELS: Record<string, string> = {
  company_name: 'Company name',
  registration_no: 'SSM registration no.',
  incorporation_date: 'Incorporated',
  registered_address: 'Registered address',
  cidb_grade: 'CIDB grade',
  cidb_categories: 'CIDB categories',
  company_status: 'Status',
};

export function PassportPreview({
  passport,
  documentHref,
  onViewDocument,
}: {
  passport: PassportView;
  documentHref?: (id: string) => string;
  onViewDocument?: (id: string) => void;
}) {
  const details = Object.entries(passport.companyDetails ?? {}).filter(([, v]) => v);
  const active = passport.documents.filter((d) => !d.supersededById);
  return (
    <div className="space-y-6" data-testid="passport-preview">
      <Card>
        <CardBody className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">{passport.supplierName}</h2>
              {passport.status === 'VERIFIED' ? (
                <Badge tone="success">
                  <BadgeCheck className="size-3.5" /> Verified passport
                </Badge>
              ) : (
                <Badge tone="neutral">Draft</Badge>
              )}
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {passport.registrationNo ? `SSM ${passport.registrationNo} · ` : ''}
              {passport.verifiedAt ? `Verified ${formatDate(passport.verifiedAt)} · ` : ''}
              Updated {formatDateTime(passport.updatedAt)}
            </p>
            {details.length > 0 ? (
              <dl className="mt-4 grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
                {details.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-muted">{DETAIL_LABELS[k] ?? k.replace(/_/g, ' ')}</dt>
                    <dd className="truncate font-medium text-ink" title={v ?? ''}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Trust score" description="Deterministic: the rules engine scores what the documents say. The AI only reads." />
        <CardBody>
          <ScoreWithReasons score={passport.trustScore} findings={passport.findings} documentHref={documentHref} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Expiry timeline" description="Amber within 30 days of expiry, red when expired." />
        <CardBody>
          <ExpiryTimeline entries={passport.timeline} documentHref={documentHref} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Documents" description={`${active.length} on file`} />
        <ul className="divide-y divide-line-soft">
          {active.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">{d.fileName}</p>
                  <p className="text-[12px] text-muted">
                    {d.docType ? DOC_TYPE_DEFINITIONS[d.docType].label : 'Unsorted'}
                    {d.expiresAt ? ` · expires ${formatDate(d.expiresAt)}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DocTypeBadge type={d.docType} short />
                <DocumentStatusChip status={d.status} />
                {onViewDocument ? (
                  <button onClick={() => onViewDocument(d.id)} className="text-[13px] font-medium text-primary hover:underline">
                    View
                  </button>
                ) : null}
              </div>
            </li>
          ))}
          {active.length === 0 ? <li className="px-5 py-6 text-center text-[13px] text-muted">No documents yet.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
