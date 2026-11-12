'use client';

import { DocumentStatus, RULE_LABELS, Severity, type Finding, type NotificationView } from '@vp/shared';
import { ArrowRight, BadgeHelp, Bell, BellDot, CalendarClock, CircleAlert, FileText, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { KpiCard } from '@/features/dashboard/KpiCard';
import { SoftBadge, type BadgeTone } from '@/features/dashboard/SoftBadge';
import { TrustScoreGauge } from '@/features/dashboard/TrustScoreGauge';
import { useAccessRequests, useDocuments, useNotifications, usePassport } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils/cn';
import { formatDate, formatRelative } from '@/utils/format';

const DAY_MS = 24 * 60 * 60 * 1000;
const within24h = (iso: string) => Date.now() - new Date(iso).getTime() < DAY_MS;

const BAND: Record<'green' | 'amber' | 'red', { tone: BadgeTone; label: string }> = {
  red: { tone: 'red', label: 'High risk' },
  amber: { tone: 'amber', label: 'Medium risk' },
  green: { tone: 'teal', label: 'Low risk' },
};

const SEVERITY_TEXT: Record<Severity, string> = {
  [Severity.CRITICAL]: 'text-brand-800',
  [Severity.WARNING]: 'text-amber-700',
  [Severity.INFO]: 'text-blue-700',
};

/** Red "View more →" / "Open passport →" link from the design. */
function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium leading-5 text-brand hover:underline">
      {children} <ArrowRight className="size-4" aria-hidden />
    </Link>
  );
}

