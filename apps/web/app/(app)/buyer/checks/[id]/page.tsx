'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DOC_TYPE_DEFINITIONS, type DocType } from '@vp/shared';
import { ArrowLeft, FileText, Pencil, Wifi } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DocTypeBadge } from '@/components/ui/DocTypeBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { CheckStatusChip, DocumentStatusChip } from '@/components/ui/StatusChip';
import { FindingsList } from '@/features/findings/FindingsList';
import { ExpiryTimeline } from '@/features/timeline/ExpiryTimeline';
import { ScoreWithReasons } from '@/features/trust-score/ScoreWithReasons';
import { AuditPanel } from '@/features/vendor-checks/AuditPanel';
import { DecisionBar } from '@/features/vendor-checks/DecisionBar';
import { LowConfidenceFields } from '@/features/vendor-checks/LowConfidenceFields';
import { keys, useVendorCheck } from '@/hooks/queries';
import { errorMessage } from '@/services/http';
import { vendorChecksService } from '@/services/vendor-checks';
import { useIntakeSocket } from '@/socket/useIntakeSocket';
import { toast } from '@/store/ui';
import { formatDate, formatDateTime, formatMoney } from '@/utils/format';

export default function VendorCheckPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const check = useVendorCheck(id);
  const [live, setLive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState('');
  const [draftTitle, setDraftTitle] = useState('');

  useIntakeSocket(
    {
      onConnect: setLive,
      onFindings: () => void qc.invalidateQueries({ queryKey: keys.check(id) }),
      onStatus: () => void qc.invalidateQueries({ queryKey: keys.check(id) }),
    },
    { supplierId: check.data?.supplierId ?? null },
  );

  const update = useMutation({
    mutationFn: () => vendorChecksService.update(id, { contractValue: Number(draftValue), tenderTitle: draftTitle }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.check(id) });
      setEditing(false);
      toast({ title: 'Check updated', description: 'Score recalculated for the new value.', tone: 'success' });
    },
    onError: (e) => toast({ title: 'Could not update', description: errorMessage(e), tone: 'danger' }),
  });

  if (check.isLoading) return <PageSkeleton />;
  if (check.isError || !check.data) return <EmptyState title="Vendor check not found" description={check.error ? errorMessage(check.error) : undefined} />;
  const c = check.data;
  const docHref = (docId: string) => `/buyer/documents/${docId}?check=${id}`;
  const documents = (c.documents ?? []).filter((d) => !d.supersededById);
  const required = c.requiredDocTypes ?? [];
  const present = new Set(documents.map((d) => d.docType));

  return (
    <div className="mx-auto max-w-6xl" data-testid="vendor-check-page">
      <Link href="/buyer" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Review queue
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{c.supplierName}</h1>
            <CheckStatusChip status={c.status} />
            {live ? <span className="inline-flex items-center gap-1 text-[12px] text-success"><Wifi className="size-3.5" /> Live</span> : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {c.tenderTitle} · <span className="tabular font-medium text-ink">{formatMoney(c.contractValue)}</span> · started {formatDate(c.createdAt)}
            {c.decidedAt ? ` · decided ${formatDateTime(c.decidedAt)}${c.decidedByName ? ` by ${c.decidedByName}` : ''}` : ''}
          </p>
          {c.decisionNote ? <p className="mt-1 text-[13px] text-ink-3">“{c.decisionNote}”</p> : null}
        </div>
        <Button variant="secondary" onClick={() => { setDraftValue(String(c.contractValue)); setDraftTitle(c.tenderTitle); setEditing(true); }}>
          <Pencil className="size-4" /> Edit tender
        </Button>
      </div>

      <div className="space-y-6">
        <DecisionBar check={c} />

        <Card>
          <CardHeader title="Trust score" description="Recalculated whenever documents, rules or the tender value change." />
          <CardBody>
            <ScoreWithReasons score={c.trustScore} findings={c.findings ?? []} documentHref={docHref} />
          </CardBody>
        </Card>

        <LowConfidenceFields fields={c.lowConfidenceFields ?? []} checkId={id} documentHref={docHref} />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="All findings" description={`${c.findings?.length ?? 0} across ${documents.length} documents`} />
            <CardBody>
              <FindingsList findings={c.findings ?? []} documentHref={docHref} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Required documents" description="For this tender" />
            <CardBody className="p-0">
              <ul className="divide-y divide-line-soft">
                {required.map((t: DocType) => (
                  <li key={t} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                    <span className="text-ink">{DOC_TYPE_DEFINITIONS[t].label}</span>
                    {present.has(t) ? <span className="font-medium text-success">Provided</span> : <span className="font-medium text-danger">Missing</span>}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Expiry timeline" />
          <CardBody>
            <ExpiryTimeline entries={c.timeline ?? []} documentHref={docHref} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Documents" description={`${documents.length} on file`} />
          <ul className="divide-y divide-line-soft">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <Link href={docHref(d.id)} className="flex min-w-0 items-center gap-3 hover:text-primary">
                  <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="truncate text-[13px] font-medium">{d.fileName}</span>
                </Link>
                <div className="flex items-center gap-2">
                  <DocTypeBadge type={d.docType} short />
                  <DocumentStatusChip status={d.status} />
                  {d.expiresAt ? <span className="text-[12px] text-muted">expires {formatDate(d.expiresAt)}</span> : null}
                </div>
              </li>
            ))}
            {documents.length === 0 ? <li className="px-5 py-6 text-center text-[13px] text-muted">The supplier has not uploaded documents yet.</li> : null}
          </ul>
        </Card>

        <AuditPanel entity="vendor_check" entityId={id} />
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit tender"
        description="Changing the value reruns the CIDB grade check."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={() => update.mutate()} loading={update.isPending}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Tender title" htmlFor="edit-title"><Input id="edit-title" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} /></Field>
          <Field label="Contract value (RM)" htmlFor="edit-value"><Input id="edit-value" type="number" value={draftValue} onChange={(e) => setDraftValue(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
