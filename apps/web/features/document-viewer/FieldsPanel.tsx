'use client';

import { DEFAULT_CONFIDENCE_THRESHOLD, type DocumentFieldView } from '@vp/shared';
import { Check, Pencil, UserCheck, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfidenceBar } from '@/components/ui/ConfidenceBar';
import { Input } from '@/components/ui/Input';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';

export function FieldRow({
  field,
  active,
  onSelect,
  onConfirm,
  onCorrect,
  busy,
  readOnly,
  threshold = DEFAULT_CONFIDENCE_THRESHOLD,
}: {
  field: DocumentFieldView;
  active: boolean;
  onSelect: () => void;
  onConfirm?: () => void;
  onCorrect?: (value: string) => void;
  busy?: boolean;
  readOnly?: boolean;
  threshold?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.correctedValue ?? field.rawValue ?? '');
  const confirmed = !!field.confirmedAt;
  const needs = field.needsConfirmation;
  return (
    <div
      className={cn('rounded-card border px-3 py-2.5 transition-colors duration-120', active ? 'border-primary bg-primary-soft/60' : needs ? 'border-warning/50 bg-warning-soft/40' : 'border-line-soft bg-panel hover:border-line')}
      onMouseEnter={onSelect}
      onClick={onSelect}
      data-testid={`field-${field.key}`}
      data-needs-confirmation={needs}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-muted">{field.label}</p>
          {editing ? (
            <form
              className="mt-1 flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                onCorrect?.(draft);
                setEditing(false);
              }}
            >
              <Input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus className="h-8" data-testid="correct-input" />
              <Button type="submit" size="sm" loading={busy} data-testid="correct-save">
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} className="px-2" aria-label="Cancel">
                <X className="size-4" />
              </Button>
            </form>
          ) : (
            <p className={cn('mt-0.5 break-words text-[14px] text-ink', !field.value && 'italic text-muted')} data-testid="field-value">
              {field.value ?? 'Not found'}
            </p>
          )}
          {field.correctedValue && field.rawValue && field.correctedValue !== field.rawValue ? (
            <p className="mt-0.5 text-[12px] text-muted">
              Read as <span className="line-through">{field.rawValue}</span>
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-[11px] text-muted">p.{field.page}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ConfidenceBar value={field.confidence} threshold={threshold} />
        {confirmed ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-success" title={formatDateTime(field.confirmedAt)}>
            <UserCheck className="size-3.5" aria-hidden /> {field.correctedValue ? 'Corrected' : 'Confirmed'}
            {field.confirmedByName ? ` by ${field.confirmedByName}` : ''}
          </span>
        ) : !readOnly && !editing ? (
          <div className="flex gap-1">
            <Button size="sm" variant={needs ? 'primary' : 'secondary'} onClick={(e) => { e.stopPropagation(); onConfirm?.(); }} loading={busy} data-testid="confirm">
              <Check className="size-3.5" /> Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(true); }} data-testid="correct">
              <Pencil className="size-3.5" /> Correct
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FieldsPanel({
  fields,
  activeKey,
  onSelect,
  onConfirm,
  onCorrect,
  busyId,
  readOnly,
  threshold,
}: {
  fields: DocumentFieldView[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  onConfirm?: (field: DocumentFieldView) => void;
  onCorrect?: (field: DocumentFieldView, value: string) => void;
  busyId?: string | null;
  readOnly?: boolean;
  threshold?: number;
}) {
  const needs = fields.filter((f) => f.needsConfirmation);
  const rest = fields.filter((f) => !f.needsConfirmation);
  const render = (f: DocumentFieldView) => (
    <FieldRow
      key={f.id}
      field={f}
      active={activeKey === f.key}
      onSelect={() => onSelect(f.key)}
      onConfirm={onConfirm ? () => onConfirm(f) : undefined}
      onCorrect={onCorrect ? (v) => onCorrect(f, v) : undefined}
      busy={busyId === f.id}
      readOnly={readOnly}
      threshold={threshold}
    />
  );
  return (
    <div className="space-y-4" data-testid="fields-panel">
      {needs.length > 0 ? (
        <section>
          <h3 className="mb-2 flex items-center justify-between text-[12px] font-medium uppercase tracking-[0.05em] text-warning">
            Needs confirmation <span className="tabular">{needs.length}</span>
          </h3>
          <div className="space-y-2">{needs.map(render)}</div>
        </section>
      ) : null}
      <section>
        <h3 className="mb-2 flex items-center justify-between text-[12px] font-medium uppercase tracking-[0.05em] text-muted">
          Extracted fields <span className="tabular">{rest.length}</span>
        </h3>
        <div className="space-y-2">{rest.length ? rest.map(render) : <p className="text-[13px] text-muted">No fields yet.</p>}</div>
      </section>
    </div>
  );
}
