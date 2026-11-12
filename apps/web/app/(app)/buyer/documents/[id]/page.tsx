'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { DocumentViewer } from '@/features/document-viewer/DocumentViewer';
import { useDocument } from '@/hooks/queries';
import { errorMessage } from '@/services/http';

function BuyerDocument() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const checkId = params.get('check');
  const doc = useDocument(id);
  if (doc.isLoading) return <PageSkeleton />;
  if (doc.isError || !doc.data) return <EmptyState title="Document not available" description={doc.error ? errorMessage(doc.error) : 'You can only view documents of suppliers you are checking.'} />;
  return (
    <DocumentViewer
      doc={doc.data}
      backHref={checkId ? `/buyer/checks/${checkId}` : '/buyer'}
      backLabel={checkId ? 'Back to vendor check' : 'Back'}
      documentHref={(d) => `/buyer/documents/${d}${checkId ? `?check=${checkId}` : ''}`}
    />
  );
}

export default function BuyerDocumentPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BuyerDocument />
    </Suspense>
  );
}
