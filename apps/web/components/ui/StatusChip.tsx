'use client';

import { DocumentStatus, VendorCheckStatus } from '@vp/shared';
import { Loader2 } from 'lucide-react';
import { Badge } from './Badge';
import { CHECK_STATUS_META, DOCUMENT_STATUS_META, isProcessing } from '@/utils/status';

export function DocumentStatusChip({ status, progress }: { status: DocumentStatus; progress?: number }) {
  const meta = DOCUMENT_STATUS_META[status];
  return (
    <Badge tone={meta.tone} data-testid="document-status">
      {isProcessing(status) ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
      {meta.label}
      {isProcessing(status) && progress !== undefined ? <span className="tabular opacity-70">{progress}%</span> : null}
    </Badge>
  );
}

export function CheckStatusChip({ status }: { status: VendorCheckStatus }) {
  const meta = CHECK_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
