# Vercel Deployment Guide

2048 Arena deploys as **two Vercel projects from the same Git repository**:

| Project | Root Directory | What runs |
|---|---|---|
| `arena-api` | `apps/api` | NestJS REST API **and** the Socket.IO game server, as one Vercel Function (Fluid Compute) |
| `arena-web` | `apps/web` | Next.js frontend |

Both projects install the whole npm workspace from the repo root and build the shared packages (`@arena/game-engine`, `@arena/shared`) first. That is already configured in each app's `vercel.json`. You don't need to change any build settings in the dashboard.

---

## 1. External services (API project)

The API needs:

| Service | Why | Suggested source |
|---|---|---|
| **PostgreSQL** | users, games, matches, records | Vercel Marketplace → Neon or Supabase |
| **Redis** | matchmaking queue, live match state, Socket.IO adapter, locks, leaderboard cache | Vercel Marketplace → Upstash Redis or Redis Cloud |

> **Redis is required on Vercel.** Each WebSocket is pinned to one function instance, and instances come and go. Without Redis, two players can land on different instances that can't see each other's queue or match. The API falls back to in-memory state only when `REDIS_URL` is unset, which is fine for local development but not for Vercel.

Install both integrations on the `arena-api` project. They inject their connection variables automatically. Check that `DATABASE_URL`, `DIRECT_URL` and `REDIS_URL` exist (see below). The API also accepts `KV_URL` if your Redis integration names it that way.

---

## 2. Deploy the API (`apps/api`)

```bash
npm i -g vercel@latest
vercel login

cd apps/api
vercel link            # create project "arena-api", Root Directory = apps/api
```

### Environment variables (Project → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `DATABASE_URL` | Pooled Postgres URL (Neon: `-pooler` host; Supabase: port 6543 with `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | Direct (non-pooled) Postgres URL, used by `prisma migrate deploy` during the build |
| `REDIS_URL` | `rediss://…` TCP URL of your Redis (pub/sub must be supported; Upstash and Redis Cloud both support it) |
| `JWT_SECRET` | ≥ 32 random characters (`openssl rand -base64 48`) |
| `JWT_EXPIRES_IN` | `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | `7` |
| `CORS_ORIGIN` | The web URL(s), comma-separated, e.g. `https://arena-web.vercel.app` |
| `WEB_URL` | The web URL, used in email verification links |
| `NODE_ENV` | `production` |

Then deploy:

```bash
vercel --prod
```

### What the build does

`apps/api/vercel.json` runs `npm run vercel-build`, which:

1. builds `@arena/game-engine` and `@arena/shared`
2. runs `prisma migrate deploy` (applies pending migrations using `DIRECT_URL`)
3. runs `prisma generate && nest build` → `dist/`

`api/index.js` exports the NestJS app's `http.Server` (`src/serverless.ts`). Vercel serves both REST requests and WebSocket upgrades from it. Every path is rewritten to that function, so the URLs match local development:

- REST: `https://<api>/api/v1/...`
- Swagger: `https://<api>/docs`
- Socket.IO: `https://<api>/game` (path `/socket.io`, WebSocket transport)

### Seed demo data (optional)

The seed **wipes all data**. Run it once from your machine against the production database:

```bash
cd apps/api
DATABASE_URL="<direct url>" DIRECT_URL="<direct url>" npm run prisma:seed
```

### Verify

```bash
curl https://<api>.vercel.app/api/v1/health
# {"success":true,"data":{"status":"ok","db":"up","store":"up","storeKind":"redis",...}}
```

`storeKind` must say `redis` on Vercel.

---

## 3. Deploy the web app (`apps/web`)

```bash
cd apps/web
vercel link            # create project "arena-web", Root Directory = apps/web
```

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | The API URL without a trailing slash, e.g. `https://arena-api.vercel.app` |

```bash
vercel --prod
```

`NEXT_PUBLIC_*` values are baked in at build time. Redeploy after changing it. The same URL feeds the Content-Security-Policy `connect-src` (HTTPS and WSS) in `next.config.ts`.

Finally, set the API's `CORS_ORIGIN` and `WEB_URL` to the web URL, then redeploy the API.

---

## 4. How real-time play works on Vercel

| Concern | How it is handled |
|---|---|
| WebSockets on Functions | Needs Fluid Compute, which is on by default for new projects. The client uses `transports: ['websocket']` only, because HTTP long-polling can't work across instances. |
| Function max duration | `maxDuration: 300` (Hobby maximum; Pro can raise it to 800 in `apps/api/vercel.json`). A 10-minute race outlives one connection. When the function recycles, the client reconnects automatically and the server re-sends the match snapshot (`match:start` with `current`). The 30-second reconnect grace period covers the gap. |
| Multiple instances | All queue, room and match state lives in Redis. Every change happens under a Redis lock, and the Socket.IO Redis adapter delivers events to sockets on any instance. |
| Timers (ready check, countdown, round end, grace) | Each instance sets a precise local timer, and a 1-second sweeper on every instance (guarded by the same locks) catches deadlines whose timer lived on an instance that went away. |
| Cold starts | Requests and WebSocket upgrades that arrive while Nest boots are held and replayed once it is ready (`src/serverless.ts`). |
| Rate limiting | The REST throttler is per instance. Socket move rate limiting is per player, stored in the match state in Redis. |

---

## 5. Ongoing workflow

| Change | Command |
|---|---|
| API code | `cd apps/api && vercel --prod` (or push to the production branch with Git integration) |
| Schema | `cd apps/api && npx prisma migrate dev --name <name>` locally, commit the migration. The next API deploy applies it. |
| Web code | `cd apps/web && vercel --prod` |

With the Git integration, each push builds both projects. Preview deployments use the Preview environment variables. Give Preview its own database, because the build runs migrations.

---

## 6. Alternatives for the API

The API also runs as an ordinary long-lived Node process (`node dist/main`), which suits platforms with persistent connections:

```bash
docker build -f docker/api.Dockerfile -t arena-api .
docker run -p 4000:4000 --env-file apps/api/.env arena-api   # runs migrations, then starts
```

Railway, Render and Fly.io all work with that image and the same environment variables. Without `REDIS_URL`, run exactly one instance.
