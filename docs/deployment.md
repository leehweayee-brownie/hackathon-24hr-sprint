# Deployment Guide

Vendor Passport runs as two processes plus three backing services:

| Process | Entry | Needs |
|---|---|---|
| `api` | `node dist/main.js` (NestJS REST + Socket.IO, document pipeline) | PostgreSQL, Redis, object storage, AI key |
| `web` | Next.js standalone server on :8888 | `NEXT_PUBLIC_API_URL` |

The API processes uploaded documents in the background after it answers the upload, so it belongs on a platform with a long-running process (Railway, Render, Fly.io, Cloud Run with min instances and CPU always allocated, a VM with Docker Compose). Run one API instance: a document left in progress by a restart is resumed when the API starts, and two instances would both resume it. The web app deploys anywhere Next.js runs, including Vercel.

---

## 1. Backing services

| Service | Why | Suggested source |
|---|---|---|
| **PostgreSQL** | all application data | Neon, Supabase, Cloud SQL, or the compose service |
| **Redis** | realtime events to browsers (pub/sub), health check | Upstash Redis (TCP URL), Redis Cloud, Memorystore |
| **S3-compatible storage** | encrypted document files | AWS S3, Cloudflare R2, GCS (S3 interop), MinIO |

Redis must support pub/sub (processing events go through Redis to the Socket.IO gateway).

---

## 2. Environment variables (API)

Copy `apps/api/.env.example`. The important ones:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Postgres URL (use a pooled URL if your provider offers one) |
| `REDIS_URL` | `redis://` or `rediss://` URL |
| `STORAGE_DRIVER` | `s3` in every deployed environment |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE`, `S3_SSE` | storage credentials; `S3_SSE=AES256` keeps server-side encryption on |
| `JWT_SECRET`, `SHARE_TOKEN_SECRET` | 32+ random characters each (`openssl rand -base64 48`) |
| `AI_PROVIDER` | `anthropic` in production, `mock` for an offline demo |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | vision model credentials |
| `CORS_ORIGIN`, `WEB_URL` | the web app URL |
| `NODE_ENV` | `production` |

Web app: `NEXT_PUBLIC_API_URL` = the API URL without a trailing slash. It is baked in at build time; rebuild after changing it.

Never commit `.env` files. Keep keys in the platform's secret store.

---

## 3. Docker Compose on a single VM (simplest)

```bash
cp apps/api/.env.example apps/api/.env      # fill in secrets, set AI_PROVIDER=anthropic
docker compose --profile app up --build -d  # postgres, redis, minio, api, web
```

The API container runs `prisma migrate deploy` on start. Put Nginx or Caddy in front for TLS (proxy `/` to :8888 and `/api`, `/docs`, `/socket.io` to :4000, with WebSocket upgrade headers).

Seed demo data once (wipes the database):

```bash
docker compose --profile app exec api npm run db:seed -w @vp/api
```

---

## 4. Railway / Render / Fly.io (API) and Vercel (web)

1. Create one service from `docker/api.Dockerfile` (build context: repo root) with the default command (`node dist/main.js`).
2. Attach managed Postgres and Redis; set the storage variables to your bucket.
3. Deploy the web app on Vercel with Root Directory `apps/web`, Install Command `cd ../.. && npm ci`, Build Command `cd ../.. && npm run build:packages && npm run build -w @vp/web`, and `NEXT_PUBLIC_API_URL` set to the API's URL.
4. Set the API's `CORS_ORIGIN` and `WEB_URL` to the Vercel URL and redeploy the API.

Verify:

```bash
curl https://<api>/api/v1/health
# {"success":true,"data":{"status":"ok","db":"up","redis":"up","storage":"up"}}
```

---

## 5. Ongoing workflow

| Change | What happens |
|---|---|
| Schema | `npx -w @vp/api prisma migrate dev --name <name>` locally, commit the migration; the next API deploy applies it |
| Rules or weights | `packages/rules` is unit-tested in CI; weights are also editable at runtime in `/admin` |
| Fixtures | `npm run fixtures:generate` regenerates the fictional documents with dates relative to today |

CI (`.github/workflows/ci.yml`) builds every workspace, runs the rules and API tests against Postgres and Redis services with the mock AI provider, and builds the web app.
