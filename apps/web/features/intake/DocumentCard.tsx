'use client';

import { DocumentStatus, type DocumentView } from '@vp/shared';
import { motion } from 'framer-motion';
import { AlertCircle, Copy, FileImage, FileText, History, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { DocumentStatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/utils/cn';
import { formatDate, formatPercent } from '@/utils/format';
import { isProcessing } from '@/utils/status';
import { countNeedsReview } from './grouping';

export function DocumentCard({
  doc,
  href,
  onDelete,
  onReprocess,
  threshold,
}: {
  doc: DocumentView;
  href: string;
  onDelete?: (doc: DocumentView) => void;
  onReprocess?: (doc: DocumentView) => void;
  threshold?: number;
}) {
  const processing = isProcessing(doc.status);
  const review = countNeedsReview(doc, threshold);
  const Icon = doc.mimeType.startsWith('image/') ? FileImage : FileText;
  return (
    <motion.div
      layout
      layoutId={`doc-${doc.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ layout: { duration: 0.4, ease: [0.2, 0, 0, 1] }, duration: 0.22 }}
      className={cn('group rounded-card border border-line bg-panel p-3 shadow-card', processing && 'border-primary/40')}
      data-testid="document-card"
      data-document-id={doc.id}
      data-status={doc.status}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[6px] bg-surface text-ink-3">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate text-[13px] font-medium text-ink hover:text-primary" title={doc.fileName}>
            {doc.fileName}
          </Link>
          <p className="truncate text-[12px] text-muted">
            {doc.pageCount > 0 ? `${doc.pageCount} page${doc.pageCount === 1 ? '' : 's'}` : 'Uploaded'}
            {doc.classificationConfidence !== null ? ` · sorted at ${formatPercent(doc.classificationConfidence)}` : ''}
            {doc.expiresAt ? ` · expires ${formatDate(doc.expiresAt)}` : ''}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <DocumentStatusChip status={doc.status} progress={doc.progress} />
        {doc.status === DocumentStatus.NEEDS_REVIEW && review > 0 ? (
          <Badge tone="warning" data-testid="needs-review-count">
            {review} to confirm
          </Badge>
        ) : null}
        {doc.duplicateOfId ? (
          <Badge tone="neutral">
            <Copy className="size-3" aria-hidden /> Duplicate
          </Badge>
        ) : null}
        {doc.supersededById ? (
          <Badge tone="neutral">
            <History className="size-3" aria-hidden /> Superseded
          </Badge>
        ) : null}
      </div>
      {processing ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line-soft" aria-hidden>
          <motion.div className="h-full bg-primary" animate={{ width: `${Math.max(8, doc.progress)}%` }} transition={{ duration: 0.4 }} />
        </div>
      ) : null}
      {doc.status === DocumentStatus.FAILED ? (
        <p className="mt-2 flex items-start gap-1.5 text-[12px] text-danger">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {doc.error ?? 'Could not read this file'}
        </p>
      ) : null}
      {(onDelete || onReprocess) && !processing ? (
        <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {onReprocess ? (
            <button onClick={() => onReprocess(doc)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-ink-3 hover:bg-line-soft hover:text-ink" data-testid="reprocess">
              <RefreshCw className="size-3" /> Reprocess
            </button>
          ) : null}
          {onDelete ? (
            <button onClick={() => onDelete(doc)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-ink-3 hover:bg-danger-soft hover:text-danger" data-testid="delete">
              <Trash2 className="size-3" /> Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}