/** Figma card header: 32px icon box, 16/24 semibold title, actions on the right. */
function CardHeader({ icon: Icon, title, children }: { icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
        <Icon className="size-4 text-blue-600" aria-hidden />
      </span>
      <h2 className="min-w-0 flex-1 truncate text-base font-semibold leading-6 text-gray-800">{title}</h2>
      {children}
    </div>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  return (
    <li className="flex items-start justify-between gap-4 border-t border-gray-100 px-5 py-3">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          <span className="text-sm leading-5 text-gray-800">{RULE_LABELS[finding.rule] ?? finding.rule}</span>
          <span className={cn('text-xs uppercase leading-4', SEVERITY_TEXT[finding.severity])}>{finding.severity}</span>
        </p>
        <p className="text-xs leading-4 text-gray-500">{finding.message}</p>
      </div>
      <p className="tabular shrink-0 text-right text-[28px] font-semibold leading-10 text-brand">−{finding.deduction}</p>
    </li>
  );
}

function NotificationRow({ n }: { n: NotificationView }) {
  return (
    <li className="flex flex-col gap-1 border-t border-gray-100 px-5 py-3">
      <p className="text-xs font-medium uppercase leading-4 tracking-[0.4px] text-gray-500">
        {formatDate(n.createdAt, 'dd MMM yyyy')} · {formatRelative(n.createdAt)}
      </p>
      <p className="truncate text-sm font-medium leading-5 text-gray-800">{n.title}</p>
      <p className="line-clamp-2 text-xs leading-4 text-gray-500">{n.message}</p>
    </li>
  );
}

const DISMISS_KEY = 'vp-dashboard-flag-dismissed';

export default function SupplierDashboard() {
  const { user } = useAuth();
  const passport = usePassport();
  const docs = useDocuments();
  const requests = useAccessRequests('PENDING');
  const notifications = useNotifications();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissedFor(sessionStorage.getItem(DISMISS_KEY));
    } catch {
      /* storage unavailable */
    }
  }, []);

  if (passport.isLoading || docs.isLoading) return <PageSkeleton />;

  const documents = (docs.data?.items ?? []).filter((d) => !d.supersededById);
  const flagged = documents.filter((d) => d.status === DocumentStatus.NEEDS_REVIEW || d.status === DocumentStatus.FAILED);
  const flaggedRecently = flagged.filter((d) => within24h(d.updatedAt)).length;
  const flagSignature = flagged.map((d) => d.id).sort().join(',');
  const showFlag = flagged.length > 0 && dismissedFor !== flagSignature;

  const timeline = passport.data?.timeline ?? [];
  const expiring = timeline.filter((t) => t.state === 'expiring' || t.state === 'expired');
  const expiringNew = expiring.filter((t) => documents.some((d) => d.id === t.documentId && within24h(d.createdAt))).length;
  const findings = passport.data?.findings ?? [];
  const band = BAND[passport.data?.band ?? 'red'];
  const allNotifications = notifications.data ?? [];
  const unread = allNotifications.filter((n) => !n.readAt).length;

  const scoreMessage =
    documents.length === 0
      ? 'Upload your documents to build the passport.'
      : passport.data?.status === 'VERIFIED'
        ? 'Passport verified and ready to share.'
        : 'Resolve the findings below to raise your score.';

  const dismiss = () => {
    setDismissedFor(flagSignature);
    try {
      sessionStorage.setItem(DISMISS_KEY, flagSignature);
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-8 text-gray-800">Welcome, {user?.organizationName}</h1>
          <p className="text-sm leading-5 text-gray-500">Last login {formatDate(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <Link href="/supplier/documents" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium leading-5 text-white hover:bg-brand-hover">
          <Plus className="size-4" aria-hidden /> Upload documents
        </Link>
      </div>

      {/* AI flagged documents */}
      {showFlag ? (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4" role="status">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-yellow-200 bg-white">
            <Sparkles className="size-5 text-yellow-500" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-sm font-semibold leading-5 text-gray-800">
              {flaggedRecently > 0
                ? `AI flagged ${flaggedRecently} ${flaggedRecently === 1 ? 'document' : 'documents'} in the last 24 hours`
                : `AI flagged ${flagged.length} ${flagged.length === 1 ? 'document' : 'documents'}`}
            </p>
            <p className="text-sm leading-5 text-gray-600">
              {flagged.length} {flagged.length === 1 ? 'document needs' : 'documents need'} your attention for further edits.
            </p>
          </div>
          <button type="button" onClick={dismiss} className="rounded-lg px-3 py-2 text-sm font-medium leading-5 text-brand hover:bg-brand-100/60">
            Dismiss
          </button>
          <Link href="/supplier/documents" className="rounded-lg bg-brand px-3 py-2 text-sm font-medium leading-5 text-white hover:bg-brand-hover">
            Review now
          </Link>
        </div>
      ) : null}

      {/* Trust score and KPIs */}
      <div className="grid gap-6 xl:grid-cols-[389px_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-[15px] rounded-[14.5px] border border-gray-200 bg-white p-7 text-center">
          <TrustScoreGauge score={passport.data?.trustScore ?? null} tone={band.tone} />
          <p className="text-[14.5px] font-medium uppercase leading-[19.3px] tracking-[0.48px] text-gray-500">Trust score</p>
          <SoftBadge tone={band.tone}>{band.label}</SoftBadge>
          <p className="max-w-[329px] text-sm leading-5 text-black">{scoreMessage}</p>
          <MoreLink href="/supplier/passport">Open passport</MoreLink>
        </div>
        <div className="grid auto-rows-fr gap-6 sm:grid-cols-2">
          <KpiCard label="Documents on file" value={documents.length} icon={FileText} iconBox="bg-blue-50" iconColor="text-blue-600" />
          <KpiCard label="Expiring or expired" value={expiring.length} hint={`${expiringNew} new in the last 24 h`} icon={CalendarClock} iconBox="bg-amber-50" iconColor="text-amber-600" />
          <KpiCard label="Access requests" value={requests.data?.length ?? 0} icon={BadgeHelp} iconBox="bg-gray-100" iconColor="text-gray-500" />
          <KpiCard label="Unread notifications" value={unread} icon={BellDot} iconBox="bg-gray-100" iconColor="text-gray-500" />
        </div>
      </div>

      {/* Findings and notifications */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex h-[472px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]">
          <CardHeader icon={CircleAlert} title="What Needs Attention">
            <MoreLink href="/supplier/passport">View more</MoreLink>
          </CardHeader>
          {findings.length === 0 ? (
            <p className="border-t border-gray-100 px-5 py-6 text-sm text-gray-500">
              {documents.length === 0 ? 'Nothing to check yet. Upload your documents to start.' : 'Nothing needs attention. Your documents agree with each other.'}
            </p>
          ) : (
            <ul className="flex-1 overflow-y-auto">
              {findings.map((f, i) => (
                <FindingRow key={`${f.rule}-${i}`} finding={f} />
              ))}
            </ul>
          )}
        </section>

        <section className="flex h-[472px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]">
          <CardHeader icon={Bell} title="Latest Notifications">
            {allNotifications.length > 0 ? <SoftBadge tone="red">{allNotifications.length}</SoftBadge> : null}
            <MoreLink href="/notifications">View more</MoreLink>
          </CardHeader>
          {allNotifications.length === 0 ? (
            <p className="border-t border-gray-100 px-5 py-6 text-sm text-gray-500">No notifications yet.</p>
          ) : (
            <ul className="flex-1 overflow-y-auto">
              {allNotifications.map((n) => (
                <NotificationRow key={n.id} n={n} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
