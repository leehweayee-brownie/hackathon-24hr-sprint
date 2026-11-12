import { del, get, list, put } from '@vercel/blob';
import { BlobStorageAdapter } from './blob.adapter';
import { FileLinkSigner } from './file-link';

jest.mock('@vercel/blob', () => ({
  put: jest.fn(async () => ({ url: 'https://store.private.blob.vercel-storage.com/x', pathname: 'x' })),
  get: jest.fn(),
  del: jest.fn(async () => undefined),
  list: jest.fn(async () => ({ blobs: [], hasMore: false })),
}));

const links = { apiUrl: 'https://api.example.dev/', apiPrefix: 'api/v1', secret: 'test-secret-at-least-16' };
const key = 'suppliers/s1/documents/d1/03-cidb-certificate.pdf';

function webStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

describe('BlobStorageAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stores files privately under their key, overwriting in place', async () => {
    const adapter = new BlobStorageAdapter({ ...links, token: 'vercel_blob_rw_test' });
    await adapter.put(key, Buffer.from('%PDF'), { contentType: 'application/pdf' });
    expect(put).toHaveBeenCalledWith(key, Buffer.from('%PDF'), {
      access: 'private',
      contentType: 'application/pdf',
      addRandomSuffix: false,
      allowOverwrite: true,
      token: 'vercel_blob_rw_test',
    });
  });

  it('relies on OIDC when no token is configured', async () => {
    await new BlobStorageAdapter(links).put(key, Buffer.from('x'), { contentType: 'application/pdf' });
    expect((put as jest.Mock).mock.calls[0][2]).not.toHaveProperty('token');
  });

  it('streams and buffers private files', async () => {
    (get as jest.Mock).mockImplementation(async () => ({ statusCode: 200, stream: webStream('hello'), blob: { contentType: 'application/pdf', size: 5 } }));
    const adapter = new BlobStorageAdapter(links);
    const file = await adapter.getStream(key);
    expect(file).toMatchObject({ contentType: 'application/pdf', size: 5 });
    expect(get).toHaveBeenCalledWith(key, { access: 'private' });
    await expect(adapter.get(key)).resolves.toEqual(Buffer.from('hello'));
  });

  it('reports a missing blob', async () => {
    (get as jest.Mock).mockResolvedValue(null);
    await expect(new BlobStorageAdapter(links).get(key)).rejects.toThrow('Blob not found');
  });

  it('deletes and health-checks through the SDK', async () => {
    const adapter = new BlobStorageAdapter(links);
    await adapter.delete(key);
    expect(del).toHaveBeenCalledWith(key, {});
    await expect(adapter.healthCheck()).resolves.toBe(true);
    expect(list).toHaveBeenCalledWith({ limit: 1 });
  });

  it('hands out signed API links instead of blob URLs', async () => {
    const adapter = new BlobStorageAdapter(links);
    const url = await adapter.signedUrl(key, 300, '03-cidb-certificate.pdf');
    expect(url).toMatch(/^https:\/\/api\.example\.dev\/api\/v1\/files\/[\w-]+\.[\w-]+$/);
    const token = url.split('/files/')[1];
    expect(adapter.verifyLink(token)).toMatchObject({ key, name: '03-cidb-certificate.pdf' });
  });
});

describe('FileLinkSigner', () => {
  const signer = new FileLinkSigner(links);

  it('rejects tampered and expired links', () => {
    const good = signer.sign({ key, exp: Date.now() + 60_000 });
    expect(signer.verify(good)).toMatchObject({ key });
    const [data, sig] = good.split('.');
    const forged = Buffer.from(JSON.stringify({ key: 'suppliers/other/secret.pdf', exp: Date.now() + 60_000 })).toString('base64url');
    expect(signer.verify(`${forged}.${sig}`)).toBeNull();
    expect(signer.verify(`${data}.x`)).toBeNull();
    expect(signer.verify(signer.sign({ key, exp: Date.now() - 1 }))).toBeNull();
  });
});
