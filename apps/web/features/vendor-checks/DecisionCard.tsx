'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorCode, VendorCheckStatus, type VendorCheckView } from '@vp/shared';
import { Check, CircleX, FileQuestion, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { keys } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { HttpError, errorMessage } from '@/services/http';
import { vendorChecksService } from '@/services/vendor-checks';
import { toast } from '@/store/ui';
import { cn } from '@/utils/cn';
import { formatDate, formatDateTime, formatMoney } from '@/utils/format';
import { isApprover } from '@/utils/roles';
import { CheckStatusBadge, shortCompanyName } from './CheckTableParts';
import { RatingPanel } from './RatingPanel';

type Action = 'approve' | 'reject' | 'request-info';

const COPY: Record<Action, { title: string; cta: string; button: string }> = {
  approve: {
    title: 'Approve vendor',
    cta: 'Confirm approval',
    button: 'bg-brand text-white hover:bg-brand-hover',
  },
  reject: { title: 'Reject vendor', cta: 'Reject vendor', button: 'bg-brand text-white hover:bg-brand-hover' },
  'request-info': {
    title: 'Request more documents',
    cta: 'Request more documents',
    button: 'bg-brand text-white hover:bg-brand-hover',
  },
};

/** Figma "Modal / Approve supplier", "Modal / Reject supplier" and the request-more-documents variant. */
const CONFIRM = {
  approve: {
    verb: 'Approve',
    consequence: 'They’ll be added to the approved vendor list and can receive new POs straight away.',
    badgeBg: 'bg-teal-100',
    badgeIcon: '/figma/share/check-circle.svg',
    cancel: 'Back to review',
    ctaIcon: Check,
  },
  reject: {
    verb: 'Reject',
    consequence: 'They won’t receive new POs for this tender, and the vendor is told why.',
    badgeBg: 'bg-brand-100',
    badgeIcon: '/figma/share/x-circle.svg',
    cancel: 'Cancel',
    ctaIcon: CircleX,
  },
  'request-info': {
    verb: 'Request more documents from',
    consequence: 'The check stays open. They’re told what’s missing and can upload it to their passport.',
    badgeBg: 'bg-yellow-100',
    badgeIcon: '/figma/share/file-question.svg',
    cancel: 'Cancel',
    ctaIcon: FileQuestion,
  },
} as const;

/** Figma "Card / Your decision": Reject and Approve side by side, with "Request more documents" underneath. */
export function DecisionCard({ check }: { check: VendorCheckView }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [approverError, setApproverError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const mutation = useMutation({
    mutationFn: async (a: Action) => {
      if (a === 'approve') return vendorChecksService.approve(check.id, note || undefined);
      if (a === 'reject') return vendorChecksService.reject(check.id, note);
      return vendorChecksService.requestInfo(check.id, note);
    },
    onSuccess: (_, a) => {
      void qc.invalidateQueries({ queryKey: keys.check(check.id) });
      void qc.invalidateQueries({ queryKey: ['vendor-checks'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
      setAction(null);
      setNote('');
      toast({ title: a === 'approve' ? 'Vendor approved' : a === 'reject' ? 'Vendor rejected' : 'Request sent to vendor', tone: a === 'reject' ? 'warning' : 'success' });
    },
    onError: (e) => {
      if (e instanceof HttpError && (e.code === ErrorCode.APPROVER_REQUIRED || e.code === ErrorCode.FIELD_CONFIRMATION_REQUIRED || e.status === 403)) {
        setApproverError(e.message);
      } else {
        toast({ title: 'Could not record decision', description: errorMessage(e), tone: 'danger' });
      }
    },
  });

  const closed = check.status === VendorCheckStatus.APPROVED || check.status === VendorCheckStatus.REJECTED;
  const needsApprover = check.requiresApprover && !isApprover(user);
  const open = (a: Action) => {
    setApproverError(null);
    setAcknowledged(false);
    setNote('');
    setAction(a);
  };
  /** Every decision uses the Figma confirmation layout: illustration, required note and a declaration to tick. */
  const confirming = action !== null;
  const confirm = CONFIRM[action ?? 'approve'];
  const canSubmit = note.trim().length > 0 && (!confirming || acknowledged);
  const close = () => {
    setAction(null);
    setApproverError(null);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]" data-testid="decision-bar">
      <div className="flex flex-col gap-0.5 border-b border-gray-200 px-5 py-4">
        <h2 className="text-base font-semibold leading-6 text-gray-800">{closed ? 'Decision' : 'Your decision'}</h2>
        <p className="text-xs leading-4 text-gray-500">
          Started {formatDate(check.createdAt)} · {check.requiresApprover ? 'Approver sign-off' : 'Buyer approval'}
        </p>
      </div>

      {closed ? (
        <div className="flex flex-col gap-2 px-5 py-4">
          <CheckStatusBadge status={check.status} />
          <p className="text-sm leading-5 text-gray-700">
            {check.decidedAt ? `Decided ${formatDateTime(check.decidedAt)}` : 'Decided'}
            {check.decidedByName ? ` by ${check.decidedByName}` : ''}.
          </p>
          {check.decisionNote ? <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm leading-5 text-gray-600">“{check.decisionNote}”</p> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-5 py-4">
          {needsApprover ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-4 text-amber-800">
              A {formatMoney(check.contractValue)} contract needs an approver&apos;s sign-off to approve.
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => open('reject')}
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-[#f29d9d] bg-white px-4 text-sm font-medium leading-5 text-brand-700 shadow-[0_1px_0_rgba(0,0,0,0.05)] hover:bg-brand-tint"
              data-testid="reject"
            >
              <CircleX className="size-4" aria-hidden /> Reject
            </button>
            <button
              type="button"
              onClick={() => open('approve')}
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 text-sm font-medium leading-5 text-white hover:bg-green-700"
              data-testid="approve"
            >
              <Check className="size-4" aria-hidden /> Approve
            </button>
          </div>
          <div className="flex flex-col items-start gap-1">
            <p className="text-sm leading-5 text-black">Some criteria have not been met?</p>
            <button
              type="button"
              onClick={() => open('request-info')}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium leading-5 text-brand hover:bg-brand-tint"
              data-testid="request-info"
            >
              <FileQuestion className="size-4" aria-hidden /> Request more documents
            </button>
          </div>
        </div>
      )}

      {check.status === VendorCheckStatus.APPROVED && user?.organizationId === check.buyerId ? <RatingPanel check={check} /> : null}

      <Modal
        open={!!action}
        onClose={close}
        variant="preline"
        dense={confirming}
        title={action ? COPY[action].title : ''}
        footer={
          <>
            <button
              type="button"
              onClick={close}
              className={cn(
                'inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-medium leading-5 text-gray-800 shadow-[0_1px_0_rgba(0,0,0,0.05)] hover:bg-gray-50',
                confirming ? 'px-3 py-2' : 'px-4 py-3',
              )}
            >
              {confirming ? confirm.cancel : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => action && mutation.mutate(action)}
              disabled={mutation.isPending || !canSubmit}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium leading-5 disabled:opacity-50',
                confirming ? 'px-3 py-2' : 'px-4 py-3',
                action ? COPY[action].button : '',
              )}
              data-testid="decision-submit"
            >
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : confirming ? <confirm.ctaIcon className="size-4" aria-hidden /> : null}
              {action ? COPY[action].cta : ''}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          {confirming ? (
            /* Figma "Intro": kopi illustration with a status badge, question and consequence */
            <div className="mb-3 flex items-start gap-4">
              <div className="relative h-[86px] w-[93px] shrink-0" aria-hidden>
                <div className="absolute inset-0 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element -- static illustration from Figma */}
                  <img src="/figma/share/kopi.png" alt="" className="absolute left-[-10.54%] top-[-51.73%] h-[160.23%] w-[118.63%] max-w-none" />
                </div>
                <span className={cn('absolute left-[49px] top-[42px] flex size-11 items-center justify-center rounded-full', confirm.badgeBg)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={confirm.badgeIcon} alt="" width={22} height={22} className="size-[22px]" />
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-lg font-semibold leading-7 text-gray-800">
                  {confirm.verb} {shortCompanyName(check.supplierName)}?
                </p>
                <p className="text-sm leading-5 text-gray-600">{confirm.consequence}</p>
              </div>
            </div>
          ) : null}
          <label htmlFor="decision-note" className="text-sm font-medium leading-5 text-gray-800">
            {confirming ? (
              <>
                Note to vendor<span className="text-red-700">*</span>
              </>
            ) : (
              'Reason shown to the vendor'
            )}
          </label>
          <textarea
            id="decision-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={confirming ? 2 : 4}
            placeholder={confirming ? `Add context for ${check.supplierName}…` : action === 'request-info' ? 'e.g. Please upload the latest ISO certificate.' : 'e.g. CIDB grade does not cover the contract value.'}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-5 text-gray-800 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            data-testid="decision-note"
          />
          {confirming ? (
            /* Figma "Declaration": must be ticked before the decision can be confirmed */
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border-2 border-[#ad9a80] bg-[#886252] px-3.5 py-3 text-sm leading-5 text-white">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="peer sr-only"
                data-testid="decision-acknowledge"
              />
              <span
                className={cn(
                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-white/70',
                  acknowledged ? 'border-green-600 bg-green-600' : 'border-white/80 bg-white/10',
                )}
                aria-hidden
              >
                {acknowledged ? <Check className="size-3 text-white" strokeWidth={3} /> : null}
              </span>
              I have reviewed the information provided and acknowledge that this action cannot be undone.
            </label>
          ) : null}
          {approverError ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-800" role="alert" data-testid="approver-error">
              {approverError}
            </p>
          ) : null}
        </div>
      </Modal>
    </section>
  );
}
