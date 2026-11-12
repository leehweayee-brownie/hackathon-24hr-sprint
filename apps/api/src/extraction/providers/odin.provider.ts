import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { ClassificationResult, DocType, ExtractionResult } from '@vp/shared';
import type { DocumentInput, ExtractionProvider } from '../extraction-provider.interface';
import { SYSTEM_PROMPT, classificationPrompt, extractionPrompt } from '../prompts';
import { classificationSchema, extractJson, extractionSchema } from '../schemas';

export interface OdinOptions {
  /** Odin API origin, no trailing slash or path. */
  baseUrl: string;
  /** Service-account key (`sk_svc_…`). Server-side only. */
  apiKey: string;
  /** Model id from Odin's catalog (`GET /v1/models`); must read images and PDFs. */
  model: string;
  /** Idle window: how long Odin may stay silent before a turn is abandoned. */
  timeoutMs: number;
  /** Opaque principal recorded on every session the API opens. */
  principalId: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

/** One attachment on an Odin message: raw base64, no `data:` prefix. */
interface OdinAttachment {
  data: string;
  mime_type: string;
  filename: string;
}

/** Odin caps one message at 10 attachments. */
const MAX_ATTACHMENTS = 10;
/** Small management calls (open and close a session). */
const MANAGEMENT_TIMEOUT_MS = 15_000;

export class OdinError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = 'OdinError';
  }
}

/**
 * Vision extraction through GT-Odin, Gamuda's internal agent platform.
 *
 * Each call opens a short-lived session, sends the document as attachments with the
 * instruction, reads the streamed reply, and ends the session. The turn is streamed
 * (SSE) rather than blocking, because Odin's gateway cuts a blocking turn off at
 * 30 seconds and a multi-page document can take longer. When the reply is not valid
 * JSON, one follow-up in the same session asks for the JSON only; Odin keeps the
 * conversation, so the document is not sent twice.
 *
 * Odin's stream does not report token counts, so usage is recorded as zero.
 */
export class OdinExtractionProvider implements ExtractionProvider {
  readonly name = 'odin';
  private readonly logger = new Logger(OdinExtractionProvider.name);
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OdinOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async classify(input: DocumentInput): Promise<ClassificationResult> {
    const json = await this.ask(input, classificationPrompt(), 'classify');
    return classificationSchema.parse(json);
  }

  async extract(input: DocumentInput, docType: DocType): Promise<ExtractionResult> {
    const json = await this.ask(input, extractionPrompt(docType), 'extract');
    return { fields: extractionSchema.parse(json).fields };
  }

  async completeJson(instruction: string, input?: DocumentInput): Promise<unknown> {
    return this.ask(input, instruction, 'complete');
  }

  private async ask(input: DocumentInput | undefined, instruction: string, purpose: string): Promise<unknown> {
    const attachments = input ? this.attachmentsFor(input) : undefined;
    const sessionId = await this.createSession(input, purpose);
    try {
      const first = await this.sendMessage(sessionId, `${SYSTEM_PROMPT}\n\n${instruction}`, attachments);
      try {
        return extractJson(first);
      } catch {
        const retry = await this.sendMessage(sessionId, 'Your previous reply was not valid JSON. Reply with only the JSON object.');
        return extractJson(retry);
      }
    } finally {
      await this.endSession(sessionId);
    }
  }

  private attachmentsFor(input: DocumentInput): OdinAttachment[] {
    if (input.pdf) {
      return [{ data: input.pdf.toString('base64'), mime_type: 'application/pdf', filename: input.fileName }];
    }
    const images = input.images ?? [];
    if (images.length === 0) throw new OdinError('The document has no pages to read');
    if (images.length > MAX_ATTACHMENTS) {
      throw new OdinError(`Odin reads at most ${MAX_ATTACHMENTS} page images per message; this document has ${images.length}`);
    }
    return images.map((img, i) => ({ data: img.toString('base64'), mime_type: 'image/jpeg', filename: `${stem(input.fileName)}-page-${i + 1}.jpg` }));
  }

  private async createSession(input: DocumentInput | undefined, purpose: string): Promise<string> {
    const session = await this.request<{ id: string }>('POST', '/v1/sessions', {
      external_principal_id: this.options.principalId,
      external_metadata: { app: 'vendor-passport', purpose, ...(input ? { sha256: input.sha256 } : {}) },
      model: this.options.model,
    });
    if (!session?.id) throw new OdinError('Odin did not return a session id');
    return session.id;
  }

