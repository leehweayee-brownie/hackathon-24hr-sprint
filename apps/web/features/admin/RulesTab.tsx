'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_RULE_WEIGHTS, RULE_LABELS, RuleCode } from '@vp/shared';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Input';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { adminService } from '@/services/admin';
import { errorMessage } from '@/services/http';
import { toast } from '@/store/ui';
import type { AdminRulesView } from '@/types';

export function RulesTab() {
  const qc = useQueryClient();
  const rules = useQuery({ queryKey: ['admin-rules'], queryFn: adminService.rules });
  const [draft, setDraft] = useState<AdminRulesView | null>(null);
  useEffect(() => {
    if (rules.data) setDraft({ ...rules.data, weights: { ...DEFAULT_RULE_WEIGHTS, ...rules.data.weights } });
  }, [rules.data]);
  const save = useMutation({ mutationFn: (v: AdminRulesView) => adminService.saveRules(v), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-rules'] }); toast({ title: 'Rules saved', description: 'Scores are recalculated on the next change.', tone: 'success' }); }, onError: (e) => toast({ title: 'Could not save', description: errorMessage(e), tone: 'danger' }) });
  if (rules.isLoading || !draft) return <PageSkeleton />;
  return (
    <Card>
      <CardHeader title="Rule weights" description="Points deducted per finding. Buyers can override these in their organisation settings." action={<Button onClick={() => save.mutate(draft)} loading={save.isPending}>Save</Button>} />
      <CardBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.values(RuleCode).map((code) => (
            <Field key={code} label={RULE_LABELS[code]} htmlFor={`w-${code}`}>
              <Input id={`w-${code}`} type="number" min={0} max={100} value={draft.weights[code] ?? 0} onChange={(e) => setDraft({ ...draft, weights: { ...draft.weights, [code]: Number(e.target.value) } })} />
            </Field>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Confidence threshold" hint="Fields below this must be confirmed by an officer" htmlFor="threshold">
            <Input id="threshold" type="number" min={0} max={1} step={0.01} value={draft.confidenceThreshold} onChange={(e) => setDraft({ ...draft, confidenceThreshold: Number(e.target.value) })} />
          </Field>
          <Field label="Expiry warning (days)" htmlFor="warning-days">
            <Input id="warning-days" type="number" min={1} value={draft.expiryWarningDays} onChange={(e) => setDraft({ ...draft, expiryWarningDays: Number(e.target.value) })} />
          </Field>
        </div>
      </CardBody>
    </Card>
  );
}
