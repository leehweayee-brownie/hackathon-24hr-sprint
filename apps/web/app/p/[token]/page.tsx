'use client';

import { useQuery } from '@tanstack/react-query';
import { ErrorCode, RuleCode, type DocumentView } from '@vp/shared';
import { ArrowLeft, Info, Link2, Link2Off, Lock } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { brandButtonClass, secondaryButtonClass } from '@/components/ui/PanelCard';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { DocumentViewer } from '@/features/document-viewer/DocumentViewer';
import { CompanyPassportCard } from '@/features/passport/supplier/CompanyPassportCard';
import { DocumentsCard } from '@/features/passport/supplier/DocumentsCard';
import { ExpiryTimelineCard } from '@/features/passport/supplier/ExpiryTimelineCard';
import { TrustScoreCard } from '@/features/passport/supplier/TrustScoreCard';
import { HttpError, errorMessage } from '@/services/http';
import { passportService } from '@/services/passport';
import { formatDate } from '@/utils/format';

function PublicDocument({ token, doc, onBack }: { token: string; doc: DocumentView; onBack: () => void }) {
  const file = useQuery({ queryKey: ['public-file', token, doc.id], queryFn: () => passportService.publicFileUrl(token, doc.id) });
  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 self-start text-sm font-medium leading-5 text-brand hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Back to passport
      </button>
      <DocumentViewer doc={doc} backHref="#" backLabel="" readOnly fileUrlOverride={file.data ?? null} />
    </div>
  );
}

/** Figma "Public header": logo with "Vendor assessment" tagline, theme button, brand Sign in. */
function PublicHeader() {
  return (
    <header className="flex h-[65px] shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 sm:px-10">
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
      <img src="/figma/dashboard/logo.svg" alt="" width={32} height={32} className="size-8 shrink-0" />
      <div className="-ml-1.5 flex flex-col">
        <span className="text-lg font-semibold leading-7 text-gray-900">VendVet</span>
        <span className="text-xs leading-4 text-gray-500">Vendor assessment</span>
      </div>
      <div className="flex-1" />
      <div className="flex size-[38px] items-center justify-center rounded-full border border-gray-200 [&_button]:px-0">
        <ThemeToggle />
      </div>
      <Link href="/login" className={brandButtonClass}>
        Sign in
      </Link>
    </header>
  );
}

export default function PublicPassportPage() {
  const { token } = useParams<{ token: string }>();
  const [viewing, setViewing] = useState<DocumentView | null>(null);
  const passport = useQuery({ queryKey: ['public-passport', token], queryFn: () => passportService.public(token), retry: false });
  const view = (id: string) => {
    const doc = passport.data?.documents.find((d) => d.id === id);
    if (doc) setViewing(doc);
  };

  let body: ReactNode;
  if (passport.isLoading) body = <PageSkeleton />;
  else if (passport.isError) {
    const err = passport.error;
    const code = err instanceof HttpError ? err.code : undefined;
    const title =
      code === ErrorCode.SHARE_LINK_EXPIRED ? 'This link has expired' : code === ErrorCode.SHARE_LINK_REVOKED ? 'This link was revoked' : 'This passport is not available';
    body = (
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-10 text-center shadow-[0_1px_0_rgba(0,0,0,0.05)]" data-testid="share-error">
        <span className="flex size-11 items-center justify-center rounded-full border border-gray-200 bg-gray-50">
          <Link2Off className="size-5 text-gray-500" aria-hidden />
        </span>
        <h1 className="mt-1 text-lg font-semibold leading-7 text-gray-900">{title}</h1>
        <p className="text-sm leading-5 text-gray-500">{errorMessage(err)}</p>
        <p className="text-sm leading-5 text-gray-500">Ask the vendor for a new link, or request access from inside VendVet.</p>
        <Link href="/login" className={`${secondaryButtonClass} mt-3`}>
          <Lock className="size-4" aria-hidden /> Sign in to request access
        </Link>
      </div>
    );
  } else if (viewing) body = <PublicDocument token={token} doc={viewing} onBack={() => setViewing(null)} />;
  else if (passport.data) {
    const p = passport.data;
    const missing = p.findings.filter((f) => f.rule === RuleCode.REQUIRED_DOCUMENT_MISSING).length;
    const linkMeta = ['Read-only, always current', p.share?.expiresAt ? `link expires ${formatDate(p.share.expiresAt)}` : null].filter(Boolean).join(' · ');
    body = (
      <div className="flex flex-col gap-6" data-testid="passport-preview">
        {/* Figma "Shared link meta" */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link2 className="size-4 shrink-0 text-gray-500" aria-hidden />
            <p className="text-sm font-medium leading-5 text-gray-700">Shared passport{p.share?.label ? ` · ${p.share.label}` : ''}</p>
            <p className="text-sm leading-5 text-gray-500">{linkMeta}</p>
          </div>
          <Link href="/login" className={brandButtonClass}>
            <Lock className="size-4" aria-hidden /> Request full access
          </Link>
        </div>

        {p.status !== 'VERIFIED' ? (
          /* Figma "Notice / Draft" */
          <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <Info className="size-4 shrink-0 text-amber-600" aria-hidden />
            <p className="text-sm leading-5 text-amber-800">
              {missing > 0
                ? `This passport is a draft — the vendor hasn’t uploaded ${missing} required ${missing === 1 ? 'document' : 'documents'} yet, so the trust score may change.`
                : 'This passport is a draft — some documents are still being reviewed, so the trust score may change.'}
            </p>
          </div>
        ) : null}

        <CompanyPassportCard passport={p} variant="public" />
        <TrustScoreCard passport={p} variant="public" onViewDocument={view} />
        <ExpiryTimelineCard timeline={p.timeline} variant="public" />
        <DocumentsCard documents={p.documents} variant="public" onViewDocument={view} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <PublicHeader />
      <main className="mx-auto w-full max-w-[1024px] flex-1 px-4 py-10 sm:px-6 lg:px-0">{body}</main>
      <footer className="px-4 pb-10 pt-6 text-center text-xs leading-4 text-gray-400">Vendor Passport · all demo data is fictional</footer>
    </div>
  );
}
