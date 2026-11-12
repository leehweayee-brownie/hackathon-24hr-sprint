'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { secondaryButtonClass } from '@/components/ui/PanelCard';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { AccessRequestsPanel } from '@/features/passport/AccessRequestsPanel';
import { PassportPreview } from '@/features/passport/PassportPreview';
import { ShareLinksPanel } from '@/features/passport/ShareLinksPanel';
import { CompanyPassportCard } from '@/features/passport/supplier/CompanyPassportCard';
import { DocumentsCard } from '@/features/passport/supplier/DocumentsCard';
import { ExpiryTimelineCard } from '@/features/passport/supplier/ExpiryTimelineCard';
import { TrustScoreCard } from '@/features/passport/supplier/TrustScoreCard';
import { keys, usePassport } from '@/hooks/queries';
import { errorMessage } from '@/services/http';
import { useIntakeSocket } from '@/socket/useIntakeSocket';

export default function SupplierPassportPage() {
  const qc = useQueryClient();
  const passport = usePassport();
  const [preview, setPreview] = useState(false);
  useIntakeSocket({ onFindings: () => void qc.invalidateQueries({ queryKey: keys.passport }) });
  if (passport.isLoading) return <PageSkeleton />;
  if (passport.isError || !passport.data) return <EmptyState title="Passport not available" description={passport.error ? errorMessage(passport.error) : undefined} />;
  const p = passport.data;

  return (
    <div className="flex flex-col gap-6">
      {/* Figma "Page header" */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-8 text-gray-800">Vendor Passport</h1>
          <p className="text-sm leading-5 text-gray-500">One always-current profile. Share it by link with any buyer.</p>
        </div>
        <button type="button" className={secondaryButtonClass} onClick={() => setPreview(true)}>
          <Eye className="size-4" aria-hidden /> Preview as buyer
        </button>
      </div>

      {/* Figma "Passport grid": 712px left column, 380px right column */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <CompanyPassportCard passport={p} />
          <TrustScoreCard passport={p} />
          <ExpiryTimelineCard timeline={p.timeline} />
          <DocumentsCard documents={p.documents} />
        </div>
        <div className="flex flex-col gap-6">
          <ShareLinksPanel />
          <AccessRequestsPanel />
        </div>
      </div>

      <Modal open={preview} onClose={() => setPreview(false)} title="Preview as buyer" description="This is what a buyer sees when they open one of your share links." size="lg">
        <div className="max-h-[70vh] overflow-y-auto">
          <PassportPreview passport={p} />
        </div>
      </Modal>
    </div>
  );
}
