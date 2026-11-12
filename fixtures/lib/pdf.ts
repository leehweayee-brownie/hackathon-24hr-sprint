import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from 'pdf-lib';
import { promises as fs } from 'node:fs';
import type { BBox, DocType } from '@vp/shared';
import { FIXED_PDF_DATE, RecordingBuilder, type Value, printed } from './common';

export const A4 = { width: 595.28, height: 841.89 };

export type FontName = 'sans' | 'sansBold' | 'serif' | 'serifBold' | 'mono';

export interface TextOpts {
  size?: number;
  font?: FontName;
  color?: RGB;
  /** Right-align the text so it ends at x. */
  alignRight?: boolean;
  /** Draw faintly (simulates a weak stamp / poor print). */
  faint?: boolean;
}

export const INK = rgb(0.1, 0.1, 0.12);
export const GREY = rgb(0.45, 0.45, 0.48);
export const LIGHT = rgb(0.85, 0.85, 0.87);
export const NAVY = rgb(0.1, 0.2, 0.42);
export const MAROON = rgb(0.55, 0.12, 0.15);
export const GREEN = rgb(0.1, 0.42, 0.25);

/**
 * Small layout helper over pdf-lib. All coordinates are in points from the TOP-LEFT of an A4 page,
 * so the recorded bounding boxes (page fractions, top-left origin) come straight from the layout.
 */
export class PdfBuilder {
  readonly rec: RecordingBuilder;
  private doc!: PDFDocument;
  private fonts!: Record<FontName, PDFFont>;
  private pages: PDFPage[] = [];
  private pageIndex = 0;

  constructor(fileName: string, docType: DocType, classificationConfidence: number, reason: string) {
    this.rec = new RecordingBuilder(fileName, docType, classificationConfidence, reason);
  }

  async init(): Promise<this> {
    this.doc = await PDFDocument.create();
    this.doc.setCreationDate(FIXED_PDF_DATE);
    this.doc.setModificationDate(FIXED_PDF_DATE);
    this.doc.setProducer('Vendor Passport fixtures (fictional)');
    this.doc.setTitle(this.rec.fileName);
    this.fonts = {
      sans: await this.doc.embedFont(StandardFonts.Helvetica),
      sansBold: await this.doc.embedFont(StandardFonts.HelveticaBold),
      serif: await this.doc.embedFont(StandardFonts.TimesRoman),
      serifBold: await this.doc.embedFont(StandardFonts.TimesRomanBold),
      mono: await this.doc.embedFont(StandardFonts.Courier),
    };
    this.addPage();
    return this;
  }

  addPage(): number {
    const page = this.doc.addPage([A4.width, A4.height]);
    this.pages.push(page);
    this.pageIndex = this.pages.length - 1;
    return this.pages.length;
  }

  get page(): number {
    return this.pageIndex + 1;
  }

  private get current(): PDFPage {
    return this.pages[this.pageIndex];
  }

  textWidth(text: string, size: number, font: FontName = 'sans'): number {
    return this.fonts[font].widthOfTextAtSize(text, size);
  }

  /** Draws text with its top-left at (x, yTop). Returns the bbox as page fractions. */
  text(value: Value, x: number, yTop: number, opts: TextOpts = {}): BBox {
    const str = printed(value);
    const size = opts.size ?? 10;
    const font = this.fonts[opts.font ?? 'sans'];
    const width = font.widthOfTextAtSize(str, size);
    const height = size * 1.15;
    const drawX = opts.alignRight ? x - width : x;
    const baseline = A4.height - yTop - size * 0.85;
    this.current.drawText(str, {
      x: drawX,
      y: baseline,
      size,
      font,
      color: opts.faint ? rgb(0.62, 0.62, 0.64) : (opts.color ?? INK),
      opacity: opts.faint ? 0.75 : 1,
    });
    return { x: drawX / A4.width, y: yTop / A4.height, width: width / A4.width, height: height / A4.height };
  }

