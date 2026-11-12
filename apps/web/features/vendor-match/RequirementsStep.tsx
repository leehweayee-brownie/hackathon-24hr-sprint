'use client';

import { DOC_TYPE_DEFINITIONS, DocType, type TenderRequirements } from '@vp/shared';
import { Check, Info, Loader2, Search, Sparkles } from 'lucide-react';
import { PanelCard, PanelHeader } from '@/components/ui/PanelCard';
import { cn } from '@/utils/cn';

const GRADES = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'];
const DOC_CHOICES = Object.values(DocType).filter((d) => d !== DocType.OTHER);

const fieldClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-5 text-gray-800 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export const shortMyr = (v: number | null) =>
  v === null ? '—' : v >= 1_000_000 ? `RM${Number((v / 1_000_000).toFixed(1))}M` : v >= 10_000 ? `RM${Math.round(v / 1_000)}k` : `RM${v.toLocaleString('en-MY')}`;
const monthYear = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-MY', { month: 'short', year: 'numeric' }) : null);

/** "Building works · RM7M → CIDB G6 or higher · public liability ≥ RM5M · ISO 9001 · Feb 2027–Jan 2028 · Selangor" */
export function requirementsLine(r: TenderRequirements): string {
  const head = [r.scope, r.contractValue ? shortMyr(r.contractValue) : null].filter(Boolean).join(' · ');
  // Documents beyond the standard set are must-haves worth showing (ISO, bank letter); notes add detail such as "ISO 9001".
  const extras = [
    r.requiredDocTypes.includes(DocType.ISO) && !r.notes.some((n) => /iso/i.test(n)) ? 'ISO certification' : null,
    r.requiredDocTypes.includes(DocType.BANK_REFERENCE) ? 'bank reference letter' : null,
  ];
  const needs = [
    r.minCidbGrade ? `CIDB ${r.minCidbGrade} or higher` : null,
    r.minLiabilityCoverage ? `public liability ≥ ${shortMyr(r.minLiabilityCoverage)}` : null,
    ...r.notes,
    ...extras,
    r.startDate || r.endDate ? [monthYear(r.startDate), monthYear(r.endDate)].filter(Boolean).join('–') : null,
    r.location,
  ].filter(Boolean);
  return needs.length ? `${head} → ${needs.join(' · ')}` : head;
}

/** Step 2: the drafted requirements, editable, confirmed before matching. */
export function RequirementsStep({
  value,
  source,
  assumptions,
  loading,
  onChange,
  onConfirm,
}: {
  value: TenderRequirements;
  source: 'ai' | 'parser';
  assumptions: string[];
  loading: boolean;
  onChange: (next: TenderRequirements) => void;
  onConfirm: () => void;
}) {
  const set = <K extends keyof TenderRequirements>(key: K, v: TenderRequirements[K]) => onChange({ ...value, [key]: v });
  const num = (s: string) => {
    const n = Number(s.replace(/[^\d.]/g, ''));
    return s.trim() === '' || !Number.isFinite(n) ? null : n;
  };
  const toggleDoc = (d: DocType) =>
    set('requiredDocTypes', value.requiredDocTypes.includes(d) ? value.requiredDocTypes.filter((x) => x !== d) : [...value.requiredDocTypes, d]);

  return (
    <PanelCard>
      <PanelHeader title="Requirements" subtitle="Check what was read from the brief. Edit anything, then find vendors.">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-900 px-2 py-0.5 text-xs font-semibold leading-4 text-white">
          <Sparkles className="size-3" aria-hidden /> {source === 'ai' ? 'Drafted by AI' : 'Drafted by the built-in reader'}
        </span>
      </PanelHeader>
      <div className="flex flex-col gap-5 p-5">
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium leading-5 text-gray-800" data-testid="requirements-line">
          {requirementsLine(value)}
        </p>
        {assumptions.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {assumptions.map((a) => (
              <li key={a} className="flex items-start gap-2 text-xs leading-4 text-amber-800">
                <Info className="mt-px size-3.5 shrink-0 text-amber-600" aria-hidden /> {a}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-sm font-medium leading-5 text-gray-800">Tender title</span>
            <input value={value.title} onChange={(e) => set('title', e.target.value)} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium leading-5 text-gray-800">Scope</span>
            <input value={value.scope} onChange={(e) => set('scope', e.target.value)} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium leading-5 text-gray-800">Contract value (RM)</span>
            <input inputMode="numeric" value={value.contractValue ?? ''} onChange={(e) => set('contractValue', num(e.target.value))} placeholder="7000000" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium leading-5 text-gray-800">Minimum CIDB grade</span>
            <select value={value.minCidbGrade ?? ''} onChange={(e) => set('minCidbGrade', e.target.value || null)} className={fieldClass}>
              <option value="">Any grade</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g} or higher
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium leading-5 text-gray-800">Minimum public liability (RM)</span>
            <input inputMode="numeric" value={value.minLiabilityCoverage ?? ''} onChange={(e) => set('minLiabilityCoverage', num(e.target.value))} placeholder="5000000" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium leading-5 text-gray-800">Contract start</span>
            <input type="date" value={value.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || null)} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium leading-5 text-gray-800">Contract end</span>
            <input type="date" value={value.endDate ?? ''} onChange={(e) => set('endDate', e.target.value || null)} className={fieldClass} />
            <span className="text-xs leading-4 text-gray-500">Documents must stay valid until this date.</span>
          </label>
          <label className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-sm font-medium leading-5 text-gray-800">Location</span>
            <input value={value.location ?? ''} onChange={(e) => set('location', e.target.value || null)} placeholder="Selangor" className={fieldClass} />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium leading-5 text-gray-800">Required documents</span>
          <div className="flex flex-wrap gap-2">
            {DOC_CHOICES.map((d) => {
              const on = value.requiredDocTypes.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDoc(d)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium leading-4',
                    on ? 'border-brand bg-brand-tint text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                  )}
                >
                  {on ? <Check className="size-3" aria-hidden /> : null} {DOC_TYPE_DEFINITIONS[d].shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || !value.title.trim() || !value.scope.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium leading-5 text-white hover:bg-brand-hover disabled:opacity-50"
            data-testid="find-vendors"
          >
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
            Confirm and find vendors
          </button>
        </div>
      </div>
    </PanelCard>
  );
}
