'use client';

import type { DocumentView } from '@vp/shared';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { DOC_TYPE_ICONS } from '@/components/ui/DocTypeBadge';
import { cn } from '@/utils/cn';
import { DocumentCard } from './DocumentCard';
import { groupDocuments, type ColumnKey } from './grouping';
import type { UploadProgress } from '@/types';

function UploadingCard({ u }: { u: UploadProgress }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-card border border-dashed border-primary/50 bg-panel p-3" data-testid="uploading-card">
      <p className="truncate text-[13px] font-medium text-ink">{u.fileName}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
        {u.status === 'error' ? <span className="text-danger">{u.error ?? 'Upload failed'}</span> : (
          <>
            <Loader2 className="size-3 animate-spin" aria-hidden /> Uploading {u.progress}%
          </>
        )}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line-soft">
        <div className={cn('h-full', u.status === 'error' ? 'bg-danger' : 'bg-primary')} style={{ width: `${u.progress}%` }} />
      </div>
    </motion.div>
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
  const columns = groupDocuments(documents, { hideEmpty: false, includeSuperseded: true });
  const activeUploads = uploads.filter((u) => u.status !== 'done');
  const visible = columns.filter((c) => c.documents.length > 0 || (c.key === 'PROCESSING' && activeUploads.length > 0) || !['FAILED', 'PROCESSING'].includes(c.key));

  return (
    <LayoutGroup>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" data-testid="intake-board">
        {visible.map((col) => {
          const Icon = col.key !== 'PROCESSING' && col.key !== 'FAILED' ? DOC_TYPE_ICONS[col.key] : null;
          const count = col.documents.length + (col.key === 'PROCESSING' ? activeUploads.length : 0);
          return (
            <section
              key={col.key}
              className={cn('flex min-h-32 flex-col rounded-card border bg-surface/60 p-2', col.key === 'PROCESSING' ? 'border-primary/30' : col.key === 'FAILED' ? 'border-danger/30' : 'border-line-soft')}
              data-testid={`column-${col.key}`}
              data-column={col.key as ColumnKey}
            >
              <header className="flex items-center justify-between px-1.5 py-1">
                <h3 className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.05em] text-ink-3">
                  {Icon ? <Icon className="size-3.5 text-primary" aria-hidden /> : col.key === 'PROCESSING' ? <Loader2 className={cn('size-3.5', count > 0 && 'animate-spin text-primary')} aria-hidden /> : null}
                  {col.label}
                </h3>
                <span className="tabular text-[12px] text-muted">{count}</span>
              </header>
              <div className="mt-1 flex flex-1 flex-col gap-2">
                <AnimatePresence mode="popLayout">
                  {col.key === 'PROCESSING' ? activeUploads.map((u) => <UploadingCard key={u.localId} u={u} />) : null}
                  {col.documents.map((doc) => (
                    <DocumentCard key={doc.id} doc={doc} href={hrefFor(doc)} onDelete={onDelete} onReprocess={onReprocess} threshold={threshold} />
                  ))}
                </AnimatePresence>
                {count === 0 ? <p className="px-1.5 py-3 text-center text-[12px] text-muted/70">{col.key === 'PROCESSING' ? 'Idle' : 'None yet'}</p> : null}
              </div>
            </section>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
