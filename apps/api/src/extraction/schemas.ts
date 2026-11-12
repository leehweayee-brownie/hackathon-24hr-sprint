import { DocType } from '@vp/shared';
import { z } from 'zod';

export const classificationSchema = z.object({
  docType: z.nativeEnum(DocType),
  confidence: z.number().min(0).max(1),
  reason: z.string().optional(),
});

export const bboxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  })
  .nullable();

export const extractedFieldSchema = z.object({
  key: z.string().min(1),
  rawValue: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  page: z.number().int().min(1).default(1),
  bbox: bboxSchema.default(null),
});

export const extractionSchema = z.object({
  fields: z.array(extractedFieldSchema),
});

export type ClassificationOutput = z.infer<typeof classificationSchema>;
export type ExtractionOutput = z.infer<typeof extractionSchema>;

/** Pulls the first JSON object out of a model reply (tolerates code fences and prose). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in model reply');
  return JSON.parse(candidate.slice(start, end + 1));
}
