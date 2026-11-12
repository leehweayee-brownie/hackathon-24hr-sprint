'use client';

import type { DocumentFieldView } from '@vp/shared';
import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Skeleton } from '@/components/ui/Skeleton';
import { BBoxOverlay } from './BBoxOverlay';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export default function PdfPages({
  url,
  fields,
  activeKey,
  onSelect,
  width,
}: {
  url: string;
  fields: DocumentFieldView[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  width: number;
}) {
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  return (
    <Document
      file={url}
      onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
      onLoadError={(e) => setError(e.message)}
      loading={<Skeleton className="aspect-[1/1.414] w-full" />}
      error={<p className="p-6 text-center text-[13px] text-danger">{error ?? 'Could not load the PDF.'}</p>}
    >
      {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
        <div key={n} id={`page-${n}`} className="relative mb-4 overflow-hidden rounded-card border border-line bg-white shadow-card" data-testid={`page-${n}`}>
          <Page pageNumber={n} width={width} renderTextLayer={false} renderAnnotationLayer={false} loading={<Skeleton className="aspect-[1/1.414] w-full" />} />
          <BBoxOverlay fields={fields} page={n} activeKey={activeKey} onSelect={onSelect} />
          <span className="absolute bottom-2 right-2 rounded bg-ink/70 px-1.5 py-0.5 text-[11px] text-white">Page {n}</span>
        </div>
      ))}
    </Document>
  );
}
