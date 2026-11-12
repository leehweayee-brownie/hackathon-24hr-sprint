'use client';

import { DocType, docTypeLabel, type DocumentView } from '@vp/shared';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { FileUp, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import type { UploadProgress } from '@/types';
import { DocumentCard } from './DocumentCard';
import { countNeedsReview, groupDocuments, type ColumnKey } from './grouping';

/** Card order in the Figma "Upload documents" frame (two columns). */
const TYPE_ORDER: DocType[] = [
  DocType.ISO,
  DocType.CIDB,
  DocType.PUBLIC_LIABILITY,
  DocType.SSM,
  DocType.BANK_REFERENCE,
  DocType.WORKMEN_COMP,
  DocType.TAX_CLEARANCE,
  DocType.OTHER,
];

function UploadingRow({ u }: { u: UploadProgress }) {
  const error = u.status === 'error';
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-lg p-2" data-testid="uploading-card">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg border', error ? 'border-red-200 bg-red-50 text-red-600' : 'border-brand-100 bg-brand-tint text-brand')}>
        <FileUp className="size-[18px]" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-sm font-medium leading-5 text-gray-800">{u.fileName}</p>
        {error ? (
          <p className="text-xs leading-4 text-red-600">{u.error ?? 'Upload failed'}</p>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full bg-brand transition-[width]" style={{ width: `${u.progress}%` }} />
            </div>
            <span className="tabular shrink-0 text-xs leading-4 text-gray-500">{u.progress}%</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Figma "Card / Upload queue": header with title, attention line and a gray file-count badge; files listed below. */
function TypeCard({
  columnKey,
  title,
  fileCount,
  attention,
  tone = 'default',
  children,
}: {
  columnKey: ColumnKey;
  title: ReactNode;
  fileCount: number;
  attention: number;
  tone?: 'default' | 'processing' | 'failed';
  children?: ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex flex-col self-start overflow-hidden rounded-xl border bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]',
        tone === 'processing' ? 'border-brand/30' : tone === 'failed' ? 'border-danger/30' : 'border-gray-200',
      )}
      data-testid={`column-${columnKey}`}
      data-column={columnKey}
    >
      <header className={cn('flex items-center gap-3 px-5 py-4', fileCount > 0 && 'border-b border-gray-200')}>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="flex items-center gap-2 truncate text-base font-semibold leading-6 text-gray-800">
            {tone === 'processing' ? <Loader2 className={cn('size-4 shrink-0', fileCount > 0 && 'animate-spin text-brand')} aria-hidden /> : null}
            {title}
          </h3>
          <p className="text-xs leading-4 text-gray-500">
            {attention} {attention === 1 ? 'file needs' : 'files need'} attention
          </p>
        </div>
        <span className="tabular shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium leading-4 text-gray-800">
          {fileCount} {fileCount === 1 ? 'file' : 'files'}
        </span>
      </header>
      {fileCount > 0 ? <div className="flex flex-col p-0.5">{children}</div> : null}
    </section>
  );
}

export function IntakeBoard({
  documents,
  uploads = [],
  hrefFor,
  onDelete,
  onReprocess,
  threshold,
}: {
  documents: DocumentView[];
  uploads?: UploadProgress[];
  hrefFor: (doc: DocumentView) => string;
  onDelete?: (doc: DocumentView) => void;
  onReprocess?: (doc: DocumentView) => void;
  threshold?: number;
}) {
  const columns = new Map(groupDocuments(documents, { includeSuperseded: true }).map((c) => [c.key, c]));
  const activeUploads = uploads.filter((u) => u.status !== 'done');
  const processing = columns.get('PROCESSING')?.documents ?? [];
  const failed = columns.get('FAILED')?.documents ?? [];
  const attentionIn = (docs: DocumentView[]) => docs.filter((d) => !d.supersededById && countNeedsReview(d, threshold) > 0).length;
  const card = (doc: DocumentView) => <DocumentCard key={doc.id} doc={doc} href={hrefFor(doc)} onDelete={onDelete} onReprocess={onReprocess} threshold={threshold} />;

  return (
    <LayoutGroup>
      <div className="flex w-full flex-col gap-5" data-testid="intake-board">
        {processing.length + activeUploads.length > 0 ? (
          <TypeCard columnKey="PROCESSING" title="Processing" tone="processing" fileCount={processing.length + activeUploads.length} attention={0}>
            <div className="grid md:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {activeUploads.map((u) => (
                  <UploadingRow key={u.localId} u={u} />
                ))}
                {processing.map(card)}
              </AnimatePresence>
            </div>
          </TypeCard>
        ) : null}

        <div className="grid items-start gap-5 md:grid-cols-2">
          {TYPE_ORDER.map((type) => {
            const docs = columns.get(type)?.documents ?? [];
            return (
              <TypeCard key={type} columnKey={type} title={docTypeLabel(type)} fileCount={docs.length} attention={attentionIn(docs)}>
                <AnimatePresence mode="popLayout">{docs.map(card)}</AnimatePresence>
              </TypeCard>
            );
          })}
        </div>

        {failed.length > 0 ? (
          <TypeCard columnKey="FAILED" title="Unreadable or failed" tone="failed" fileCount={failed.length} attention={failed.length}>
            <div className="grid md:grid-cols-2">
              <AnimatePresence mode="popLayout">{failed.map(card)}</AnimatePresence>
            </div>
          </TypeCard>
        ) : null}
      </div>
    </LayoutGroup>
  );
}
