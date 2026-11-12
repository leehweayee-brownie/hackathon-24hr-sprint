'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { DocumentViewer } from '@/features/document-viewer/DocumentViewer';
import { keys, useDocument } from '@/hooks/queries';
import { errorMessage } from '@/services/http';
import { useIntakeSocket } from '@/socket/useIntakeSocket';

export default function SupplierDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const doc = useDocument(id);
  useIntakeSocket({
    onStatus: (e) => e.documentId === id && void qc.invalidateQueries({ queryKey: keys.document(id) }),
    onExtracted: (e) => e.documentId === id && void qc.invalidateQueries({ queryKey: keys.document(id) }),
  });
  if (doc.isLoading) return <PageSkeleton />;
  if (doc.isError || !doc.data) return <EmptyState title="Document not found" description={doc.error ? errorMessage(doc.error) : undefined} />;
  return <DocumentViewer doc={doc.data} backHref="/supplier/documents" backLabel="All documents" documentHref={(d) => `/supplier/documents/${d}`} />;
}
