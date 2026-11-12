'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DOC_TYPE_DEFINITIONS, VendorCheckStatus, type VendorCheckView } from '@vp/shared';
import { ChevronRight, CircleCheck, CircleX, FileText, Pencil, ShieldCheck, TriangleAlert, Wifi } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { DOC_TYPE_ICONS } from '@/components/ui/DocTypeBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { PanelCard, PanelHeader, secondaryButtonClass } from '@/components/ui/PanelCard';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { SoftBadge, type BadgeTone } from '@/features/dashboard/SoftBadge';
import { ExpiryTimelineCard } from '@/features/passport/supplier/ExpiryTimelineCard';
import { StatusBadge as DocumentStatusBadge } from '@/features/passport/supplier/DocumentsCard';
import { AuditPanel } from '@/features/vendor-checks/AuditPanel';
import { assessCheck, type CheckState, type Verdict } from '@/features/vendor-checks/assessment';
import { CheckStatusBadge, companyInitials, shortCompanyName } from '@/features/vendor-checks/CheckTableParts';
import { DecisionCard } from '@/features/vendor-checks/DecisionCard';
import { LowConfidenceFields } from '@/features/vendor-checks/LowConfidenceFields';
import { keys, useVendorCheck } from '@/hooks/queries';
import { errorMessage } from '@/services/http';
import { vendorChecksService } from '@/services/vendor-checks';
import { useIntakeSocket } from '@/socket/useIntakeSocket';
import { toast } from '@/store/ui';
import { cn } from '@/utils/cn';
import { formatDate, formatDateTime, formatMoney } from '@/utils/format';

type Tab = 'summary' | 'documents' | 'timeline' | 'history';

const BAND: Record<'green' | 'amber' | 'red', { tone: BadgeTone; label: string }> = {
  green: { tone: 'teal', label: 'Low risk' },
  amber: { tone: 'amber', label: 'Medium risk' },
  red: { tone: 'red', label: 'High risk' },
};

const VERDICT: Record<Verdict, { icon: typeof CircleCheck; text: string }> = {
  approve: { icon: CircleCheck, text: 'text-teal-700' },
  approve_with_conditions: { icon: CircleCheck, text: 'text-teal-700' },
  request_documents: { icon: TriangleAlert, text: 'text-amber-600' },
  do_not_approve: { icon: CircleX, text: 'text-brand' },
};

/** Figma checklist states: icon colour and the soft badge with a dot. */
const CHECK_STATE: Record<CheckState, { label: string; icon: typeof CircleCheck; iconColor: string; badge: string; dot: string }> = {
  passed: { label: 'Passed', icon: CircleCheck, iconColor: 'text-teal-600', badge: 'bg-teal-100 text-teal-800', dot: 'bg-teal-500' },
  condition: { label: 'Needs condition', icon: TriangleAlert, iconColor: 'text-amber-500', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  monitor: { label: 'Monitor', icon: TriangleAlert, iconColor: 'text-amber-500', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  failed: { label: 'Failed', icon: CircleX, iconColor: 'text-brand', badge: 'bg-brand-100 text-brand-800', dot: 'bg-brand' },
};

/** Header badge: an open check reads as waiting on the buyer. */
function HeaderStatus({ check }: { check: VendorCheckView }) {
  if (check.status === VendorCheckStatus.IN_REVIEW) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium leading-4 text-amber-800">
        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden /> Awaiting your decision
      </span>
    );
  }
  return <CheckStatusBadge status={check.status} />;
}

function Tile({ label, value, hint, hintClass }: { label: string; value: ReactNode; hint: ReactNode; hintClass?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-gray-200 p-3">
      <p className="text-xs leading-4 text-gray-500">{label}</p>
      <p className="tabular text-lg font-semibold leading-7 text-gray-900">{value}</p>
      <p className={cn('text-xs leading-4 text-gray-500', hintClass)}>{hint}</p>
    </div>
  );
}

