'use client';

import { useQuery } from '@tanstack/react-query';
import { ErrorCode, type DocumentView } from '@vp/shared';
import { Link2Off, Lock } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/layout/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { DocumentViewer } from '@/features/document-viewer/DocumentViewer';
import { PassportPreview } from '@/features/passport/PassportPreview';
import { HttpError, errorMessage } from '@/services/http';
import { passportService } from '@/services/passport';

function PublicDocument({ token, doc, onBack }: { token: string; doc: DocumentView; onBack: () => void }) {
  const file = useQuery({ queryKey: ['public-file', token, doc.id], queryFn: () => passportService.publicFileUrl(token, doc.id) });
  return (
    <div>
      <button onClick={onBack} className="mb-3 text-[13px] text-primary hover:underline">← Back to passport</button>
      <DocumentViewer doc={doc} backHref="#" backLabel="" readOnly fileUrlOverride={file.data ?? null} />
    </div>
  );
}

export default function PublicPassportPage() {
  const { token } = useParams<{ token: string }>();
  const [viewing, setViewing] = useState<DocumentView | null>(null);
  const passport = useQuery({ queryKey: ['public-passport', token], queryFn: () => passportService.public(token), retry: false });

  let body: React.ReactNode;
  if (passport.isLoading) body = <PageSkeleton />;
  else if (passport.isError) {
    const err = passport.error;
    const code = err instanceof HttpError ? err.code : undefined;
    const title = code === ErrorCode.SHARE_LINK_EXPIRED ? 'This link has expired' : code === ErrorCode.SHARE_LINK_REVOKED ? 'This link was revoked' : 'This passport is not available';
    body = (
      <div className="mx-auto max-w-md rounded-card border border-line bg-panel px-6 py-10 text-center shadow-card" data-testid="share-error">
        <Link2Off className="mx-auto size-6 text-muted" />
        <h1 className="mt-3 text-[18px] font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-[13px] text-muted">{errorMessage(err)}</p>
        <p className="mt-4 text-[13px] text-muted">Ask the supplier for a new link, or request access from inside Vendor Passport.</p>
        <Link href="/login" className="mt-5 inline-block"><Button variant="secondary"><Lock className="size-4" /> Sign in to request access</Button></Link>
      </div>
    );
  } else if (viewing) body = <PublicDocument token={token} doc={viewing} onBack={() => setViewing(null)} />;
  else if (passport.data) {
    body = (
      <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted">
            Shared passport{passport.data.share?.label ? ` · ${passport.data.share.label}` : ''}. Read-only, always current.
          </p>
          <Link href="/login"><Button variant="secondary" size="sm"><Lock className="size-3.5" /> Request full access</Button></Link>
        </div>
        <PassportPreview passport={passport.data} onViewDocument={(id) => { const d = passport.data!.documents.find((x) => x.id === id); if (d) setViewing(d); }} />
      </>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center justify-between border-b border-line bg-panel px-4 lg:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="text-[13px] font-medium text-primary hover:underline">Sign in</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8">{body}</main>
      <footer className="px-4 py-6 text-center text-[12px] text-muted">Vendor Passport · all demo data is fictional</footer>
    </div>
  );
}
