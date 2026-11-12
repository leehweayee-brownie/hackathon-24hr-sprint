'use client';

import { useQueryClient } from '@tanstack/react-query';
import { DEFAULT_CONFIDENCE_THRESHOLD, DEFAULT_REQUIRED_DOC_TYPES, DOC_TYPES, DocumentStatus, docTypeLabel, type DocumentView } from '@vp/shared';
import { ChevronRight, Download, History } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { DocumentStatusChip } from '@/components/ui/StatusChip';
import { DropZone } from '@/features/intake/DropZone';
import { IntakeBoard } from '@/features/intake/IntakeBoard';
import { applyDocumentUpdate } from '@/features/intake/grouping';
import { keys, useDocuments } from '@/hooks/queries';
import { documentsService } from '@/services/documents';
import { errorMessage } from '@/services/http';
import { useIntakeSocket } from '@/socket/useIntakeSocket';
import { toast } from '@/store/ui';
import type { UploadProgress } from '@/types';
import { formatDate, formatDateTime } from '@/utils/format';

const FILTERS = { includeSuperseded: true, pageSize: 200 };

/** Figma secondary button: white, gray-200 border, 2xs shadow. */
const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium leading-5 text-gray-800 shadow-[0_1px_0_rgba(0,0,0,0.05)] hover:bg-gray-50';

