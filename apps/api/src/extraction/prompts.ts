import { DOC_TYPE_DEFINITIONS, DocType } from '@vp/shared';

export const SYSTEM_PROMPT =
  'You read Malaysian supplier onboarding documents (SSM, CIDB, insurance, SOCSO, LHDN, bank letters, ISO certificates). ' +
  'Reply with a single JSON object and nothing else. Never invent values: when a value is not printed, return null with low confidence.';

export function classificationPrompt(): string {
  const types = Object.values(DOC_TYPE_DEFINITIONS)
    .map((d) => `- ${d.type}: ${d.description}`)
    .join('\n');
  return (
    `Classify this document into exactly one type:\n${types}\n\n` +
    'Return JSON: {"docType": "<TYPE>", "confidence": <0..1>, "reason": "<one sentence>"}. ' +
    'Use OTHER when none fits (brochures, quotations, letters without a certificate).'
  );
}

export function extractionPrompt(docType: DocType): string {
  const def = DOC_TYPE_DEFINITIONS[docType];
  const fields = def.fields.map((f) => `- ${f.key} (${f.kind}${f.required ? ', required' : ''}): ${f.description}`).join('\n');
  return (
    `This is a ${def.label}. Extract these fields exactly as printed (do not normalize dates or names):\n${fields}\n\n` +
    'Return JSON: {"fields": [{"key": "<key>", "rawValue": "<text or null>", "confidence": <0..1>, "page": <1-based page>, ' +
    '"bbox": {"x": <0..1>, "y": <0..1>, "width": <0..1>, "height": <0..1>} or null}]}. ' +
    'bbox is the location of the value on the page as fractions of page width and height, origin top-left. ' +
    'Include every listed key once. Confidence reflects how clearly the value is printed and how sure you are it is the right value.'
  );
}
