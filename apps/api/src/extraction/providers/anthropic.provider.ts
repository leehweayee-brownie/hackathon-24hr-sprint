import Anthropic from '@anthropic-ai/sdk';
import { ClassificationResult, DocType, ExtractionResult, TokenUsage } from '@vp/shared';
import type { DocumentInput, ExtractionProvider } from '../extraction-provider.interface';
import { SYSTEM_PROMPT, classificationPrompt, extractionPrompt } from '../prompts';
import { classificationSchema, extractJson, extractionSchema } from '../schemas';

type ContentBlock = Anthropic.Messages.ContentBlockParam;

/** Vision extraction through the Anthropic Messages API. PDFs are sent whole, images as JPEG pages. */
export class AnthropicExtractionProvider implements ExtractionProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async classify(input: DocumentInput): Promise<ClassificationResult> {
    const { json, usage } = await this.ask(input, classificationPrompt(), 400);
    const parsed = classificationSchema.parse(json);
    return { ...parsed, usage };
  }

  async extract(input: DocumentInput, docType: DocType): Promise<ExtractionResult> {
    const { json, usage } = await this.ask(input, extractionPrompt(docType), 3000);
    const parsed = extractionSchema.parse(json);
    return { fields: parsed.fields, usage };
  }

  async completeJson(instruction: string, input?: DocumentInput): Promise<unknown> {
    const { json } = await this.ask(input, instruction, 2000);
    return json;
  }

  /** Sends the document (if any) plus an instruction; retries once when the reply is not valid JSON. */
  private async ask(input: DocumentInput | undefined, instruction: string, maxTokens: number): Promise<{ json: unknown; usage: TokenUsage }> {
    const content: ContentBlock[] = [...(input ? this.documentBlocks(input) : []), { type: 'text', text: instruction }];
    let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      });
      usage = { inputTokens: usage.inputTokens + res.usage.input_tokens, outputTokens: usage.outputTokens + res.usage.output_tokens };
      const text = res.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      try {
        return { json: extractJson(text), usage };
      } catch (err) {
        lastError = err as Error;
        content.push({ type: 'text', text: 'Your previous reply was not valid JSON. Reply with only the JSON object.' });
      }
    }
    throw lastError ?? new Error('Model returned no JSON');
  }

  private documentBlocks(input: DocumentInput): ContentBlock[] {
    if (input.pdf) {
      return [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.pdf.toString('base64') }, title: input.fileName }];
    }
    return (input.images ?? []).flatMap((img, i): ContentBlock[] => [
      { type: 'text', text: `Page ${i + 1}:` },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img.toString('base64') } },
    ]);
  }
}

/** USD per million tokens (input, output). Unknown models use Sonnet pricing. */
const PRICING: Record<string, [number, number]> = {
  'claude-haiku': [1, 5],
  'claude-sonnet': [3, 15],
  'claude-opus': [15, 75],
  'claude-fable': [15, 75],
};

export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const key = Object.keys(PRICING).find((k) => model.startsWith(k));
  const [inPrice, outPrice] = key ? PRICING[key] : PRICING['claude-sonnet'];
  return (usage.inputTokens * inPrice + usage.outputTokens * outPrice) / 1_000_000;
}
