# Build conventions (read before touching the code)

## Workspaces
- `packages/shared` (`@vp/shared`): enums, doc-type field definitions, API/socket types, constants. CommonJS build in `dist/`. Rebuild after edits: `npm run build -w @vp/shared`.
- `packages/rules` (`@vp/rules`): pure rules engine (`evaluate`, `runCrossChecks`, `computeTrustScore`, `buildTimeline`, normalizers, `cidb-grades`). No framework or AI imports.
- `apps/api` (`@vp/api`): NestJS API (`src/main.ts`). It also runs the document pipeline in the background (`src/documents/pipeline/`, concurrency `PIPELINE_CONCURRENCY`, 3 attempts, resumes unfinished documents on boot) Due reminders are sent only through `POST /admin/reminders/run` (no automatic schedule). Prisma schema in `prisma/schema.prisma`, seed in `prisma/seed.ts`.
- `apps/web` (`@vp/web`): Next.js app on :8888.
- `fixtures` (`@vp/fixtures`): generator for fictional demo documents + recorded extractions.

## API
- Prefix `api/v1`, Swagger at `/docs`, health at `GET /api/v1/health`.
- Entry points: `src/main.ts` (long-running server) and `src/serverless.ts` (Vercel Function, re-exported by `api/index.js`). Both configure the app through `src/app.setup.ts`.
- Envelope: success `{ success: true, data, meta? }`, error `{ success: false, message, code, errors: [] }` (codes in `ErrorCode`).
- Auth: `POST /auth/login` → `{ user: UserView, tokens: AuthTokens }`. Bearer access token (15m). `POST /auth/refresh` body `{ refreshToken }` rotates. `GET /auth/me`.
- Upload: `POST /documents` multipart field `files` (1..30). Returns created `DocumentView[]`; processing is async.
- Fields: `PATCH /fields/:id` body `{ action: 'confirm' | 'correct', value?: string }`.
- Buyers may read a supplier's documents when they have a vendor check with that supplier or hold a share.
- Public passport: `GET /p/:token` → `PassportView`; `GET /p/:token/documents/:id/file` → `{ url }`.
- Notifications: `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`.

## Realtime
- Socket.IO namespace `/intake`, JWT in handshake `auth.token`. Users auto-join `org:<organizationId>`.
- Buyers emit `subscribe:supplier` `{ supplierId }` to join `supplier:<id>` (allowed when they have a vendor check with that supplier).
- The pipeline publishes events to Redis channel `vp:realtime` as `{ rooms: string[], event, payload }`; the API gateway subscribes and emits.

## Storage
- Object key: `suppliers/<supplierId>/documents/<documentId>/<original file name>`.
- Local development: `STORAGE_DRIVER=local`, files under `apps/api/uploads/` (`LOCAL_STORAGE_DIR=./uploads`, relative to `apps/api`), served through short-lived signed links at `/api/v1/files/:token`. Git-ignored.
- Deployed: `STORAGE_DRIVER=s3` (S3, R2 or MinIO, bucket `vendor-passport`, SSE AES256).

## AI
- `ExtractionProvider` interface: `classify(input)` and `extract(input, docType)` (types in `@vp/shared`).
- `AI_PROVIDER=odin` (`providers/odin.provider.ts`): one short GT-Odin session per call, document sent as `forwardedProps.attachments` (PDF whole, scans as JPEG pages, max 10), reply streamed over SSE (`?protocol=ag-ui`) because Odin's gateway cuts blocking turns at 30 s, one JSON retry in the same session, session ended in `finally`. No token counts are reported, so usage rows record zero tokens and model `odin/<ODIN_MODEL>`.
- `AI_PROVIDER=mock` replays `fixtures/extractions/<file name>.json` (`ExtractionRecording`), matched by file name (case-insensitive). Unknown files → `OTHER`, confidence 0.5.
- Date values in recordings may be `{{today+23d}}` / `{{today-10d}}`; the mock provider and the seed resolve them to ISO dates at run time.
- Extraction is cached by `sha256 + docType` in the `ai_usage` / recorded results (same file is never read twice).

## Demo data (seed, `npm run db:seed`)
- Admin org + `admin@vp.local`.
- Supplier **Bina Jaya Sdn Bhd** (`supplier@binajaya.local`): NO documents (the demo uploads `fixtures/documents/bina-jaya/`).
- Supplier **Mega Wira Construction Sdn Bhd** (`supplier@megawira.local`): fully processed, verified documents from `fixtures/documents/mega-wira/`.
- Buyer **Northbridge Infrastructure Bhd** (`buyer@procurement.local`, procurement officer; `approver@procurement.local`, approver).
- Vendor checks: Bina Jaya for "Package 3B: Earthworks and drainage, Sungai Buloh" RM8,000,000 (IN_REVIEW); Mega Wira for "Site office fit-out, Kota Kemuning" RM1,800,000 (IN_REVIEW).
- All passwords `Password123!`. All data fictional.
