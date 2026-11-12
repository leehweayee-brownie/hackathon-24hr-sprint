'use client';

import { DocumentStatus, type DocumentView } from '@vp/shared';
import { motion } from 'framer-motion';
import { AlertCircle, Copy, FileCheck, FileClock, FileWarning, FileX, History, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/utils/cn';
import { formatBytes, formatDate } from '@/utils/format';
import { isProcessing } from '@/utils/status';
import { countNeedsReview } from './grouping';

type Tone = 'teal' | 'amber' | 'red' | 'brand' | 'gray';

/** Figma "File tile": 36px, tinted fill and border, 18px file icon. Tint follows the document's state. */
const TILE: Record<Tone, string> = {
  teal: 'border-teal-200 bg-teal-50 text-teal-600',
  amber: 'border-amber-200 bg-amber-50 text-amber-600',
  red: 'border-red-200 bg-red-50 text-red-600',
  brand: 'border-brand-100 bg-brand-tint text-brand',
  gray: 'border-gray-200 bg-gray-50 text-gray-500',
};

/** Figma "Col / Document": compact file row with a tinted file tile, name, and "size · pages" meta. */
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
  const failed = doc.status === DocumentStatus.FAILED;
  const review = doc.status === DocumentStatus.NEEDS_REVIEW ? countNeedsReview(doc, threshold) : 0;
  const tone: Tone = processing ? 'brand' : failed ? 'red' : review > 0 ? 'amber' : doc.supersededById ? 'gray' : 'teal';
  const Icon = processing ? FileClock : failed ? FileX : review > 0 ? FileWarning : FileCheck;

  const meta = [
    formatBytes(doc.size),
    doc.pageCount > 0 ? `${doc.pageCount} page${doc.pageCount === 1 ? '' : 's'}` : null,
    doc.expiresAt ? `expires ${formatDate(doc.expiresAt)}` : null,
  ].filter(Boolean);

  return (
    <motion.div
      layout
      layoutId={`doc-${doc.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ layout: { duration: 0.4, ease: [0.2, 0, 0, 1] }, duration: 0.22 }}
      className="group flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50"
      data-testid="document-card"
      data-document-id={doc.id}
      data-status={doc.status}
    >
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg border', TILE[tone])}>
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link href={href} className="truncate text-sm font-medium leading-5 text-gray-800 hover:text-brand" title={doc.fileName}>
          {doc.fileName}
        </Link>
        <p className="flex min-w-0 items-center gap-1.5 text-xs leading-4 text-gray-500">
          {processing ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-brand">
              <Loader2 className="size-3 animate-spin" aria-hidden /> Reading {Math.round(doc.progress)}% ·
            </span>
          ) : null}
          <span className="truncate">{meta.join(' · ')}</span>
        </p>
        {failed ? (
          <p className="flex items-start gap-1 text-xs leading-4 text-red-600">
            <AlertCircle className="mt-px size-3 shrink-0" aria-hidden /> {doc.error ?? 'Could not read this file'}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {review > 0 ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium leading-4 text-amber-800" data-testid="needs-review-count">
            {review} to confirm
          </span>
        ) : null}
        {doc.duplicateOfId ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium leading-4 text-gray-700">
            <Copy className="size-3" aria-hidden /> Duplicate
          </span>
        ) : null}
        {doc.supersededById ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium leading-4 text-gray-700">
            <History className="size-3" aria-hidden /> Superseded
          </span>
        ) : null}
        {(onDelete || onReprocess) && !processing ? (
          <div className="flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            {onReprocess ? (
              <button
                type="button"
                onClick={() => onReprocess(doc)}
                aria-label={`Reprocess ${doc.fileName}`}
                title="Reprocess"
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                data-testid="reprocess"
              >
                <RefreshCw className="size-3.5" aria-hidden />
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(doc)}
                aria-label={`Delete ${doc.fileName}`}
                title="Delete"
                className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                data-testid="delete"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
