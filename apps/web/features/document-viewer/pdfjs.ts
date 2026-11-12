'use client';

/** The subset of the pdf.js API the viewer uses. */
export interface PdfViewport {
  width: number;
  height: number;
}
export interface PdfPageProxy {
  getViewport(opts: { scale: number }): PdfViewport;
  render(opts: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport; canvas?: HTMLCanvasElement }): { promise: Promise<void>; cancel(): void };
  cleanup(): void;
}
export interface PdfDocumentProxy {
  numPages: number;
  getPage(n: number): Promise<PdfPageProxy>;
  destroy(): Promise<void>;
}
interface PdfJsModule {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { url: string }): { promise: Promise<PdfDocumentProxy>; destroy(): Promise<void> };
}

let loader: Promise<PdfJsModule> | null = null;

/**
 * Loads pdf.js from /public/pdfjs at runtime (copied there by scripts/copy-pdfjs.mjs).
 * Bypassing the bundler avoids pdf.js 5 breaking under Next's webpack.
 */
export function loadPdfJs(): Promise<PdfJsModule> {
  if (!loader) {
    const src = '/pdfjs/pdf.min.mjs';
    loader = (import(/* webpackIgnore: true */ src) as Promise<PdfJsModule>).then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      return mod;
    });
    loader.catch(() => {
      loader = null;
    });
  }
  return loader;
}
