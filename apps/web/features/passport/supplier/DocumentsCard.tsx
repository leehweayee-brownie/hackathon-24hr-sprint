import { DOC_TYPE_DEFINITIONS, DocumentStatus, type DocumentView } from '@vp/shared';
import { FileText, Lock, Upload } from 'lucide-react';
import Link from 'next/link';
import { DOC_TYPE_ICONS } from '@/components/ui/DocTypeBadge';
import { PanelCard, PanelHeader, secondaryButtonClass } from '@/components/ui/PanelCard';
import { SoftBadge } from '@/features/dashboard/SoftBadge';
import { formatDate } from '@/utils/format';
import { isProcessing } from '@/utils/status';

export function StatusBadge({ status }: { status: DocumentStatus }) {
  if (status === DocumentStatus.VERIFIED) return <SoftBadge tone="teal">Verified</SoftBadge>;
  if (status === DocumentStatus.NEEDS_REVIEW) return <SoftBadge tone="amber">Needs review</SoftBadge>;
  if (status === DocumentStatus.FAILED) return <SoftBadge tone="red">Failed</SoftBadge>;
  return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium leading-4 text-gray-800">{isProcessing(status) ? 'Processing' : status}</span>;
}

/**
 * Figma "Card / Documents": one row per active document with its type chip and status.
 * The public variant drops the upload button, opens files with a "View" action, and ends with a full-access footnote.
 */
export function DocumentsCard({
  documents,
  variant = 'supplier',
  onViewDocument,
}: {
  documents: DocumentView[];
  variant?: 'supplier' | 'public';
  onViewDocument?: (id: string) => void;
}) {
  const isPublic = variant === 'public';
  const active = documents.filter((d) => !d.supersededById);
  const verified = active.filter((d) => d.status === DocumentStatus.VERIFIED).length;
  const review = active.filter((d) => d.status === DocumentStatus.NEEDS_REVIEW).length;
  return (
    <PanelCard>
      {isPublic ? (
        <PanelHeader title="Documents" subtitle={`${active.length} on file`} />
      ) : (
        <PanelHeader icon={FileText} title="Documents" subtitle={`${active.length} on file · ${verified} verified, ${review} ${review === 1 ? 'needs' : 'need'} review`}>
          <Link href="/supplier/documents" className={secondaryButtonClass}>
            <Upload className="size-4" aria-hidden /> Upload
          </Link>
        </PanelHeader>
      )}
      {active.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-500">No documents yet.</p>
      ) : (
        <ul>
          {active.map((d) => {
            const def = d.docType ? DOC_TYPE_DEFINITIONS[d.docType] : null;
            const TypeIcon = d.docType ? DOC_TYPE_ICONS[d.docType] : null;
            const row = (
              <>
                <FileText className="size-4 shrink-0 text-gray-400" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-sm font-medium leading-5 text-gray-800">{d.fileName}</p>
                  <p className="truncate text-xs leading-4 text-gray-500">
                    {d.docTypeLabel ?? 'Not sorted yet'}
                    {d.expiresAt ? ` · expires ${formatDate(d.expiresAt)}` : ''}
                  </p>
                </div>
                {def && TypeIcon ? (
                  <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium leading-4 text-gray-700 sm:inline-flex">
                    <TypeIcon className="size-3.5 text-gray-500" aria-hidden /> {def.shortLabel}
                  </span>
                ) : null}
                <StatusBadge status={d.status} />
              </>
            );
            return (
              <li key={d.id} className="border-b border-gray-100 last:border-b-0">
                {isPublic ? (
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    {row}
                    {onViewDocument ? (
                      <button type="button" onClick={() => onViewDocument(d.id)} className="shrink-0 text-sm font-medium leading-5 text-brand hover:underline">
                        View
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <Link href={`/supplier/documents/${d.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50">
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {isPublic ? (
        <p className="flex items-center gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3 text-xs leading-4 text-gray-500">
          <Lock className="size-3.5 shrink-0" aria-hidden /> Request full access to download originals and see the supplier’s contact details.
        </p>
      ) : null}
    </PanelCard>
  );
}