/** Saves a CSV listing every document type: required or optional, and what is on file. */
function downloadChecklist(items: DocumentView[]) {
  const active = items.filter((d) => !d.supersededById && d.status !== DocumentStatus.FAILED);
  const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [['Document type', 'Required', 'Status', 'Files on file', 'Expires'].map(quote).join(',')];
  for (const type of DOC_TYPES) {
    const docs = active.filter((d) => d.docType === type);
    const expires = docs.map((d) => d.expiresAt).filter(Boolean).sort().pop();
    rows.push(
      [
        docTypeLabel(type),
        DEFAULT_REQUIRED_DOC_TYPES.includes(type) ? 'Yes' : 'No',
        docs.length > 0 ? 'Provided' : DEFAULT_REQUIRED_DOC_TYPES.includes(type) ? 'Missing' : 'Not provided',
        docs.map((d) => d.fileName).join('; '),
        expires ? formatDate(expires) : '',
      ]
        .map((v) => quote(String(v)))
        .join(','),
    );
  }
  const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'vendvet-document-checklist.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

export default function SupplierDocumentsPage() {
  const qc = useQueryClient();
  const docs = useDocuments(FILTERS);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DocumentView | null>(null);

  const patchDoc = useCallback(
    (update: Partial<DocumentView> & { id: string }) => {
      qc.setQueryData(keys.documents(FILTERS), (old: { items: DocumentView[]; meta: unknown } | undefined) =>
        old ? { ...old, items: applyDocumentUpdate(old.items, update) } : old,
      );
    },
    [qc],
  );

  useIntakeSocket({
    onStatus: (e) => {
      patchDoc({ id: e.documentId, status: e.status, progress: e.progress, error: e.error ?? null });
      if (e.status === DocumentStatus.VERIFIED || e.status === DocumentStatus.NEEDS_REVIEW || e.status === DocumentStatus.FAILED) {
        void qc.invalidateQueries({ queryKey: ['documents'] });
        void qc.invalidateQueries({ queryKey: keys.passport });
      }
    },
    onClassified: (e) => patchDoc({ id: e.documentId, docType: e.docType, classificationConfidence: e.confidence }),
    onExtracted: (e) => {
      patchDoc({ id: e.documentId, fields: e.fields });
      void qc.invalidateQueries({ queryKey: keys.document(e.documentId) });
    },
    onFindings: () => void qc.invalidateQueries({ queryKey: keys.passport }),
    onError: (e) => toast({ title: 'Processing error', description: e.message, tone: 'danger' }),
  });

  const onFiles = useCallback(
    async (files: File[]) => {
      const batch: UploadProgress[] = files.map((f, i) => ({ localId: `${Date.now()}-${i}`, fileName: f.name, size: f.size, progress: 0, status: 'uploading' }));
      setUploads((u) => [...u, ...batch]);
      try {
        const created = await documentsService.upload(files, (e) => {
          const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 50;
          setUploads((u) => u.map((x) => (batch.some((b) => b.localId === x.localId) ? { ...x, progress: pct } : x)));
        });
        setUploads((u) => u.filter((x) => !batch.some((b) => b.localId === x.localId)));
        qc.setQueryData(keys.documents(FILTERS), (old: { items: DocumentView[]; meta: unknown } | undefined) =>
          old ? { ...old, items: [...created, ...old.items.filter((d) => !created.some((c) => c.id === d.id))] } : old,
        );
        void qc.invalidateQueries({ queryKey: ['documents'] });
        toast({ title: `${created.length} file${created.length === 1 ? '' : 's'} uploaded`, description: 'Sorting and reading them now.', tone: 'success' });
      } catch (e) {
        const message = errorMessage(e);
        setUploads((u) => u.map((x) => (batch.some((b) => b.localId === x.localId) ? { ...x, status: 'error', error: message } : x)));
        toast({ title: 'Upload failed', description: message, tone: 'danger' });
        setTimeout(() => setUploads((u) => u.filter((x) => !batch.some((b) => b.localId === x.localId))), 6000);
      }
    },
    [qc],
  );

  const reprocess = async (doc: DocumentView) => {
    try {
      await documentsService.reprocess(doc.id);
      void qc.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Reprocessing', description: doc.fileName, tone: 'neutral' });
    } catch (e) {
      toast({ title: 'Could not reprocess', description: errorMessage(e), tone: 'danger' });
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      await documentsService.remove(pendingDelete.id);
      setPendingDelete(null);
      void qc.invalidateQueries({ queryKey: ['documents'] });
      void qc.invalidateQueries({ queryKey: keys.passport });
      toast({ title: 'Document deleted', tone: 'neutral' });
    } catch (e) {
      toast({ title: 'Could not delete', description: errorMessage(e), tone: 'danger' });
    }
  };

  if (docs.isLoading) return <PageSkeleton />;
  const items = docs.data?.items ?? [];
  const history = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-5">
      {/* Figma "Breadcrumb" */}
      <nav className="flex items-center gap-2 text-sm leading-5" aria-label="Breadcrumb">
        <Link href="/supplier/documents" className="text-gray-500 hover:text-gray-800">
          Documents
        </Link>
        <ChevronRight className="size-3.5 text-gray-400" aria-hidden />
        <span className="font-medium text-gray-800" aria-current="page">
          Upload batch
        </span>
      </nav>

      {/* Figma "Page header" */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-8 text-gray-800">Upload vendor documents</h1>
          <p className="text-sm leading-5 text-gray-500">Add 10–20 files per batch. VendVet classifies each file, reads expiry dates and checks compliance automatically.</p>
        </div>
        <button type="button" className={secondaryButton} onClick={() => setHistoryOpen(true)}>
          <History className="size-4" aria-hidden /> Upload history
        </button>
        <button type="button" className={secondaryButton} onClick={() => downloadChecklist(items)}>
          <Download className="size-4" aria-hidden /> Download checklist
        </button>
      </div>

      <DropZone onFiles={onFiles} />
      <IntakeBoard documents={items} uploads={uploads} hrefFor={(d) => `/supplier/documents/${d.id}`} onDelete={setPendingDelete} onReprocess={reprocess} threshold={DEFAULT_CONFIDENCE_THRESHOLD} />

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Upload history" description={`${history.length} file${history.length === 1 ? '' : 's'} uploaded, newest first`} size="lg">
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing uploaded yet.</p>
        ) : (
          <ul className="-mx-1 max-h-[60vh] divide-y divide-gray-100 overflow-y-auto">
            {history.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/supplier/documents/${d.id}`} className="block truncate text-sm font-medium text-gray-800 hover:text-brand">
                    {d.fileName}
                  </Link>
                  <p className="truncate text-xs text-gray-500">
                    {d.docTypeLabel ?? 'Not sorted yet'} · {formatDateTime(d.createdAt)}
                    {d.supersededById ? ' · replaced by a newer file' : ''}
                    {d.duplicateOfId ? ' · duplicate' : ''}
                  </p>
                </div>
                <DocumentStatusChip status={d.status} progress={d.progress} />
              </li>
            ))}
          </ul>
        )}
      </Modal>
      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete this document?"
        description={pendingDelete?.fileName}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Keep
            </Button>
            <Button variant="danger" onClick={remove} data-testid="confirm-delete">
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-muted">The cross-check and trust score are recalculated without it.</p>
      </Modal>
    </div>
  );
}
