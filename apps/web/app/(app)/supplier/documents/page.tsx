'use client';

import { useQueryClient } from '@tanstack/react-query';
import { DEFAULT_CONFIDENCE_THRESHOLD, DocumentStatus, type DocumentView } from '@vp/shared';
import { Wifi, WifiOff } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { DropZone } from '@/features/intake/DropZone';
import { IntakeBoard } from '@/features/intake/IntakeBoard';
import { applyDocumentUpdate } from '@/features/intake/grouping';
import { keys, useDocuments } from '@/hooks/queries';
import { documentsService } from '@/services/documents';
import { errorMessage } from '@/services/http';
import { useIntakeSocket } from '@/socket/useIntakeSocket';
import { toast } from '@/store/ui';
import type { UploadProgress } from '@/types';

const FILTERS = { includeSuperseded: true, pageSize: 200 };

export default function SupplierDocumentsPage() {
  const qc = useQueryClient();
  const docs = useDocuments(FILTERS);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [connected, setConnected] = useState(false);
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
    onConnect: setConnected,
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
  const hasAny = items.length > 0 || uploads.length > 0;

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title="Documents"
        description="Drop everything at once. Each file sorts itself into place as it is read."
        actions={
          <span className={`inline-flex items-center gap-1.5 text-[12px] ${connected ? 'text-success' : 'text-muted'}`} data-testid="socket-status">
            {connected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />} {connected ? 'Live' : 'Reconnecting'}
          </span>
        }
      />
      <div className={hasAny ? 'mb-4' : 'mb-6'}>
        <DropZone onFiles={onFiles} compact={hasAny} />
      </div>
      <IntakeBoard documents={items} uploads={uploads} hrefFor={(d) => `/supplier/documents/${d.id}`} onDelete={setPendingDelete} onReprocess={reprocess} threshold={DEFAULT_CONFIDENCE_THRESHOLD} />
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
