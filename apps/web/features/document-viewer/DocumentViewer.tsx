'use client';

import { DEFAULT_CONFIDENCE_THRESHOLD, DocumentStatus, type DocumentFieldView, type DocumentView } from '@vp/shared';
import { ArrowLeft, Copy, History } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DocTypeBadge } from '@/components/ui/DocTypeBadge';
import { DocumentStatusChip } from '@/components/ui/StatusChip';
import { useFieldMutations } from '@/hooks/queries';
import { errorMessage } from '@/services/http';
import { toast } from '@/store/ui';
import { formatDate, formatPercent } from '@/utils/format';
import { FieldsPanel } from './FieldsPanel';
import { PageCanvas } from './PageCanvas';

export function DocumentViewer({
  doc,
  backHref,
  backLabel = 'Back',
  readOnly,
  fileUrlOverride,
  documentHref,
}: {
  doc: DocumentView;
  backHref: string;
  backLabel?: string;
  readOnly?: boolean;
  fileUrlOverride?: { url: string } | null;
  documentHref?: (id: string) => string;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { confirm, correct } = useFieldMutations(doc.id);
  const fields = doc.fields ?? [];
  const threshold = DEFAULT_CONFIDENCE_THRESHOLD;

  const run = async (field: DocumentFieldView, fn: () => Promise<unknown>, done: string) => {
    setBusyId(field.id);
    try {
      await fn();
      toast({ title: done, description: field.label, tone: 'success' });
    } catch (e) {
      toast({ title: 'Could not save', description: errorMessage(e), tone: 'danger' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div data-testid="document-viewer">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href={backHref} className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
            <ArrowLeft className="size-3.5" /> {backLabel}
          </Link>
          <h1 className="mt-1 truncate text-[20px] font-semibold tracking-[-0.01em] text-ink" title={doc.fileName}>
            {doc.fileName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-muted">
            <DocTypeBadge type={doc.docType} />
            <DocumentStatusChip status={doc.status} progress={doc.progress} />
            {doc.classificationConfidence !== null ? <span>sorted at {formatPercent(doc.classificationConfidence)}</span> : null}
            <span>·</span>
            <span>{doc.pageCount} page{doc.pageCount === 1 ? '' : 's'}</span>
            {doc.issuedAt ? <span>· issued {formatDate(doc.issuedAt)}</span> : null}
            {doc.expiresAt ? <span>· expires {formatDate(doc.expiresAt)}</span> : null}
            {doc.duplicateOfId ? (
              <Badge tone="neutral">
                <Copy className="size-3" /> Duplicate{documentHref ? <Link href={documentHref(doc.duplicateOfId)} className="underline">of this document</Link> : null}
              </Badge>
            ) : null}
            {doc.supersededById ? (
              <Badge tone="neutral">
                <History className="size-3" /> Superseded{documentHref ? <Link href={documentHref(doc.supersededById)} className="underline">by a newer document</Link> : null}
              </Badge>
            ) : null}
          </div>
        </div>
        {doc.status === DocumentStatus.NEEDS_REVIEW && !readOnly ? (
          <Button
            variant="secondary"
            onClick={async () => {
              for (const f of fields.filter((x) => x.needsConfirmation)) await confirm.mutateAsync(f.id);
              toast({ title: 'All fields confirmed', tone: 'success' });
            }}
            loading={confirm.isPending}
          >
            Confirm all remaining
          </Button>
        ) : null}
      </div>

      {doc.status === DocumentStatus.FAILED ? (
        <div className="mb-4 rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-[13px] text-danger">{doc.error ?? 'This document could not be processed.'}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <PageCanvas doc={doc} fields={fields} activeKey={activeKey} onSelect={setActiveKey} fileUrlOverride={fileUrlOverride} />
        </div>
        <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <FieldsPanel
            fields={fields}
            activeKey={activeKey}
            onSelect={setActiveKey}
            threshold={threshold}
            readOnly={readOnly}
            busyId={busyId}
            onConfirm={readOnly ? undefined : (f) => run(f, () => confirm.mutateAsync(f.id), 'Field confirmed')}
            onCorrect={readOnly ? undefined : (f, v) => run(f, () => correct.mutateAsync({ fieldId: f.id, value: v }), 'Field corrected')}
          />
        </aside>
      </div>
    </div>
  );
}
