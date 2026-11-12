'use client';

import type { DocumentFieldView, DocumentView } from '@vp/shared';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDocumentFile } from '@/hooks/queries';
import { errorMessage } from '@/services/http';
import { BBoxOverlay } from './BBoxOverlay';

const PdfPages = dynamic(() => import('./PdfPages'), { ssr: false, loading: () => <Skeleton className="aspect-[1/1.414] w-full" /> });

export function PageCanvas({
  doc,
  fields,
  activeKey,
  onSelect,
  fileUrlOverride,
}: {
  doc: DocumentView;
  fields: DocumentFieldView[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  /** Public passport pages fetch the file URL differently. */
  fileUrlOverride?: { url: string } | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const file = useDocumentFile(doc.id, !fileUrlOverride);
  const url = fileUrlOverride?.url ?? file.data?.url;

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    setWidth(Math.floor(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!activeKey) return;
    const f = fields.find((x) => x.key === activeKey);
    if (!f) return;
    document.querySelector<HTMLElement>(`[data-field-anchor="${activeKey}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeKey, fields]);

  return (
    <div ref={container} className="w-full" data-testid="page-canvas">
      {file.isError && !fileUrlOverride ? <EmptyState title="Could not load the file" description={errorMessage(file.error)} /> : null}
      {!url ? <Skeleton className="aspect-[1/1.414] w-full" /> : doc.mimeType === 'application/pdf' ? (
        <PdfPages url={url} fields={fields} activeKey={activeKey} onSelect={onSelect} width={width} />
      ) : (
        <div className="relative overflow-hidden rounded-card border border-line bg-white shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={doc.fileName} className="block w-full" />
          <BBoxOverlay fields={fields} page={1} activeKey={activeKey} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}
