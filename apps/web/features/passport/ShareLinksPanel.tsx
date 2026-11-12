'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PassportShareView } from '@vp/shared';
import { CalendarDays, Copy, Eye, Link2, Loader2, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { PanelCard, PanelHeader, brandButtonClass, secondaryButtonClass } from '@/components/ui/PanelCard';
import { SoftBadge } from '@/features/dashboard/SoftBadge';
import { keys, usePassport, useShares } from '@/hooks/queries';
import { errorMessage } from '@/services/http';
import { passportService } from '@/services/passport';
import { toast } from '@/store/ui';
import { cn } from '@/utils/cn';
import { formatDate, formatDateTime, formatRelative } from '@/utils/format';

/** Figma "Input / Field": py-2.5 px-3, rounded-lg, gray-200 border, gray-400 placeholder. */
const fieldClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-5 text-gray-800 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

function shareUrl(share: PassportShareView): string {
  if (share.url?.startsWith('http')) return share.url;
  const path = share.url ?? (share.token ? `/p/${share.token}` : '');
  return typeof window === 'undefined' ? path : `${window.location.origin}${path}`;
}

function ShareViews({ shareId }: { shareId: string }) {
  const { data, isLoading } = useQuery({ queryKey: keys.shareViews(shareId), queryFn: () => passportService.shareViews(shareId) });
  if (isLoading) return <p className="text-xs text-gray-500">Loading views…</p>;
  if (!data?.length) return <p className="text-xs text-gray-500">Not viewed yet.</p>;
  return (
    <ul className="space-y-1 text-[12px]">
      {data.map((v) => (
        <li key={v.id} className="flex justify-between gap-2">
          <span className="text-gray-700">{v.viewerName ?? 'Anonymous viewer'}{v.viewerOrganization ? ` · ${v.viewerOrganization}` : ''}</span>
          <span className="text-gray-500">{formatDateTime(v.viewedAt)}</span>
        </li>
      ))}
    </ul>
  );
}

export function ShareLinksPanel() {
  const qc = useQueryClient();
  const shares = useShares();
  const passport = usePassport();
  const isDraft = !!passport.data && passport.data.status !== 'VERIFIED';
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [created, setCreated] = useState<PassportShareView | null>(null);

  const create = useMutation({
    mutationFn: () => passportService.createShare({ label: label || undefined, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null }),
    onSuccess: (share) => {
      void qc.invalidateQueries({ queryKey: keys.shares });
      setCreated(share);
      setOpen(false);
      setLabel('');
      setExpiresAt('');
      void navigator.clipboard?.writeText(shareUrl(share)).catch(() => undefined);
      toast({ title: 'Share link created', description: 'Copied to your clipboard.', tone: 'success' });
    },
    onError: (e) => toast({ title: 'Could not create link', description: errorMessage(e), tone: 'danger' }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => passportService.revokeShare(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.shares });
      toast({ title: 'Link revoked', tone: 'neutral' });
    },
  });

  const copy = (s: PassportShareView) => {
    void navigator.clipboard?.writeText(shareUrl(s));
    toast({ title: 'Link copied', tone: 'success' });
  };

  const list = shares.data ?? [];
  return (
    <PanelCard data-testid="share-links">
      <PanelHeader icon={Link2} title="Share links" subtitle="Signed, revocable links. Buyers see the live passport, always current.">
        <button type="button" className={brandButtonClass} onClick={() => setOpen(true)} data-testid="create-share">
          <Plus className="size-4" aria-hidden /> New link
        </button>
      </PanelHeader>
      {created ? (
        /* Figma "New link": teal-50 band under the header, mono URL with Copy, draft note */
        <div className="flex flex-col gap-2 border-b border-teal-200 bg-teal-50 px-5 py-4" data-testid="created-share">
          <p className="text-sm font-medium leading-5 text-gray-800">Your new link is ready</p>
          <div className="flex items-center gap-2">
            <code
              className="min-w-0 flex-1 truncate rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-[13px] leading-[19px] text-gray-700"
              title={shareUrl(created)}
              data-testid="share-url"
            >
              {shareUrl(created)}
            </code>
            <button type="button" className={secondaryButtonClass} onClick={() => copy(created)}>
              <Copy className="size-4" aria-hidden /> Copy
            </button>
          </div>
          {isDraft ? (
            <p className="flex items-start gap-1.5 text-xs leading-4 text-amber-800">
              <TriangleAlert className="mt-px size-3.5 shrink-0 text-amber-600" aria-hidden />
              Buyers will see this passport as a draft until the missing documents are uploaded.
            </p>
          ) : null}
        </div>
      ) : null}
      {list.length === 0 ? (
        <div className="p-5">
          {/* Figma "Empty state": dashed gray-300 on gray-50, 44px icon circle */}
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-full border border-gray-200 bg-white">
              <Link2 className="size-5 text-gray-500" aria-hidden />
            </span>
            <p className="text-sm font-semibold leading-5 text-gray-800">No share links yet</p>
            <p className="text-sm leading-5 text-gray-500">Create a link and send it to any buyer. You’ll see who opened it and when.</p>
          </div>
        </div>
      ) : (
        <ul>
          {list.map((s) => {
            const revoked = !!s.revokedAt;
            const expired = !!s.expiresAt && new Date(s.expiresAt) < new Date();
            return (
              <li key={s.id} className="border-b border-gray-100 px-5 py-4 last:border-b-0" data-testid="share-row">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold leading-5 text-gray-800">{s.label ?? (s.buyerName ? `For ${s.buyerName}` : 'Share link')}</p>
                  {revoked ? <SoftBadge tone="red">Revoked</SoftBadge> : expired ? <SoftBadge tone="amber">Expired</SoftBadge> : <SoftBadge tone="teal">Active</SoftBadge>}
                </div>
                <p className="mt-1 text-xs leading-4 text-gray-500">
                  Created {formatDate(s.createdAt)}
                  {s.expiresAt ? ` · expires ${formatDate(s.expiresAt)}` : ' · no expiry'}
                  {' · '}
                  <span className="tabular">{s.viewCount}</span> view{s.viewCount === 1 ? '' : 's'}
                  {s.lastViewedAt ? ` · last ${formatRelative(s.lastViewedAt)}` : ''}
                </p>
                {/* Figma "Actions": secondary Copy, red ghost Revoke */}
                <div className="mt-1 flex flex-wrap items-center gap-2 pt-2">
                  {!revoked ? (
                    <>
                      <button type="button" className={secondaryButtonClass} onClick={() => copy(s)}>
                        <Copy className="size-4" aria-hidden /> Copy
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium leading-5 text-brand hover:bg-brand-tint disabled:opacity-50"
                        onClick={() => revoke.mutate(s.id)}
                        disabled={revoke.isPending && revoke.variables === s.id}
                        data-testid="revoke-share"
                      >
                        <Trash2 className="size-4" aria-hidden /> Revoke
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium leading-5 text-gray-600 hover:bg-gray-100"
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                    aria-expanded={expanded === s.id}
                  >
                    <Eye className="size-4" aria-hidden /> Viewers
                  </button>
                </div>
                {expanded === s.id ? (
                  <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
                    <ShareViews shareId={s.id} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        variant="preline"
        title="New share link"
        description="Anyone with the link can view the passport read-only."
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium leading-5 text-gray-800 shadow-[0_1px_0_rgba(0,0,0,0.05)] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-medium leading-5 text-white hover:bg-brand-hover disabled:opacity-60"
              data-testid="create-share-submit"
            >
              {create.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Create link
            </button>
          </>
        }
      >
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          {/* Figma illustration: kopi cup with a yellow smiley badge */}
          <div className="relative h-[86px] w-[93px] shrink-0" aria-hidden>
            <div className="absolute inset-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- static illustration from Figma */}
              <img src="/figma/share/kopi.png" alt="" className="absolute left-[-10.54%] top-[-51.73%] h-[160.23%] w-[118.63%] max-w-none" />
            </div>
            <span className="absolute left-[49px] top-[42px] flex size-11 items-center justify-center rounded-full bg-yellow-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/figma/share/smile.svg" alt="" width={22} height={22} className="size-[22px]" />
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="share-label" className="text-sm font-medium leading-5 text-gray-800">
              Label
            </label>
            <input
              id="share-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Northbridge tender 3B"
              autoFocus
              className={fieldClass}
            />
            <p className="text-xs leading-4 text-gray-500">Who is this for? e.g. Northbridge tender 3B</p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="share-expiry" className="text-sm font-medium leading-5 text-gray-800">
              Expires on
            </label>
            <div className="relative">
              <input
                id="share-expiry"
                type="date"
                value={expiresAt}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setExpiresAt(e.target.value)}
                onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
                className={cn(
                  fieldClass,
                  'pr-9 [&::-webkit-calendar-picker-indicator]:opacity-0',
                  expiresAt ? 'text-gray-800' : 'text-gray-400',
                )}
              />
              <CalendarDays className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" aria-hidden />
            </div>
            <p className="text-xs leading-4 text-gray-500">Leave empty for no expiry</p>
          </div>
          <button type="submit" hidden />
        </form>
      </Modal>
    </PanelCard>
  );
}
