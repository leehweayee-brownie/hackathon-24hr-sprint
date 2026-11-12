'use client';

import { FileText, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { PanelCard, PanelHeader } from '@/components/ui/PanelCard';
import { cn } from '@/utils/cn';

type Mode = 'paste' | 'upload' | 'fields';

export const EXAMPLE_BRIEF =
  'Building works for a 3-storey office block in Shah Alam, Selangor. Contract value RM7M, Feb 2027 to Jan 2028. Public liability cover of at least RM5M. ISO 9001 required, plus a bank reference letter.';

const fieldClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-5 text-gray-800 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

const MONTH = (v: string) => (v ? new Date(`${v}-01T00:00:00`).toLocaleDateString('en-MY', { month: 'short', year: 'numeric' }) : '');

/** Step 1: the brief in whatever form the buyer has it. */
export function BriefStep({ loading, onSubmit }: { loading: boolean; onSubmit: (input: { text?: string; file?: File | null }) => void }) {
  const [mode, setMode] = useState<Mode>('paste');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [quick, setQuick] = useState({ scope: '', value: '', location: '', start: '', end: '', musts: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  // The five quick fields become a short brief, read the same way as pasted text.
  const quickText = [
    quick.scope && `${quick.scope}.`,
    quick.value && `Contract value RM${quick.value.replace(/^RM\s?/i, '')}.`,
    quick.location && `Location: ${quick.location}.`,
    (quick.start || quick.end) && `${MONTH(quick.start)} to ${MONTH(quick.end)}.`,
    quick.musts && `Must-haves: ${quick.musts}.`,
  ]
    .filter(Boolean)
    .join(' ');

  const canSubmit = mode === 'paste' ? text.trim().length > 10 : mode === 'upload' ? !!file : quick.scope.trim().length > 2 && quick.value.trim().length > 0;
  const submit = () => onSubmit(mode === 'upload' ? { file } : { text: mode === 'paste' ? text : quickText });

  const tabs: Array<{ key: Mode; label: string }> = [
    { key: 'paste', label: 'Paste the brief' },
    { key: 'upload', label: 'Upload Document' },
    { key: 'fields', label: '5 quick fields' },
  ];

  return (
    <PanelCard>
      <PanelHeader title="Tender brief" subtitle="Give the brief in whatever form you have it. The AI turns it into requirements you confirm." />
      <div className="flex flex-col gap-4 p-5">
        <div className="inline-flex gap-1 self-start rounded-lg bg-gray-100 p-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={mode === t.key}
              onClick={() => setMode(t.key)}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-sm leading-5',
                mode === t.key ? 'bg-white font-medium text-gray-800 shadow-[0_1px_0_rgba(0,0,0,0.05)]' : 'text-gray-500 hover:text-gray-800',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mode === 'paste' ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Paste a paragraph from the brief: scope, value, location, dates, must-haves…"
              className={fieldClass}
              data-testid="brief-text"
            />
            <button type="button" onClick={() => setText(EXAMPLE_BRIEF)} className="self-start text-xs font-medium leading-4 text-brand hover:underline">
              Use the example brief
            </button>
          </div>
        ) : null}

        {mode === 'upload' ? (
          <div className="flex flex-col gap-2">
            <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
                <FileText className="size-4 shrink-0 text-gray-500" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-gray-800">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} aria-label="Remove file" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-6 py-8 text-center hover:border-gray-400"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-brand-tint">
                  <Upload className="size-5 text-brand" aria-hidden />
                </span>
                <span className="text-sm font-medium leading-5 text-gray-800">Choose the tender document</span>
                <span className="text-xs leading-4 text-gray-500">PDF, JPG or PNG. The AI reads it; nothing is stored.</span>
              </button>
            )}
          </div>
        ) : null}

        {mode === 'fields' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium leading-5 text-gray-800">Scope</span>
              <input value={quick.scope} onChange={(e) => setQuick({ ...quick, scope: e.target.value })} placeholder="Building works for a 3-storey office block" className={fieldClass} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium leading-5 text-gray-800">Contract value (RM)</span>
              <input value={quick.value} onChange={(e) => setQuick({ ...quick, value: e.target.value })} placeholder="7M or 7,000,000" className={fieldClass} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium leading-5 text-gray-800">Location</span>
              <input value={quick.location} onChange={(e) => setQuick({ ...quick, location: e.target.value })} placeholder="Shah Alam, Selangor" className={fieldClass} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium leading-5 text-gray-800">Start</span>
              <input type="month" value={quick.start} onChange={(e) => setQuick({ ...quick, start: e.target.value })} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium leading-5 text-gray-800">End</span>
              <input type="month" value={quick.end} onChange={(e) => setQuick({ ...quick, end: e.target.value })} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium leading-5 text-gray-800">Must-haves</span>
              <input value={quick.musts} onChange={(e) => setQuick({ ...quick, musts: e.target.value })} placeholder="Public liability ≥ RM5M, ISO 9001, bank reference letter" className={fieldClass} />
            </label>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium leading-5 text-white hover:bg-brand-hover disabled:opacity-50"
            data-testid="read-brief"
          >
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
            {loading ? 'Reading the brief…' : 'Read the brief'}
          </button>
        </div>
      </div>
    </PanelCard>
  );
}