export default function VendorCheckPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const check = useVendorCheck(id);
  const [tab, setTab] = useState<Tab>('summary');
  const [live, setLive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState('');
  const [draftTitle, setDraftTitle] = useState('');

  useIntakeSocket(
    {
      onConnect: setLive,
      onFindings: () => void qc.invalidateQueries({ queryKey: keys.check(id) }),
      onStatus: () => void qc.invalidateQueries({ queryKey: keys.check(id) }),
    },
    { supplierId: check.data?.supplierId ?? null },
  );

  const update = useMutation({
    mutationFn: () => vendorChecksService.update(id, { contractValue: Number(draftValue), tenderTitle: draftTitle }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.check(id) });
      setEditing(false);
      toast({ title: 'Check updated', description: 'Score recalculated for the new value.', tone: 'success' });
    },
    onError: (e) => toast({ title: 'Could not update', description: errorMessage(e), tone: 'danger' }),
  });

  if (check.isLoading) return <PageSkeleton />;
  if (check.isError || !check.data) return <EmptyState title="Vendor check not found" description={check.error ? errorMessage(check.error) : undefined} />;

  const c = check.data;
  const docHref = (docId: string) => `/buyer/documents/${docId}?check=${id}`;
  const documents = (c.documents ?? []).filter((d) => !d.supersededById);
  const a = assessCheck(c);
  const band = c.band ? BAND[c.band] : null;
  const verdict = VERDICT[a.verdict];
  const totalDeduction = (c.findings ?? []).reduce((n, f) => n + f.deduction, 0);
  const expiringSoon = (c.timeline ?? []).filter((t) => t.state === 'expiring' || t.state === 'expired');
  const nextExpiry = (c.timeline ?? [])
    .filter((t) => t.daysToExpiry !== null && t.daysToExpiry >= 0)
    .sort((x, y) => (x.daysToExpiry ?? 0) - (y.daysToExpiry ?? 0))[0];

  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-5 text-gray-800 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'summary', label: 'Summary' },
    { key: 'documents', label: `Documents · ${documents.length}` },
    { key: 'timeline', label: 'Expiry timeline' },
    { key: 'history', label: 'History' },
  ];

  return (
    <div className="flex flex-col gap-5" data-testid="vendor-check-page">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm leading-5" aria-label="Breadcrumb">
        <Link href="/buyer/checks" className="text-gray-500 hover:text-gray-800">
          Vendor checks
        </Link>
        <ChevronRight className="size-3.5 text-gray-400" aria-hidden />
        <span className="font-medium text-gray-800">{shortCompanyName(c.supplierName)}</span>
      </nav>

      {/* Page header */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-white bg-brand-100 text-base font-semibold leading-6 text-brand-800" aria-hidden>
          {companyInitials(c.supplierName)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold leading-8 text-gray-800">{c.supplierName}</h1>
            <HeaderStatus check={c} />
            {live ? (
              <span className="inline-flex items-center gap-1 text-xs leading-4 text-teal-700">
                <Wifi className="size-3.5" aria-hidden /> Live
              </span>
            ) : null}
          </div>
          <p className="text-sm leading-5 text-gray-500">
            {c.tenderTitle} · <span className="tabular font-medium text-gray-700">{formatMoney(c.contractValue)}</span> · started {formatDateTime(c.createdAt)}
            {c.decidedAt ? ` · decided ${formatDate(c.decidedAt)}${c.decidedByName ? ` by ${c.decidedByName}` : ''}` : ''}
          </p>
        </div>
        <button type="button" className={secondaryButtonClass} onClick={() => setTab('documents')}>
          <FileText className="size-4" aria-hidden /> View {documents.length} {documents.length === 1 ? 'document' : 'documents'}
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => {
            setDraftValue(String(c.contractValue));
            setDraftTitle(c.tenderTitle);
            setEditing(true);
          }}
        >
          <Pencil className="size-4" aria-hidden /> Edit tender
        </button>
      </div>

      {/* Figma "Tabs": underline, brand when active */}
      <div className="flex flex-wrap gap-x-6 border-b border-gray-200" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-0.5 py-3 text-sm leading-5',
              tab === t.key ? 'border-brand font-medium text-brand' : 'border-transparent text-gray-500 hover:text-gray-800',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-6">
          {tab === 'summary' ? (
            <>
              {/* Figma "Card / AI assessment" */}
              <PanelCard>
                <PanelHeader title="Assessment" subtitle={`Based on ${documents.length} uploaded ${documents.length === 1 ? 'document' : 'documents'} and ${(c.findings ?? []).length} rule findings`}>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-900 px-2 py-0.5 text-xs font-semibold leading-4 text-white">
                    <ShieldCheck className="size-3" aria-hidden /> Rules engine
                  </span>
                </PanelHeader>
                <div className="flex flex-col gap-5 p-5">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                    <div
                      className="flex w-full shrink-0 flex-col gap-1.5 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:w-[180px]"
                      data-testid="trust-score-ring"
                      data-score={c.trustScore ?? undefined}
                      data-band={c.band ?? undefined}
                    >
                      <p className="flex items-end gap-1">
                        <span className="tabular text-4xl font-bold leading-10 text-gray-900">{c.trustScore ?? '—'}</span>
                        <span className="text-lg font-medium leading-7 text-gray-400">/ 100</span>
                      </p>
                      {band ? <SoftBadge tone={band.tone}>{band.label}</SoftBadge> : <span className="text-xs text-gray-500">Scoring…</span>}
                      <p className="text-xs leading-4 text-gray-500">
                        {(c.findings ?? []).length === 0 ? 'No deductions' : `${(c.findings ?? []).length} deductions · −${totalDeduction}`}
                      </p>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <p className="text-xs font-medium uppercase leading-4 tracking-[0.4px] text-gray-500">Recommendation</p>
                      <p className={cn('flex items-center gap-2 text-lg font-semibold leading-7', verdict.text)}>
                        <verdict.icon className="size-5 shrink-0" aria-hidden /> {a.headline}
                      </p>
                      <p className="text-sm leading-5 text-gray-600">{a.summary}</p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2.5 rounded-lg bg-teal-50 p-4">
                      <p className="text-xs font-medium uppercase leading-4 tracking-[0.4px] text-gray-500">Strengths</p>
                      {a.strengths.length === 0 ? (
                        <p className="text-sm leading-5 text-gray-500">None yet. Strengths appear as documents pass the checks.</p>
                      ) : (
                        a.strengths.map((s) => (
                          <p key={s} className="flex items-start gap-2 text-sm leading-5 text-gray-700">
                            <CircleCheck className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden /> {s}
                          </p>
                        ))
                      )}
                    </div>
                    <div className="flex flex-col gap-2.5 rounded-lg bg-amber-50 p-4">
                      <p className="text-xs font-medium uppercase leading-4 tracking-[0.4px] text-gray-500">Watch-outs</p>
                      {a.watchOuts.length === 0 ? (
                        <p className="text-sm leading-5 text-gray-500">Nothing to watch. Every rule passed.</p>
                      ) : (
                        <>
                          {a.watchOuts.slice(0, 4).map((w, i) => (
                            <p key={`${w}-${i}`} className="flex items-start gap-2 text-sm leading-5 text-gray-700">
                              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden /> {w}
                            </p>
                          ))}
                          {a.watchOuts.length > 4 ? <p className="text-xs leading-4 text-gray-500">+{a.watchOuts.length - 4} more in the checklist</p> : null}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </PanelCard>

              {/* Figma "Card / Approval checklist" */}
              <PanelCard>
                <PanelHeader title="Approval checklist" subtitle={`${a.passed} of ${a.checklist.length} checks passed · from the rules engine`}>
                  <SoftBadge tone={a.passed === a.checklist.length ? 'teal' : 'amber'}>
                    {a.passed} / {a.checklist.length}
                  </SoftBadge>
                </PanelHeader>
                <ul>
                  {a.checklist.map((item) => {
                    const s = CHECK_STATE[item.state];
                    return (
                      <li key={item.key} className="flex items-center gap-3 border-b border-gray-100 px-5 py-3 last:border-b-0">
                        <s.icon className={cn('size-[18px] shrink-0', s.iconColor)} aria-hidden />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <p className="text-sm font-medium leading-5 text-gray-800">{item.title}</p>
                          <p className="text-xs leading-4 text-gray-500">{item.detail}</p>
                        </div>
                        <span className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium leading-4', s.badge)}>
                          <span className={cn('size-1.5 rounded-full', s.dot)} aria-hidden /> {s.label}
                        </span>
                        {item.documentId ? (
                          <Link href={docHref(item.documentId)} className="shrink-0 text-sm font-medium leading-5 text-brand hover:underline">
                            View
                          </Link>
                        ) : (
                          <button type="button" onClick={() => setTab('documents')} className="shrink-0 text-sm font-medium leading-5 text-brand hover:underline">
                            View
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </PanelCard>

              <LowConfidenceFields fields={c.lowConfidenceFields ?? []} checkId={id} documentHref={docHref} />

              {/* Figma "Card / Commercial snapshot", built from the tender and its documents */}
              <PanelCard>
                <PanelHeader title="Tender snapshot" subtitle={c.tenderTitle} />
                <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
                  <Tile
                    label="Contract value"
                    value={formatMoney(c.contractValue, { compact: true })}
                    hint={c.requiresApprover ? 'Needs approver sign-off' : 'Within buyer approval limit'}
                    hintClass={c.requiresApprover ? 'text-amber-700' : undefined}
                  />
                  <Tile
                    label="Required documents"
                    value={`${a.presentCount} / ${a.requiredCount}`}
                    hint={a.presentCount === a.requiredCount ? 'All provided' : `${a.requiredCount - a.presentCount} missing`}
                    hintClass={a.presentCount === a.requiredCount ? 'text-teal-700' : 'text-brand'}
                  />
                  <Tile label="Documents on file" value={documents.length} hint={`${documents.filter((d) => d.status === 'VERIFIED').length} verified`} />
                  <Tile
                    label="Expiring ≤ 30 days"
                    value={expiringSoon.length}
                    hint={nextExpiry ? `Next: ${nextExpiry.docTypeLabel}, ${formatDate(nextExpiry.expiresAt)}` : 'No expiry dates'}
                    hintClass={expiringSoon.length > 0 ? 'text-amber-700' : undefined}
                  />
                </div>
              </PanelCard>
            </>
          ) : null}

          {tab === 'documents' ? (
            <PanelCard>
              <PanelHeader title="Documents" subtitle={`${documents.length} on file · ${a.presentCount} of ${a.requiredCount} required types provided`} />
              {documents.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-gray-500">The vendor has not uploaded documents yet.</p>
              ) : (
                <ul>
                  {documents.map((d) => {
                    const def = d.docType ? DOC_TYPE_DEFINITIONS[d.docType] : null;
                    const TypeIcon = d.docType ? DOC_TYPE_ICONS[d.docType] : null;
                    return (
                      <li key={d.id} className="border-b border-gray-100 last:border-b-0">
                        <Link href={docHref(d.id)} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50">
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
                          <DocumentStatusBadge status={d.status} />
                          <span className="shrink-0 text-sm font-medium leading-5 text-brand">View</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelCard>
          ) : null}

          {tab === 'timeline' ? <ExpiryTimelineCard timeline={c.timeline ?? []} variant="public" /> : null}

          {tab === 'history' ? <AuditPanel entity="vendor_check" entityId={id} /> : null}
        </div>

        <div className="xl:sticky xl:top-0">
          <DecisionCard check={c} />
        </div>
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        variant="preline"
        title="Edit tender"
        description="Changing the value reruns the CIDB grade check."
        footer={
          <>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium leading-5 text-gray-800 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => update.mutate()}
              disabled={update.isPending}
              className="rounded-lg bg-brand px-4 py-3 text-sm font-medium leading-5 text-white hover:bg-brand-hover disabled:opacity-60"
            >
              Save
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="edit-title" className="text-sm font-medium leading-5 text-gray-800">
              Tender title
            </label>
            <input id="edit-title" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="edit-value" className="text-sm font-medium leading-5 text-gray-800">
              Contract value (RM)
            </label>
            <input id="edit-value" type="number" value={draftValue} onChange={(e) => setDraftValue(e.target.value)} className={inputClass} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
