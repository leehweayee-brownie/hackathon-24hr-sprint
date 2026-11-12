'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_REQUIRED_DOC_TYPES, DOC_TYPE_DEFINITIONS, DocType, SCORED_DOC_TYPES } from '@vp/shared';
import { Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSuppliers } from '@/hooks/queries';
import { errorMessage } from '@/services/http';
import { passportService } from '@/services/passport';
import { vendorChecksService } from '@/services/vendor-checks';
import { toast } from '@/store/ui';
import { cn } from '@/utils/cn';
import { formatMoney } from '@/utils/format';

const schema = z.object({
  supplierId: z.string().min(1, 'Choose a supplier'),
  tenderTitle: z.string().min(3, 'Enter the tender or contract title'),
  contractValue: z.coerce.number().positive('Enter the contract value'),
  requiredDocTypes: z.array(z.nativeEnum(DocType)).min(1, 'Choose at least one required document'),
});
type FormValues = z.infer<typeof schema>;

export default function NewVendorCheckPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const suppliers = useSuppliers();
  const [requestMessage, setRequestMessage] = useState('');
  const { register, handleSubmit, control, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { supplierId: '', tenderTitle: '', contractValue: 0, requiredDocTypes: DEFAULT_REQUIRED_DOC_TYPES },
  });
  const supplierId = watch('supplierId');
  const value = watch('contractValue');

  const create = useMutation({
    mutationFn: (v: FormValues) => vendorChecksService.create(v),
    onSuccess: (check) => {
      void qc.invalidateQueries({ queryKey: ['vendor-checks'] });
      toast({ title: 'Vendor check started', description: check.supplierName, tone: 'success' });
      router.push(`/buyer/checks/${check.id}`);
    },
    onError: (e) => toast({ title: 'Could not start the check', description: errorMessage(e), tone: 'danger' }),
  });
  const requestAccess = useMutation({
    mutationFn: () => passportService.createAccessRequest({ supplierId, message: requestMessage || undefined }),
    onSuccess: () => toast({ title: 'Access requested', description: 'The supplier is notified and can grant you a share link.', tone: 'success' }),
    onError: (e) => toast({ title: 'Could not request access', description: errorMessage(e), tone: 'danger' }),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New vendor check" description="Score a supplier's passport against one tender or contract." />
      <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate>
        <Card>
          <CardBody className="space-y-5">
            <Field label="Supplier" error={formState.errors.supplierId?.message} htmlFor="supplierId">
              <Select id="supplierId" {...register('supplierId')} error={formState.errors.supplierId?.message} data-testid="supplier-select">
                <option value="">{suppliers.isLoading ? 'Loading suppliers…' : 'Choose a supplier'}</option>
                {(suppliers.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.registrationNo ? ` (${s.registrationNo})` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tender or contract" error={formState.errors.tenderTitle?.message} htmlFor="tenderTitle">
              <Input id="tenderTitle" placeholder="Package 3B: Earthworks and drainage, Sungai Buloh" {...register('tenderTitle')} error={formState.errors.tenderTitle?.message} />
            </Field>
            <Field label="Contract value (RM)" error={formState.errors.contractValue?.message} hint={value > 0 ? `${formatMoney(value)} — the CIDB grade is checked against this` : 'The CIDB grade is checked against this value'} htmlFor="contractValue">
              <Input id="contractValue" type="number" min={0} step={1000} placeholder="8000000" {...register('contractValue')} error={formState.errors.contractValue?.message} />
            </Field>
            <Controller
              control={control}
              name="requiredDocTypes"
              render={({ field }) => (
                <Field label="Required documents" error={formState.errors.requiredDocTypes?.message as string | undefined}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SCORED_DOC_TYPES.map((t) => {
                      const checked = field.value.includes(t);
                      return (
                        <label key={t} className={cn('flex cursor-pointer items-center gap-2.5 rounded-card border px-3 py-2 text-[13px]', checked ? 'border-primary bg-primary-soft/60 text-ink' : 'border-line bg-panel text-ink-3')}>
                          <input type="checkbox" className="accent-primary" checked={checked} onChange={(e) => field.onChange(e.target.checked ? [...field.value, t] : field.value.filter((x) => x !== t))} />
                          {DOC_TYPE_DEFINITIONS[t].label}
                        </label>
                      );
                    })}
                  </div>
                </Field>
              )}
            />
          </CardBody>
          <div className="flex justify-end gap-2 border-t border-line-soft px-5 py-3">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending} data-testid="create-check">
              Start check
            </Button>
          </div>
        </Card>
      </form>

      <Card className="mt-6">
        <CardHeader title="No passport shared yet?" description="Ask the supplier for access to their passport from inside the app." />
        <CardBody className="space-y-3">
          <Textarea value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} placeholder="Hi, we are evaluating you for Package 3B and would like to view your Vendor Passport." className="min-h-20" />
          <div className="flex justify-end">
            <Button variant="secondary" disabled={!supplierId} onClick={() => requestAccess.mutate()} loading={requestAccess.isPending}>
              <Send className="size-4" /> Request access
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