  /** Best effort: a session that fails to close is logged, never thrown. */
  private async endSession(sessionId: string): Promise<void> {
    try {
      await this.request('PATCH', `/v1/sessions/${encodeURIComponent(sessionId)}`, { status: 'ended' });
    } catch (err) {
      this.logger.warn(`Odin session ${sessionId} not closed: ${(err as Error).message}`);
    }
  }

  /** Sends one user turn and returns the assistant's whole reply text. */
  private async sendMessage(sessionId: string, content: string, attachments?: OdinAttachment[]): Promise<string> {
    const path = `/v1/sessions/${encodeURIComponent(sessionId)}/messages?protocol=ag-ui`;
    const body = JSON.stringify({
      threadId: sessionId,
      runId: randomUUID(),
      state: {},
      tools: [],
      context: [],
      messages: [{ id: randomUUID(), role: 'user', content }],
      forwardedProps: attachments?.length ? { attachments } : {},
    });

    // One controller covers waiting for the response and the gaps between chunks.
    const abort = new AbortController();
    let stalled = false;
    let timer = setTimeout(() => ((stalled = true), abort.abort()), this.options.timeoutMs);
    const rearm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => ((stalled = true), abort.abort()), this.options.timeoutMs);
    };

    try {
      let res: Response;
      try {
        res = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.options.apiKey}`, 'content-type': 'application/json', accept: 'text/event-stream' },
          body,
          signal: abort.signal,
        });
      } catch (err) {
        throw new OdinError(stalled ? 'Odin timed out' : `Odin unreachable: ${(err as Error).message}`);
      }
      if (!res.ok) throw failureOf(res.status, await res.text().catch(() => ''));
      if (!res.body) throw new OdinError('Odin sent no stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';
      let text = '';
      let finished = false;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          rearm();
          buffered += decoder.decode(value, { stream: true });
          const frames = buffered.split(/\r?\n\r?\n/);
          buffered = frames.pop() ?? '';
          for (const frame of frames) {
            const event = parseFrame(frame);
            if (!event) continue;
            switch (event.type) {
              case 'TEXT_MESSAGE_CONTENT':
              case 'content_delta':
                text += event.delta ?? '';
                break;
              case 'RUN_FINISHED':
              case 'message_complete':
              case 'done':
                finished = true;
                break;
              case 'RUN_ERROR':
              case 'error':
                throw new OdinError(`Odin run failed: ${event.message ?? event.error ?? 'no reason given'}`, null, event.code ?? null);
              default:
                break;
            }
          }
        }
      } catch (err) {
        if (stalled) throw new OdinError('Odin timed out');
        throw err;
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      if (!finished && !text) throw new OdinError('Odin stream ended without a reply');
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  private async request<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.options.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(MANAGEMENT_TIMEOUT_MS),
      });
    } catch (err) {
      throw new OdinError(`Odin unreachable: ${(err as Error).message}`);
    }
    const raw = await res.text().catch(() => '');
    if (!res.ok) throw failureOf(res.status, raw);
    if (!raw) return undefined as T;
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new OdinError('Odin returned a non-JSON body', res.status);
    }
  }
}

interface OdinEvent {
  type?: string;
  delta?: string;
  message?: string;
  error?: string;
  code?: string;
}

/** One SSE frame: the `event:` name (legacy wire) or the payload's `type` (AG-UI wire). */
export function parseFrame(frame: string): OdinEvent | null {
  let name: string | undefined;
  const data: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith('event:')) name = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trim());
  }
  if (data.length === 0) return name ? { type: name } : null;
  try {
    const payload = JSON.parse(data.join('')) as OdinEvent;
    return { ...payload, type: payload.type ?? name };
  } catch {
    return name ? { type: name } : null;
  }
}

/**
 * Odin's structured error sits under `detail`, flat for attachment rejects
 * (`{detail: {code, message}}`) or nested (`{detail: {error: {code, message}}}`).
 */
function failureOf(status: number, raw: string): OdinError {
  try {
    const { detail } = JSON.parse(raw) as { detail?: unknown };
    if (detail && typeof detail === 'object') {
      const nested = (detail as { error?: unknown }).error;
      const source = (nested && typeof nested === 'object' ? nested : detail) as { code?: unknown; message?: unknown };
      if (typeof source.message === 'string') {
        return new OdinError(`Odin refused the request (${status}): ${source.message}`, status, typeof source.code === 'string' ? source.code : null);
      }
    }
    if (typeof detail === 'string') return new OdinError(`Odin refused the request (${status}): ${detail}`, status);
  } catch {
    /* not JSON */
  }
  return new OdinError(`Odin returned ${status}`, status);
}

function stem(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || 'page';
}
