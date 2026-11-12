'use client';

import { DocumentStatus } from '@vp/shared';
import { ArrowRight, Bell, CalendarClock, FileCheck2, FolderUp, Inbox } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { Stat } from '@/components/ui/Stat';
import { FindingCard } from '@/features/findings/FindingCard';
import { TrustScoreRing } from '@/features/trust-score/TrustScoreRing';
import { useAccessRequests, useDocuments, useNotifications, usePassport } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { formatRelative } from '@/utils/format';

export default function SupplierDashboard() {
  const { user } = useAuth();
  const passport = usePassport();
  const docs = useDocuments();
  const requests = useAccessRequests('PENDING');
  const notifications = useNotifications();

  if (passport.isLoading || docs.isLoading) return <PageSkeleton />;
  const documents = (docs.data?.items ?? []).filter((d) => !d.supersededById);
  const verified = documents.filter((d) => d.status === DocumentStatus.VERIFIED).length;
  const review = documents.filter((d) => d.status === DocumentStatus.NEEDS_REVIEW).length;
  const expiring = passport.data?.timeline.filter((t) => t.state === 'expiring' || t.state === 'expired').length ?? 0;
  const findings = passport.data?.findings ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={user?.organizationName}
        title="Overview"
        description="Your passport is rebuilt every time a document changes."
        actions={
          <Link href="/supplier/documents">
            <Button>
              <FolderUp className="size-4" /> Upload documents
            </Button>
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardBody className="flex flex-col items-center py-6">
            <TrustScoreRing score={passport.data?.trustScore ?? null} />
            <p className="mt-3 text-center text-[13px] text-muted">
              {passport.data?.status === 'VERIFIED' ? 'Passport verified and shareable.' : 'Upload your documents to build the passport.'}
            </p>
            <Link href="/supplier/passport" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
              Open passport <ArrowRight className="size-3.5" />
            </Link>
          </CardBody>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat label="Documents on file" value={documents.length} hint={`${verified} verified · ${review} need review`} icon={<FileCheck2 className="size-4 text-muted" />} />
          <Stat label="Expiring or expired" value={expiring} tone={expiring > 0 ? 'warning' : 'neutral'} hint="Within 30 days" icon={<CalendarClock className="size-4 text-muted" />} />
          <Stat label="Access requests" value={requests.data?.length ?? 0} tone={(requests.data?.length ?? 0) > 0 ? 'info' : 'neutral'} hint="Buyers waiting for your passport" icon={<Inbox className="size-4 text-muted" />} />
          <Stat label="Unread notifications" value={notifications.data?.filter((n) => !n.readAt).length ?? 0} icon={<Bell className="size-4 text-muted" />} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="What needs attention" description="Findings from the cross-check" />
          <CardBody>
            {findings.length === 0 ? (
              <EmptyState title="Nothing to fix" description={documents.length === 0 ? 'Upload your documents to start.' : 'Your documents agree with each other.'} />
            ) : (
              <ul className="space-y-2">
                {findings.slice(0, 4).map((f, i) => (
                  <li key={i}>
                    <FindingCard finding={f} documentHref={(id) => `/supplier/documents/${id}`} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Latest notifications" action={<Link href="/notifications" className="text-[13px] font-medium text-primary hover:underline">All</Link>} />
          <CardBody className="p-0">
            {(notifications.data?.length ?? 0) === 0 ? (
              <EmptyState icon={Bell} title="No notifications yet" className="m-5" />
            ) : (
              <ul className="divide-y divide-line-soft">
                {notifications.data!.slice(0, 5).map((n) => (
                  <li key={n.id} className="px-5 py-3">
                    <p className="text-[13px] font-medium text-ink">{n.title}</p>
                    <p className="text-[12px] text-muted">{n.message} · {formatRelative(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
