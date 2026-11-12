'use client';

import type { DocumentFieldView } from '@vp/shared';
import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { BBoxOverlay } from './BBoxOverlay';
import { loadPdfJs, type PdfDocumentProxy } from './pdfjs';

function PdfPageCanvas({ pdf, pageNumber, width }: { pdf: PdfDocumentProxy; pageNumber: number; width: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(pageNumber === 1);
  const [ready, setReady] = useState(false);

  // Lazy-load: render a page only once it scrolls near the viewport.
  useEffect(() => {
    if (visible || !holderRef.current) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '400px' });
    io.observe(holderRef.current);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || width <= 0) return;
    let cancelled = false;
    let task: { promise: Promise<void>; cancel(): void } | null = null;
    void (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;
      const base = page.getViewport({ scale: 1 });
      const ratio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      const viewport = page.getViewport({ scale: (width / base.width) * ratio });
      const canvas = canvasRef.current;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${Math.floor((viewport.height / ratio))}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      task = page.render({ canvasContext: ctx, viewport, canvas });
      try {
        await task.promise;
        if (!cancelled) setReady(true);
      } catch {
        /* render cancelled */
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, width, visible]);

  return (
    <div ref={holderRef} className="relative" style={{ minHeight: ready ? undefined : width * 1.414 }}>
      {!ready ? <Skeleton className="absolute inset-0" /> : null}
      <canvas ref={canvasRef} className="block" data-testid={`pdf-canvas-${pageNumber}`} />
    </div>
  );
}

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
  const [pdf, setPdf] = useState<PdfDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let doc: PdfDocumentProxy | null = null;
    setPdf(null);
    setError(null);
    loadPdfJs()
      .then((pdfjs) => pdfjs.getDocument({ url }).promise)
      .then((d) => {
        doc = d;
        if (cancelled) void d.destroy();
        else setPdf(d);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load the PDF.'));
    return () => {
      cancelled = true;
      void doc?.destroy();
    };
  }, [url]);

  if (error) return <p className="p-6 text-center text-[13px] text-danger">{error}</p>;
  if (!pdf) return <Skeleton className="aspect-[1/1.414] w-full" />;

  return (
    <div>
      {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((n) => (
        <div key={n} id={`page-${n}`} className="relative mb-4 overflow-hidden rounded-card border border-line bg-white shadow-card" data-testid={`page-${n}`}>
          <PdfPageCanvas pdf={pdf} pageNumber={n} width={width} />
          <BBoxOverlay fields={fields} page={n} activeKey={activeKey} onSelect={onSelect} />
          <span className="absolute bottom-2 right-2 rounded bg-ink/70 px-1.5 py-0.5 text-[11px] text-white">Page {n}</span>
        </div>
      ))}
    </div>
  );
}
