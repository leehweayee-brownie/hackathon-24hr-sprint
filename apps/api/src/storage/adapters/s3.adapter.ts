import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PutOptions, StorageAdapter } from './storage.adapter';

export interface S3AdapterOptions {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKey?: string;
  secretKey?: string;
  forcePathStyle?: boolean;
  /** Server-side encryption algorithm, e.g. AES256. Empty disables. */
  sse?: string;
}

/** S3-compatible storage (AWS S3, MinIO). Objects are stored with server-side encryption when configured. */
export class S3StorageAdapter implements StorageAdapter {
  readonly kind = 's3' as const;
  private readonly client: S3Client;
  private sseDisabled = false;

  constructor(private readonly options: S3AdapterOptions, private readonly warn: (msg: string) => void = () => undefined) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: options.forcePathStyle ?? true,
      credentials:
        options.accessKey && options.secretKey ? { accessKeyId: options.accessKey, secretAccessKey: options.secretKey } : undefined,
    });
  }

  async put(key: string, body: Buffer, { contentType }: PutOptions): Promise<void> {
    const input: PutObjectCommandInput = { Bucket: this.options.bucket, Key: key, Body: body, ContentType: contentType };
    if (this.options.sse && !this.sseDisabled) input.ServerSideEncryption = this.options.sse as PutObjectCommandInput['ServerSideEncryption'];
    try {
      await this.client.send(new PutObjectCommand(input));
    } catch (err) {
      // MinIO without a KMS rejects SSE-S3 (501 NotImplemented); fall back once so local development keeps working.
      const e = err as Error & { name?: string; $metadata?: { httpStatusCode?: number } };
      if (input.ServerSideEncryption && (e.$metadata?.httpStatusCode === 501 || e.name === 'NotImplemented' || /KMS|encryption|not implemented/i.test(String(e.message)))) {
        this.sseDisabled = true;
        this.warn(`Object store rejected server-side encryption (${(err as Error).message}); storing without SSE`);
        delete input.ServerSideEncryption;
        await this.client.send(new PutObjectCommand(input));
        return;
      }
      throw err;
    }
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty object ${key}`);
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }));
  }

  async signedUrl(key: string, ttlSeconds: number, fileName?: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.options.bucket,
      Key: key,
      ResponseContentDisposition: fileName ? `inline; filename="${fileName.replace(/"/g, '')}"` : undefined,
    });
    return getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.options.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
