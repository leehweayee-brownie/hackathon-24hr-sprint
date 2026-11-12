import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : ['1', 'true', 'yes'].includes(v.toLowerCase())));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default('api/v1'),
  API_URL: z.string().optional(),
  WEB_URL: z.string().default('http://localhost:8888'),
  CORS_ORIGIN: z.string().default('http://localhost:8888'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  STORAGE_DRIVER: z.enum(['s3', 'local']).default('local'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('vendor-passport'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool(true),
  S3_SSE: z.string().optional(),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().default(300),
  LOCAL_STORAGE_DIR: z.string().default('./uploads'),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  SHARE_TOKEN_SECRET: z.string().min(16).optional(),

  AI_PROVIDER: z.enum(['anthropic', 'mock']).default('mock'),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-sonnet-5-5'),
  AI_MAX_PAGES: z.coerce.number().default(20),
  CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.85),
  EXPIRY_WARNING_DAYS: z.coerce.number().default(30),
  FIXTURES_DIR: z.string().default('../../fixtures'),

  MAX_FILE_SIZE_MB: z.coerce.number().default(25),
  MAX_PAGES: z.coerce.number().default(20),
  RATE_LIMIT_TTL_SECONDS: z.coerce.number().default(60),
  RATE_LIMIT_MAX: z.coerce.number().default(120),

  MAIL_DRIVER: z.enum(['log']).default('log'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  const env = parsed.data;
  if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
    throw new Error('Invalid environment: ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic');
  }
  if (!env.API_URL) env.API_URL = `http://localhost:${env.PORT}`;
  if (!env.SHARE_TOKEN_SECRET) env.SHARE_TOKEN_SECRET = env.JWT_SECRET;
  return env;
}