  /** Draws wrapped paragraph text; returns the yTop after the paragraph. */
  paragraph(text: string, x: number, yTop: number, maxWidth: number, opts: TextOpts = {}): number {
    const size = opts.size ?? 10;
    const font = this.fonts[opts.font ?? 'sans'];
    const words = text.split(/\s+/);
    let line = '';
    let y = yTop;
    const lineHeight = size * 1.45;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        this.text(line, x, y, opts);
        y += lineHeight;
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) {
      this.text(line, x, y, opts);
      y += lineHeight;
    }
    return y;
  }

  /** "Label ....... value" row. Returns the value bbox. */
  labelValue(label: string, value: Value, x: number, yTop: number, valueX: number, opts: TextOpts = {}, labelOpts: TextOpts = {}): BBox {
    this.text(label, x, yTop, { size: opts.size ?? 10, font: 'sans', color: GREY, ...labelOpts });
    return this.text(value, valueX, yTop, { size: opts.size ?? 10, ...opts });
  }

  rect(x: number, yTop: number, width: number, height: number, opts: { fill?: RGB; stroke?: RGB; lineWidth?: number; opacity?: number } = {}): void {
    this.current.drawRectangle({
      x,
      y: A4.height - yTop - height,
      width,
      height,
      color: opts.fill,
      borderColor: opts.stroke,
      borderWidth: opts.stroke ? (opts.lineWidth ?? 0.8) : 0,
      opacity: opts.opacity ?? 1,
      borderOpacity: opts.opacity ?? 1,
    });
  }

  line(x1: number, y1: number, x2: number, y2: number, opts: { color?: RGB; width?: number } = {}): void {
    this.current.drawLine({
      start: { x: x1, y: A4.height - y1 },
      end: { x: x2, y: A4.height - y2 },
      thickness: opts.width ?? 0.8,
      color: opts.color ?? INK,
    });
  }

  /** A simple round-ish "rubber stamp" drawn with an ellipse and text. */
  stamp(cx: number, cy: number, lines: string[], color: RGB = MAROON, rotateDeg = -8): void {
    const page = this.current;
    const y = A4.height - cy;
    page.drawEllipse({ x: cx, y, xScale: 62, yScale: 34, borderColor: color, borderWidth: 1.6, opacity: 0, borderOpacity: 0.7 });
    page.drawEllipse({ x: cx, y, xScale: 56, yScale: 29, borderColor: color, borderWidth: 0.8, opacity: 0, borderOpacity: 0.7 });
    const font = this.fonts.sansBold;
    lines.forEach((l, i) => {
      const size = i === 0 ? 8 : 6.5;
      const w = font.widthOfTextAtSize(l, size);
      page.drawText(l, {
        x: cx - w / 2,
        y: y + 8 - i * 10,
        size,
        font,
        color,
        opacity: 0.7,
        rotate: { type: 'degrees', angle: rotateDeg } as never,
      });
    });
  }

  /** Letterhead block with an emblem square. Returns yTop below the letterhead. */
  letterhead(org: string, lines: string[], color: RGB = NAVY): number {
    this.rect(40, 36, 30, 30, { fill: color });
    this.rect(46, 42, 18, 18, { fill: rgb(1, 1, 1) });
    this.rect(50, 46, 10, 10, { fill: color });
    this.text(org, 80, 36, { size: 15, font: 'sansBold', color });
    lines.forEach((l, i) => this.text(l, 80, 56 + i * 11, { size: 8, color: GREY }));
    const y = 56 + lines.length * 11 + 8;
    this.line(40, y, A4.width - 40, y, { color, width: 1.4 });
    return y + 18;
  }

  footer(text: string): void {
    this.line(40, A4.height - 50, A4.width - 40, A4.height - 50, { color: LIGHT, width: 0.6 });
    this.text(text, 40, A4.height - 44, { size: 7, color: GREY });
    this.text(`Page ${this.page}`, A4.width - 40, A4.height - 44, { size: 7, color: GREY, alignRight: true });
  }

  /** A bordered table with a header row. Returns yTop below the table. */
  table(x: number, yTop: number, colWidths: number[], rows: string[][], opts: { header?: boolean; size?: number; rowHeight?: number } = {}): { bottom: number; cell: (r: number, c: number) => BBox } {
    const size = opts.size ?? 9;
    const rowHeight = opts.rowHeight ?? 18;
    const width = colWidths.reduce((a, b) => a + b, 0);
    const cells: BBox[][] = [];
    rows.forEach((row, r) => {
      const y = yTop + r * rowHeight;
      if (opts.header !== false && r === 0) this.rect(x, y, width, rowHeight, { fill: rgb(0.93, 0.94, 0.96) });
      let cx = x;
      const rowCells: BBox[] = [];
      row.forEach((cell, c) => {
        rowCells.push(
          this.text(cell, cx + 5, y + (rowHeight - size * 1.15) / 2, { size, font: opts.header !== false && r === 0 ? 'sansBold' : 'sans' }),
        );
        cx += colWidths[c];
      });
      cells.push(rowCells);
      this.line(x, y, x + width, y, { color: LIGHT, width: 0.5 });
    });
    const bottom = yTop + rows.length * rowHeight;
    this.line(x, bottom, x + width, bottom, { color: LIGHT, width: 0.5 });
    let cx = x;
    for (const w of [...colWidths, 0]) {
      this.line(cx, yTop, cx, bottom, { color: LIGHT, width: 0.5 });
      cx += w;
    }
    return { bottom, cell: (r, c) => cells[r][c] };
  }

  async save(outPath: string): Promise<{ bytes: Uint8Array; pageCount: number }> {
    const bytes = await this.doc.save({ useObjectStreams: false });
    await fs.writeFile(outPath, bytes);
    return { bytes, pageCount: this.pages.length };
  }
}
