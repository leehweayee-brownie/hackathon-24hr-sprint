'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorCode, VendorCheckStatus, type VendorCheckView } from '@vp/shared';
import { Check, MessageSquareWarning, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { keys } from '@/hooks/queries';
import { HttpError, errorMessage } from '@/services/http';
import { vendorChecksService } from '@/services/vendor-checks';
import { toast } from '@/store/ui';
import { formatMoney } from '@/utils/format';
import { isApprover } from '@/utils/roles';

type Action = 'approve' | 'reject' | 'request-info';

const COPY: Record<Action, { title: string; description: string; cta: string; variant: 'success' | 'danger' | 'primary' }> = {
  approve: { title: 'Approve this vendor', description: 'The supplier is notified and the check is closed as approved.', cta: 'Approve', variant: 'success' },
  reject: { title: 'Reject this vendor', description: 'Give the supplier a reason. They are notified.', cta: 'Reject', variant: 'danger' },
  'request-info': { title: 'Request more documents', description: 'Tell the supplier what is missing. The check stays open.', cta: 'Send request', variant: 'primary' },
};

export function DecisionBar({ check }: { check: VendorCheckView }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [approverError, setApproverError] = useState<string | null>(null);

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
      toast({ title: a === 'approve' ? 'Vendor approved' : a === 'reject' ? 'Vendor rejected' : 'Request sent to supplier', tone: a === 'reject' ? 'warning' : 'success' });
    },
    onError: (e) => {
      if (e instanceof HttpError && (e.code === ErrorCode.APPROVER_REQUIRED || e.status === 403)) {
        setApproverError(e.message);
      } else if (e instanceof HttpError && e.code === ErrorCode.FIELD_CONFIRMATION_REQUIRED) {
        setApproverError(e.message);
      } else {
        toast({ title: 'Could not record decision', description: errorMessage(e), tone: 'danger' });
      }
    },
  });

  const closed = check.status === VendorCheckStatus.APPROVED || check.status === VendorCheckStatus.REJECTED;
  if (closed) return null;
  const needsApprover = check.requiresApprover && !isApprover(user);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-panel px-4 py-3 shadow-card" data-testid="decision-bar">
      <div className="text-[13px] text-muted">
        {needsApprover ? (
          <span className="text-warning">Contract value {formatMoney(check.contractValue)} needs an approver&apos;s sign-off.</span>
        ) : (
          'Decide on this vendor. Every decision is written to the audit log.'
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setAction('request-info')} data-testid="request-info">
          <MessageSquareWarning className="size-4" /> Request documents
        </Button>
        <Button variant="danger" onClick={() => setAction('reject')} data-testid="reject">
          <X className="size-4" /> Reject
        </Button>
        <Button variant="success" onClick={() => setAction('approve')} data-testid="approve">
          <Check className="size-4" /> Approve
        </Button>
      </div>
      <Modal
        open={!!action}
        onClose={() => {
          setAction(null);
          setApproverError(null);
        }}
        title={action ? COPY[action].title : ''}
        description={action ? COPY[action].description : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button variant={action ? COPY[action].variant : 'primary'} onClick={() => action && mutation.mutate(action)} loading={mutation.isPending} disabled={action !== 'approve' && note.trim().length === 0} data-testid="decision-submit">
              {action ? COPY[action].cta : ''}
            </Button>
          </>
        }
      >
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={action === 'approve' ? 'Optional note for the record' : 'Reason shown to the supplier'} data-testid="decision-note" />
        {approverError ? (
          <p className="mt-3 rounded-card border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-warning" role="alert" data-testid="approver-error">
            {approverError}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
