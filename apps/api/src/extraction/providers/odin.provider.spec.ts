import { DocType } from '@vp/shared';
import type { DocumentInput } from '../extraction-provider.interface';
import { OdinError, OdinExtractionProvider, parseFrame } from './odin.provider';

interface Call {
  method: string;
  url: string;
  body: Record<string, unknown> | null;
}

/** A fake Odin: answers session calls with JSON and message calls with the next scripted SSE reply. */
function fakeOdin(replies: Array<string | { status: number; body: unknown }>) {
  const calls: Call[] = [];
  const queue = [...replies];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    calls.push({ method: init?.method ?? 'GET', url: u, body });
    if (u.endsWith('/v1/sessions') && init?.method === 'POST') return json(201, { id: 'sess-1', model: 'gemini-3.5-flash' });
    if (init?.method === 'PATCH') return json(200, { id: 'sess-1', status: 'ended' });
    const next = queue.shift();
    if (next === undefined) throw new Error('no scripted reply left');
    if (typeof next !== 'string') return json(next.status, next.body);
    return sse(next);
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Streams the reply text as AG-UI frames, split across several chunks. */
function sse(text: string): Response {
  const half = Math.ceil(text.length / 2);
  const frames = [
    'event: RUN_STARTED\ndata: {"type":"RUN_STARTED","runId":"r1"}\n\n',
    `id: 1\nevent: TEXT_MESSAGE_CONTENT\ndata: ${JSON.stringify({ type: 'TEXT_MESSAGE_CONTENT', delta: text.slice(0, half) })}\n\n`,
    `id: 2\nevent: TEXT_MESSAGE_CONTENT\ndata: ${JSON.stringify({ type: 'TEXT_MESSAGE_CONTENT', delta: text.slice(half) })}\n\n`,
    'event: RUN_FINISHED\ndata: {"type":"RUN_FINISHED"}\n\n',
  ].join('');
  const bytes = new TextEncoder().encode(frames);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Cut mid-frame to prove partial frames are buffered.
      controller.enqueue(bytes.slice(0, 37));
      controller.enqueue(bytes.slice(37));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const pdfInput: DocumentInput = { fileName: '03-cidb-certificate.pdf', sha256: 'abc', mimeType: 'application/pdf', pageCount: 1, pdf: Buffer.from('%PDF-1.7 test') };

function provider(fetchImpl: typeof fetch) {
  return new OdinExtractionProvider({
    baseUrl: 'https://odin.test/',
    apiKey: 'sk_svc_test',
    model: 'gemini-3.5-flash',
    timeoutMs: 5_000,
    principalId: 'system:vendor-passport',
    fetchImpl,
  });
}

describe('OdinExtractionProvider', () => {
  it('classifies a PDF in one session and closes it', async () => {
    const odin = fakeOdin(['```json\n{"docType":"CIDB","confidence":0.97,"reason":"CIDB certificate"}\n```']);
    const result = await provider(odin.fetchImpl).classify(pdfInput);

    expect(result).toEqual({ docType: DocType.CIDB, confidence: 0.97, reason: 'CIDB certificate' });
    expect(odin.calls.map((c) => c.method)).toEqual(['POST', 'POST', 'PATCH']);

    const [create, message, end] = odin.calls;
    expect(create.url).toBe('https://odin.test/v1/sessions');
    expect(create.body).toMatchObject({ external_principal_id: 'system:vendor-passport', model: 'gemini-3.5-flash' });
    expect(message.url).toBe('https://odin.test/v1/sessions/sess-1/messages?protocol=ag-ui');
    const props = message.body?.forwardedProps as { attachments: Array<Record<string, string>> };
    expect(props.attachments).toEqual([{ data: Buffer.from('%PDF-1.7 test').toString('base64'), mime_type: 'application/pdf', filename: '03-cidb-certificate.pdf' }]);
    expect(message.body?.messages).toEqual([expect.objectContaining({ role: 'user', content: expect.stringContaining('Classify this document') })]);
    expect(end.body).toEqual({ status: 'ended' });
  });

  it('asks once more in the same session when the reply is not JSON', async () => {
    const odin = fakeOdin([
      'I could not decide.',
      '{"fields":[{"key":"grade","rawValue":"G5","confidence":0.95,"page":1,"bbox":{"x":0.5,"y":0.4,"width":0.1,"height":0.02}}]}',
    ]);
    const result = await provider(odin.fetchImpl).extract(pdfInput, DocType.CIDB);

    expect(result.fields).toEqual([{ key: 'grade', rawValue: 'G5', confidence: 0.95, page: 1, bbox: { x: 0.5, y: 0.4, width: 0.1, height: 0.02 } }]);
    const messages = odin.calls.filter((c) => c.url.includes('/messages'));
    expect(messages).toHaveLength(2);
    expect(messages[1].body?.forwardedProps).toEqual({});
    expect(odin.calls.filter((c) => c.url.endsWith('/v1/sessions'))).toHaveLength(1);
  });

  it('sends scanned pages as JPEG attachments', async () => {
    const odin = fakeOdin(['{"docType":"BANK_REFERENCE","confidence":0.9}']);
    await provider(odin.fetchImpl).classify({ fileName: '07-bank-reference.png', sha256: 'x', mimeType: 'image/png', pageCount: 2, images: [Buffer.from('a'), Buffer.from('b')] });
    const props = odin.calls[1].body?.forwardedProps as { attachments: Array<Record<string, string>> };
    expect(props.attachments.map((a) => [a.mime_type, a.filename])).toEqual([
      ['image/jpeg', '07-bank-reference-page-1.jpg'],
      ['image/jpeg', '07-bank-reference-page-2.jpg'],
    ]);
  });

  it("surfaces Odin's refusal and still closes the session", async () => {
    const odin = fakeOdin([{ status: 422, body: { detail: { code: 'file_too_large', message: 'Attachment exceeds 10MB' } } }]);
    const err = await provider(odin.fetchImpl).classify(pdfInput).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(OdinError);
    expect((err as OdinError).code).toBe('file_too_large');
    expect((err as OdinError).message).toContain('Attachment exceeds 10MB');
    expect(odin.calls.at(-1)?.method).toBe('PATCH');
  });

  it('refuses more page images than Odin accepts before opening a session', async () => {
    const odin = fakeOdin([]);
    const images = Array.from({ length: 11 }, () => Buffer.from('p'));
    await expect(provider(odin.fetchImpl).classify({ fileName: 'big.jpg', sha256: 'x', mimeType: 'image/jpeg', pageCount: 11, images })).rejects.toThrow('at most 10');
    expect(odin.calls).toHaveLength(0);
  });
});

describe('parseFrame', () => {
  it('reads AG-UI and legacy frames', () => {
    expect(parseFrame('event: TEXT_MESSAGE_CONTENT\ndata: {"type":"TEXT_MESSAGE_CONTENT","delta":"hi"}')).toEqual({ type: 'TEXT_MESSAGE_CONTENT', delta: 'hi' });
    expect(parseFrame('event: content_delta\ndata: {"delta":"hi"}')).toEqual({ type: 'content_delta', delta: 'hi' });
    expect(parseFrame('event: done\ndata: {}')).toEqual({ type: 'done' });
    expect(parseFrame(': keep-alive')).toBeNull();
  });
});
