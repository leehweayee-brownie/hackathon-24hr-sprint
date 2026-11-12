'use client';

import { useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { AccessRequestsPanel } from '@/features/passport/AccessRequestsPanel';
import { PassportPreview } from '@/features/passport/PassportPreview';
import { ShareLinksPanel } from '@/features/passport/ShareLinksPanel';
import { keys, usePassport } from '@/hooks/queries';
import { errorMessage } from '@/services/http';
import { useIntakeSocket } from '@/socket/useIntakeSocket';

export default function SupplierPassportPage() {
  const qc = useQueryClient();
  const passport = usePassport();
  useIntakeSocket({ onFindings: () => void qc.invalidateQueries({ queryKey: keys.passport }) });
  if (passport.isLoading) return <PageSkeleton />;
  if (passport.isError || !passport.data) return <EmptyState title="Passport not available" description={passport.error ? errorMessage(passport.error) : undefined} />;
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Vendor Passport" description="One always-current profile. Share it by link with any buyer." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <PassportPreview passport={passport.data} documentHref={(id) => `/supplier/documents/${id}`} />
        <div className="space-y-6">
          <ShareLinksPanel />
          <AccessRequestsPanel />
        </div>
      </div>
    </div>
  );
}
