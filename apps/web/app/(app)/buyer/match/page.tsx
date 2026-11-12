'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BriefParseResult, MatchResult, TenderRequirements, VendorMatch } from '@vp/shared';
import { Check, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { BriefStep } from '@/features/vendor-match/BriefStep';
import { RequirementsStep } from '@/features/vendor-match/RequirementsStep';
import { ShortlistStep } from '@/features/vendor-match/ShortlistStep';
import { shortCompanyName } from '@/features/vendor-checks/CheckTableParts';
import { errorMessage } from '@/services/http';
import { vendorMatchService } from '@/services/vendor-match';
import { toast } from '@/store/ui';
import { cn } from '@/utils/cn';

const STEPS = ['Brief', 'Requirements', 'Shortlist'];

/** Vendor Match: Find → Check → Award → Rate. This page is the Find step. */
export default function VendorMatchPage() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<BriefParseResult | null>(null);
  const [requirements, setRequirements] = useState<TenderRequirements | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<{ supplierId: string; action: 'invite' | 'request' } | null>(null);
  const step = result ? 2 : draft ? 1 : 0;

  const read = useMutation({
    mutationFn: vendorMatchService.brief,
    onSuccess: (res) => {
      setDraft(res);
      setRequirements(res.requirements);
      setResult(null);
      setChecks({});
    },
    onError: (e) => toast({ title: 'Could not read the brief', description: errorMessage(e), tone: 'danger' }),
  });

  const match = useMutation({
    mutationFn: vendorMatchService.shortlist,
    onSuccess: setResult,
    onError: (e) => toast({ title: 'Could not build the shortlist', description: errorMessage(e), tone: 'danger' }),
  });

  const act = async (m: VendorMatch, action: 'invite' | 'request') => {
    if (!result) return;
    setBusy({ supplierId: m.supplierId, action });
    try {
      const docTypes = m.gaps.filter((g) => g.requestable && g.docType).map((g) => g.docType!);
      const check =
        action === 'invite'
          ? await vendorMatchService.invite(m.supplierId, result.requirements)
          : await vendorMatchService.requestDocuments(m.supplierId, result.requirements, Array.from(new Set(docTypes)));
      setChecks((c) => ({ ...c, [m.supplierId]: check.id }));
      void qc.invalidateQueries({ queryKey: ['vendor-checks'] });
      toast({
        title: action === 'invite' ? `${shortCompanyName(m.supplierName)} invited to tender` : `Documents requested from ${shortCompanyName(m.supplierName)}`,
        description: action === 'invite' ? 'A vendor check is open and the supplier has been notified.' : 'They have been told exactly what to upload.',
        tone: 'success',
      });
    } catch (e) {
      toast({ title: action === 'invite' ? 'Could not invite' : 'Could not request documents', description: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const restart = () => {
    setDraft(null);
    setRequirements(null);
    setResult(null);
    setChecks({});
  };

  return (
    <div className="flex flex-col gap-6" data-testid="vendor-match-page">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-8 text-gray-800">Vendor Match</h1>
          <p className="text-sm leading-5 text-gray-500">Turn a tender brief into a ranked shortlist of verified vendors, with the reason for every fit and every gap.</p>
        </div>
        {step > 0 ? (
          <button type="button" onClick={restart} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium leading-5 text-gray-800 shadow-[0_1px_0_rgba(0,0,0,0.05)] hover:bg-gray-50">
            <RotateCcw className="size-4" aria-hidden /> New brief
          </button>
        ) : null}
      </div>

      {/* Step indicator */}
      <ol className="flex flex-wrap items-center gap-2 text-sm leading-5" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                i < step ? 'bg-teal-600 text-white' : i === step ? 'bg-brand text-white' : 'bg-gray-200 text-gray-600',
              )}
            >
              {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn(i === step ? 'font-medium text-gray-800' : 'text-gray-500')}>{label}</span>
            {i < STEPS.length - 1 ? <span className="mx-1 h-px w-8 bg-gray-300" aria-hidden /> : null}
          </li>
        ))}
      </ol>

      {step === 0 ? <BriefStep loading={read.isPending} onSubmit={(input) => read.mutate(input)} /> : null}

      {draft && requirements && !result ? (
        <RequirementsStep
          value={requirements}
          source={draft.source}
          assumptions={draft.assumptions}
          loading={match.isPending}
          onChange={setRequirements}
          onConfirm={() => match.mutate(requirements)}
        />
      ) : null}

      {result ? (
        <>
          <button type="button" onClick={() => setResult(null)} className="self-start text-sm font-medium leading-5 text-brand hover:underline">
            ← Edit requirements
          </button>
          <ShortlistStep result={result} checks={checks} busy={busy} onInvite={(m) => void act(m, 'invite')} onRequest={(m) => void act(m, 'request')} />
        </>
      ) : null}
    </div>
  );
}
