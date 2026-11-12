'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DOC_TYPE_DEFINITIONS, type DocType, type DocumentFieldView } from '@vp/shared';
import { Check, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfidenceBar } from '@/components/ui/ConfidenceBar';
import { Input } from '@/components/ui/Input';
import { documentsService } from '@/services/documents';
import { errorMessage } from '@/services/http';
import { toast } from '@/store/ui';

type Row = DocumentFieldView & { documentId: string; docType: DocType | null };

export function LowConfidenceFields({ fields, checkId, documentHref }: { fields: Row[]; checkId: string; documentHref: (id: string) => string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['vendor-check', checkId] });
    void qc.invalidateQueries({ queryKey: ['document'] });
  };
  const confirm = useMutation({ mutationFn: (id: string) => documentsService.confirmField(id), onSuccess: () => { invalidate(); toast({ title: 'Field confirmed', tone: 'success' }); }, onError: (e) => toast({ title: 'Could not confirm', description: errorMessage(e), tone: 'danger' }) });
  const correct = useMutation({ mutationFn: ({ id, value }: { id: string; value: string }) => documentsService.correctField(id, value), onSuccess: () => { invalidate(); setEditing(null); toast({ title: 'Field corrected', tone: 'success' }); }, onError: (e) => toast({ title: 'Could not correct', description: errorMessage(e), tone: 'danger' }) });

  if (fields.length === 0) return null;
  return (
    <Card data-testid="low-confidence-fields">
      <CardHeader title="Fields to confirm" description={`${fields.length} value${fields.length === 1 ? '' : 's'} below the confidence threshold. Confirm or correct before approval.`} />
      <CardBody className="p-0">
        <ul className="divide-y divide-line-soft">
          {fields.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3" data-testid="low-confidence-row">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-muted">
                  {f.docType ? DOC_TYPE_DEFINITIONS[f.docType].label : 'Document'} ·{' '}
                  <Link href={documentHref(f.documentId)} className="text-primary hover:underline">
                    open page {f.page}
                  </Link>
                </p>
                <p className="text-[13px] font-medium text-ink">
                  {f.label}: {editing === f.id ? null : <span className="font-normal">{f.value ?? <em className="text-muted">not found</em>}</span>}
                </p>
                {editing === f.id ? (
                  <form className="mt-1 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); correct.mutate({ id: f.id, value: draft }); }}>
                    <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 max-w-xs" autoFocus />
                    <Button size="sm" type="submit" loading={correct.isPending}>Save</Button>
                    <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </form>
                ) : null}
              </div>
              <ConfidenceBar value={f.confidence} />
              {editing !== f.id ? (
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => confirm.mutate(f.id)} loading={confirm.isPending && confirm.variables === f.id}>
                    <Check className="size-3.5" /> Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(f.id); setDraft(f.value ?? ''); }}>
                    <Pencil className="size-3.5" /> Correct
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
