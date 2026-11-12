'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PassportShareView } from '@vp/shared';
import { Copy, Eye, Link2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { keys, useShares } from '@/hooks/queries';
import { errorMessage } from '@/services/http';
import { passportService } from '@/services/passport';
import { toast } from '@/store/ui';
import { formatDate, formatDateTime, formatRelative } from '@/utils/format';

function shareUrl(share: PassportShareView): string {
  if (share.url?.startsWith('http')) return share.url;
  const path = share.url ?? (share.token ? `/p/${share.token}` : '');
  return typeof window === 'undefined' ? path : `${window.location.origin}${path}`;
}

function ShareViews({ shareId }: { shareId: string }) {
  const { data, isLoading } = useQuery({ queryKey: keys.shareViews(shareId), queryFn: () => passportService.shareViews(shareId) });
  if (isLoading) return <p className="text-[12px] text-muted">Loading views…</p>;
  if (!data?.length) return <p className="text-[12px] text-muted">Not viewed yet.</p>;
  return (
    <ul className="space-y-1 text-[12px]">
      {data.map((v) => (
        <li key={v.id} className="flex justify-between gap-2">
          <span className="text-ink-2">{v.viewerName ?? 'Anonymous viewer'}{v.viewerOrganization ? ` · ${v.viewerOrganization}` : ''}</span>
          <span className="text-muted">{formatDateTime(v.viewedAt)}</span>
        </li>
      ))}
    </ul>
  );
}

export function ShareLinksPanel() {
  const qc = useQueryClient();
  const shares = useShares();
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
    <Card data-testid="share-links">
      <CardHeader
        title="Share links"
        description="Signed, revocable links. Buyers see the live passport, always current."
        action={
          <Button onClick={() => setOpen(true)} data-testid="create-share">
            <Plus className="size-4" /> New link
          </Button>
        }
      />
      {created ? (
        <div className="border-b border-line-soft bg-primary-soft/60 px-5 py-3 text-[13px]" data-testid="created-share">
          <p className="font-medium text-ink">Your new link</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-panel px-2 py-1 font-mono text-[12px] text-ink" data-testid="share-url">{shareUrl(created)}</code>
            <Button size="sm" variant="secondary" onClick={() => copy(created)}>
              <Copy className="size-3.5" /> Copy
            </Button>
          </div>
        </div>
      ) : null}
      <CardBody className="p-0">
        {list.length === 0 ? (
          <EmptyState icon={Link2} title="No share links yet" description="Create a link and send it to any buyer. You will see who opened it and when." className="m-5" />
        ) : (
          <ul className="divide-y divide-line-soft">
            {list.map((s) => {
              const revoked = !!s.revokedAt;
              const expired = !!s.expiresAt && new Date(s.expiresAt) < new Date();
              return (
                <li key={s.id} className="px-5 py-3" data-testid="share-row">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-medium text-ink">{s.label ?? (s.buyerName ? `For ${s.buyerName}` : 'Share link')}</p>
                        {revoked ? <Badge tone="danger">Revoked</Badge> : expired ? <Badge tone="warning">Expired</Badge> : <Badge tone="success">Active</Badge>}
                      </div>
                      <p className="mt-0.5 text-[12px] text-muted">
                        Created {formatDate(s.createdAt)}
                        {s.expiresAt ? ` · expires ${formatDate(s.expiresAt)}` : ' · no expiry'}
                        {' · '}
                        <span className="tabular">{s.viewCount}</span> view{s.viewCount === 1 ? '' : 's'}
                        {s.lastViewedAt ? ` · last ${formatRelative(s.lastViewedAt)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                        <Eye className="size-3.5" /> Viewers
                      </Button>
                      {!revoked ? (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => copy(s)}>
                            <Copy className="size-3.5" /> Copy
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => revoke.mutate(s.id)} className="text-danger hover:bg-danger-soft" data-testid="revoke-share">
                            <Trash2 className="size-3.5" /> Revoke
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {expanded === s.id ? (
                    <div className="mt-2 rounded-card bg-surface px-3 py-2">
                      <ShareViews shareId={s.id} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New share link"
        description="Anyone with the link can view the passport read-only."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} data-testid="create-share-submit">
              Create link
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Label" hint="Who is this for? e.g. Northbridge tender 3B" htmlFor="share-label">
            <Input id="share-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Northbridge tender 3B" />
          </Field>
          <Field label="Expires on" hint="Leave empty for no expiry" htmlFor="share-expiry">
            <Input id="share-expiry" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}
