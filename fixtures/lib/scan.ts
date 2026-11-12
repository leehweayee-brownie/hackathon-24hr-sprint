import sharp from 'sharp';
import type { BBox, DocType } from '@vp/shared';
import { RecordingBuilder, type Value, printed, prng } from './common';

/** A4 at 150 dpi. */
export const SCAN = { width: 1240, height: 1754 };

export interface ScanTextOpts {
  size?: number;
  weight?: 'normal' | 'bold';
  family?: 'sans' | 'serif' | 'mono';
  color?: string;
  faint?: boolean;
  alignRight?: boolean;
}

const CHAR_WIDTH: Record<string, number> = { sans: 0.52, serif: 0.47, mono: 0.6 };
const FAMILY: Record<string, string> = {
  sans: 'Helvetica, Arial, sans-serif',
  serif: "'Times New Roman', Times, serif",
  mono: "'Courier New', Courier, monospace",
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Builds a one-page "scanned" document as SVG, rendered with sharp to JPEG or PNG with a
 * paper tint, slight rotation and film grain. Coordinates in pixels from the top-left.
 */
export class ScanBuilder {
  readonly rec: RecordingBuilder;
  private els: string[] = [];
  private seed: number;

  constructor(fileName: string, docType: DocType, classificationConfidence: number, reason: string, seed = 7) {
    this.rec = new RecordingBuilder(fileName, docType, classificationConfidence, reason);
    this.seed = seed;
  }

  textWidth(text: string, size: number, family: ScanTextOpts['family'] = 'sans', weight: ScanTextOpts['weight'] = 'normal'): number {
    return text.length * size * CHAR_WIDTH[family ?? 'sans'] * (weight === 'bold' ? 1.07 : 1);
  }

  text(value: Value, x: number, yTop: number, opts: ScanTextOpts = {}): BBox {
    const str = printed(value);
    const size = opts.size ?? 26;
    const family = opts.family ?? 'sans';
    const weight = opts.weight ?? 'normal';
    const width = this.textWidth(str, size, family, weight);
    const drawX = opts.alignRight ? x - width : x;
    const color = opts.faint ? '#8a8a8e' : (opts.color ?? '#1b1b1f');
    this.els.push(
      `<text x="${drawX.toFixed(1)}" y="${(yTop + size * 0.82).toFixed(1)}" font-family="${FAMILY[family]}" font-size="${size}" font-weight="${weight}" fill="${color}"${opts.faint ? ' opacity="0.7"' : ''}>${esc(str)}</text>`,
    );
    return { x: drawX / SCAN.width, y: yTop / SCAN.height, width: (width * 1.05) / SCAN.width, height: (size * 1.2) / SCAN.height };
  }

  labelValue(label: string, value: Value, x: number, yTop: number, valueX: number, opts: ScanTextOpts = {}): BBox {
    this.text(label, x, yTop, { size: opts.size ?? 26, color: '#55555a' });
    return this.text(value, valueX, yTop, opts);
  }

  rect(x: number, y: number, w: number, h: number, opts: { fill?: string; stroke?: string; strokeWidth?: number; opacity?: number } = {}): void {
    this.els.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${opts.fill ?? 'none'}" stroke="${opts.stroke ?? 'none'}" stroke-width="${opts.strokeWidth ?? 2}" opacity="${opts.opacity ?? 1}"/>`,
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, opts: { color?: string; width?: number } = {}): void {
    this.els.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${opts.color ?? '#1b1b1f'}" stroke-width="${opts.width ?? 2}"/>`);
  }

  stamp(cx: number, cy: number, lines: string[], color = '#8b1e26', rotate = -7): void {
    const g: string[] = [];
    g.push(`<ellipse cx="${cx}" cy="${cy}" rx="150" ry="82" fill="none" stroke="${color}" stroke-width="4"/>`);
    g.push(`<ellipse cx="${cx}" cy="${cy}" rx="136" ry="70" fill="none" stroke="${color}" stroke-width="2"/>`);
    lines.forEach((l, i) => {
      const size = i === 0 ? 22 : 17;
      g.push(
        `<text x="${cx}" y="${cy - 10 + i * 26}" text-anchor="middle" font-family="${FAMILY.sans}" font-weight="bold" font-size="${size}" fill="${color}">${esc(l)}</text>`,
      );
    });
    this.els.push(`<g opacity="0.72" transform="rotate(${rotate} ${cx} ${cy})">${g.join('')}</g>`);
  }

  signature(x: number, y: number, color = '#1f2a6b'): void {
    const r = prng(this.seed + 11);
    let d = `M ${x} ${y}`;
    for (let i = 1; i <= 8; i += 1) {
      d += ` q ${20 + r() * 30} ${-40 - r() * 40} ${45 + r() * 15} ${r() * 20 - 5}`;
    }
    this.els.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" opacity="0.85"/>`);
  }

  private svg(): string {
    const w = SCAN.width;
    const h = SCAN.height;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="#f4f1ea"/>
<rect x="18" y="14" width="${w - 36}" height="${h - 28}" fill="#faf8f3"/>
<g transform="rotate(0.35 ${w / 2} ${h / 2})">${this.els.join('\n')}</g>
</svg>`;
  }

  async save(outPath: string, format: 'jpeg' | 'png'): Promise<Uint8Array> {
    const base = sharp(Buffer.from(this.svg()), { density: 96 }).resize(SCAN.width, SCAN.height);
    const grain = Buffer.alloc(SCAN.width * SCAN.height);
    const r = prng(this.seed);
    for (let i = 0; i < grain.length; i += 1) grain[i] = 228 + Math.floor(r() * 27);
    const noise = await sharp(grain, { raw: { width: SCAN.width, height: SCAN.height, channels: 1 } }).png().toBuffer();
    let out = base.composite([{ input: noise, blend: 'multiply' }]).flatten({ background: '#f4f1ea' });
    out = format === 'jpeg' ? out.jpeg({ quality: 80, chromaSubsampling: '4:2:0' }) : out.png({ compressionLevel: 8 });
    const buf = await out.toBuffer();
    await sharp(buf).toFile(outPath);
    return buf;
  }
}
