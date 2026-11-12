# Vendor Passport

AI-powered supplier onboarding built with **NestJS**, **Next.js**, **PostgreSQL** and a **vision AI model**.

Suppliers upload their company documents once. The system sorts each file, reads it, cross-checks it against every other document, and catches the contradictions people miss. Buyers get a **trust score with reasons** and an **expiry timeline**; suppliers get a verified **Vendor Passport** they can share with any buyer by link.

> Upload once, reuse everywhere.

The project emphasizes:

- Clean Architecture
- SOLID Principles
- Secure authentication and document storage
- Explainable AI (every extracted value points to its source on the page)
- Human confirmation for anything the AI is unsure about
- Testability
- Maintainability
- Production-ready coding practices

---

# Why

| Problem today | What Vendor Passport does |
|---|---|
| Officers read every certificate and licence by hand for each vendor | AI sorts and reads the documents in minutes |
| Risk slips through: expired insurance, mismatched company names, CIDB grades below the contract value | Cross-document checks flag them before contract award |
| Suppliers resubmit the same pile of documents to every client, every year | One always-current passport, shared by link |

Target estimate (to be verified with procurement): about 2 hours of manual review cut to about 10 minutes per vendor, roughly 900 hours saved per 500 new vendors a year.

---

# Features

## Authentication

- User Registration (supplier or buyer organization)
- Login
- JWT Authentication
- Refresh Token Rotation
- Password Hashing (Argon2)
- Email Verification
- Invite teammates to an organization
- Role-based Access Control
    - Supplier (owner, member)
    - Buyer officer (procurement, contracts, finance, project)
    - Buyer approver
    - Admin

---

## Smart Intake

- Drag and drop a whole messy folder (PDF, JPG, PNG, HEIC; multi-page scans supported)
- Each file is classified automatically and sorts itself into place, live, as it is processed
- Supported document types (Malaysia first):
    - SSM company registration (Form 9 / Section 17 / e-Info profile)
    - CIDB registration certificate (grade and categories)
    - Public liability insurance
    - Workmen's compensation / SOCSO coverage
    - LHDN tax clearance
    - Bank reference letter
    - ISO and other quality certificates
    - Other (kept, not scored)
- Duplicate and superseded documents detected (a newer policy replaces the old one)
- Unreadable or unknown files are listed for the supplier to fix, not silently dropped

---

## Extraction

- Fields extracted per document type: company name, registration number, issuer, grade, coverage amount, insured party, issue date, expiry date and more
- Every field shows its **highlighted source** on the document page (bounding box)
- Every field has a **confidence score**
- Fields below the confidence threshold (default 0.85) must be confirmed or corrected by an officer before approval
- Corrections are kept with who made them and when

---

## Cross-check

Rules run across all of a vendor's documents, not one document at a time.

| Check | Example finding |
|---|---|
| Company name consistency | Insurance names *Bina Jaya Engineering Sdn Bhd*, but SSM says *Bina Jaya Sdn Bhd* |
| Registration number consistency | SSM number on the CIDB certificate does not match the SSM certificate |
| CIDB grade vs contract value | Grade does not allow a contract of this tender's value |
| Expiry | Insurance expires in 23 days |
| Required documents | Tax clearance missing for this tender |
| Coverage | Liability cover below the buyer's minimum |

Company names are normalized before comparison (case, punctuation, "Sdn. Bhd." vs "Sdn Bhd"), so only real differences are flagged.

CIDB grade limits are configuration, not code (`packages/rules/src/config/cidb-grades.ts`). Check them against current CIDB rules before going live.

---

## Trust Score

- Score from 0 to 100, shown as a ring that fills with its reasons
- Every deduction is listed in plain words with a link to the documents behind it
- Bands: **80–100** green, **60–79** amber, **below 60** red
- Default weights (configurable per buyer):

| Finding | Deduction |
|---|---|
| Required document expired | −30 |
| Registration number mismatch | −25 |
| CIDB grade below contract value | −25 |
| Company name mismatch | −20 |
| Required document missing | −15 |
| Document expiring within 30 days | −10 |
| Unconfirmed low-confidence field | −5 |

- The score is recalculated whenever documents, rules or the tender value change

---

## Expiry Timeline

- Timeline of every document's validity
- Amber within 30 days of expiry, red when expired
- Automatic reminders to the supplier at 60, 30 and 7 days before expiry, and on the day
- Buyers holding a share link are notified when a document they rely on expires or is renewed

---

## Vendor Passport

- Verified profile per supplier: company details, documents, trust score, expiry timeline
- **Always current**: renewing a document updates every passport view
- Shared by link with any buyer
    - Links are signed, revocable and can expire
    - Supplier sees who viewed the passport and when
    - Buyers can request access from inside the app
- Read-only passport view works without a buyer account

---

## Vendor Checks (buyer side)

- Start a check for a supplier against a tender or contract (title, value, required documents)
- Review queue for officers: findings, low-confidence fields, trust score
- Approve, reject or request more documents (supplier is notified)
- Approver sign-off above a configurable contract value
- Full audit log of every view, correction and decision

---

## Admin

Role-gated `/admin` screen.

- Manage organizations and users, suspend or delete accounts
- Edit document types, extraction fields and rule weights
- View processing queue health and failed extractions

---

# Tech Stack

## Frontend

- Next.js
- TypeScript
- React Query
- Zustand
- Tailwind CSS
- Framer Motion (documents sorting into place, score ring)
- PDF.js (page rendering and source highlights)
- React Hook Form
- Zod
- Axios
- Socket.IO Client (live processing status)

---

## Backend

- NestJS
- TypeScript
- PostgreSQL
- Prisma ORM
- BullMQ (document processing jobs)
- Socket.IO Gateway (processing progress)
- Vision AI model through the Anthropic API (classification and extraction)
- Passport JWT
- Argon2
- Swagger
- Class Validator
- Class Transformer

---

## Storage

PostgreSQL

Redis (job queue, cache)

S3-compatible object storage with server-side encryption in deployed environments; a local `uploads/` folder in development

---

## Infrastructure

Docker

Docker Compose

Nginx (optional)

GitHub Actions CI

---

# Architecture

## Document pipeline

```
UPLOADED → CONVERTING → CLASSIFYING → EXTRACTING → NEEDS_REVIEW ─┐
                                                   │              │
                                                   └──────────────┴→ VERIFIED
                          any step ── error ──→ FAILED (retry up to 3 times)
```

1. The file is stored encrypted in object storage and a job is queued.
2. Pages are converted to images.
3. The vision model classifies the document type.
4. The vision model extracts the fields for that type, with a bounding box and confidence for each value. Output is validated against a Zod schema; invalid output is retried.
5. Values are normalized (names, dates, currency, grades).
6. Fields below the confidence threshold go to `NEEDS_REVIEW`.
7. When a vendor's documents change, the cross-check and trust score run again.
8. Progress is pushed to the browser over Socket.IO, so the supplier sees each file sort itself into place.

## Rules engine

Cross-checks and scoring live in `packages/rules`: pure TypeScript with no framework or AI dependency. It takes normalized fields and returns findings and a score, so every rule can be unit-tested with fixed inputs and the same input always gives the same result.

The AI reads documents; the rules engine makes the decisions. The model never sets the score.

---

# Project Structure

```
vendor-passport

├── apps
│   ├── api
│   └── web
│
├── packages
│   ├── rules
│   ├── shared
│   ├── ui
│   └── config
│
├── fixtures
│   └── documents        (fictional demo documents)
├── docker
├── docs
└── README.md
```

---

# Backend Structure

```
src

modules

├── auth
├── users
├── organizations
├── documents
├── intake          (upload, queue)
├── extraction      (AI calls, schemas, normalization)
├── cross-check
├── trust-score
├── passports
├── vendor-checks
├── reminders
├── notifications
├── audit
├── realtime
├── admin
├── common
├── database
├── storage
├── config
└── health
```

---

# Frontend Structure

```
app

components

features
├── intake
├── document-viewer
├── findings
├── trust-score
├── timeline
├── passport
├── vendor-checks
└── admin

hooks

services

socket

store

types

utils
```

---

# Database Schema

## organizations

| Column |
|---------|
| id |
| type (supplier, buyer) |
| name |
| registration_no |
| settings (json: thresholds, rule weights) |
| created_at |

---

## users

| Column |
|---------|
| id |
| organization_id |
| name |
| email |
| password |
| role |
| email_verified_at |
| created_at |

---

## documents

| Column |
|---------|
| id |
| supplier_id |
| file_key |
| file_name |
| mime_type |
| page_count |
| sha256 |
| doc_type |
| classification_confidence |
| status |
| issued_at |
| expires_at |
| superseded_by_id (nullable) |
| uploaded_by |
| created_at |

---

## document_fields

| Column |
|---------|
| id |
| document_id |
| key |
| raw_value |
| normalized_value |
| confidence |
| page |
| bbox (x, y, width, height) |
| confirmed_by (nullable) |
| confirmed_at (nullable) |
| corrected_value (nullable) |

---

## vendor_checks

| Column |
|---------|
| id |
| buyer_id |
| supplier_id |
| tender_title |
| contract_value |
| required_doc_types |
| trust_score |
| status (draft, in_review, more_info, approved, rejected) |
| decided_by |
| decided_at |
| created_at |

---

## findings

| Column |
|---------|
| id |
| supplier_id |
| vendor_check_id (nullable) |
| rule |
| severity (info, warning, critical) |
| message |
| deduction |
| document_ids |
| resolved_at |
| created_at |

---

## passports

| Column |
|---------|
| id |
| supplier_id |
| trust_score |
| status (draft, verified) |
| verified_at |
| updated_at |

---

## passport_shares

| Column |
|---------|
| id |
| passport_id |
| token_hash |
| buyer_id (nullable) |
| expires_at |
| revoked_at |
| last_viewed_at |
| view_count |

---

## reminders

| Column |
|---------|
| id |
| document_id |
| due_at |
| kind (60d, 30d, 7d, expired) |
| sent_at |

---

## audit_logs

| Column |
|---------|
| id |
| actor_id |
| action |
| entity |
| entity_id |
| metadata |
| created_at |

---

## refresh_tokens

| Column |
|---------|
| id |
| user_id |
| token_hash |
| expires_at |
| revoked_at |

---

# API

## Auth

POST /auth/register

POST /auth/login

POST /auth/refresh

POST /auth/logout

POST /auth/verify-email

POST /auth/invite

---

## Documents (supplier)

POST /documents — upload one or more files (multipart)

GET /documents

GET /documents/:id

GET /documents/:id/file — short-lived signed URL

DELETE /documents/:id

POST /documents/:id/reprocess

---

## Fields

PATCH /fields/:id — confirm or correct a value

---

## Passport

GET /passport — own passport (supplier)

POST /passport/shares — create a share link

DELETE /passport/shares/:id — revoke

GET /passport/shares/:id/views

GET /p/:token — public read-only passport view

---

## Vendor Checks (buyer)

POST /vendor-checks

GET /vendor-checks

GET /vendor-checks/:id — findings, score, timeline

PATCH /vendor-checks/:id — update tender value or required documents

POST /vendor-checks/:id/request-info

POST /vendor-checks/:id/approve

POST /vendor-checks/:id/reject

POST /access-requests — ask a supplier for their passport

---

## Admin

GET /admin/organizations *(admin only)*

PATCH /admin/users/:id/suspend *(admin only)*

DELETE /admin/users/:id *(admin only)*

GET /admin/document-types *(admin only)*

PUT /admin/rules *(admin only)*

GET /admin/queue *(admin only)*

---

# Socket.IO Events

Namespace: `/intake`. The JWT is sent in the handshake `auth` field and checked before connection.

## Server → Client

| Event | Payload | Description |
|---|---|---|
| `document:status` | `{ documentId, status, progress }` | Pipeline step changed |
| `document:classified` | `{ documentId, docType, confidence }` | File sorted into place |
| `document:extracted` | `{ documentId, fields }` | Fields ready |
| `findings:updated` | `{ supplierId, findings, trustScore }` | Cross-check rerun |
| `error` | `{ code, message }` | Processing error |

---

# Security

- JWT Authentication (REST and WebSocket handshake)
- Refresh Token Rotation
- Password Hashing using Argon2
- Role-based and organization-scoped guards (users only see their own organization's data or passports shared with them)
- Documents encrypted at rest; files served only through short-lived signed URLs
- Share links are random tokens stored as hashes, revocable and expiring
- File type checks on content, not extension; size and page limits
- Supplier documents are never used to train models
- Audit log for every view, correction and decision
- PDPA review before production
- Helmet
- CORS
- Rate Limiting
- DTO Validation
- SQL Injection Prevention (Prisma)
- XSS Protection
- CSRF Protection (if cookies are used)
- Secure HTTP Headers
- Environment Variables
- Input Sanitization

---

# Clean Code Principles

- SOLID
- DRY
- KISS
- Separation of Concerns
- Repository Pattern
- Dependency Injection
- DTO Layer
- Service Layer
- Controller and Gateway Layer
- Pure, framework-free rules engine
- AI behind one interface (`ExtractionProvider`), so the model can be swapped or mocked

---

# Error Handling

Consistent API Response

```json
{
    "success": false,
    "message": "Document not found",
    "errors": []
}
```

Machine-readable codes, for example `UNSUPPORTED_FILE_TYPE`, `EXTRACTION_FAILED`, `SHARE_LINK_EXPIRED`, `FIELD_CONFIRMATION_REQUIRED`.

---

# Testing

Backend

- Unit Tests (rules engine, name normalization, CIDB grade limits, trust score)
- Extraction tests against recorded model responses (no live AI calls in CI)
- Accuracy check on the fixture documents: expected fields per file
- Integration Tests (pipeline from upload to findings)
- E2E Tests

Frontend

- Component Tests
- Playwright E2E (folder upload, confirm a field, share a passport, buyer approval)

---

# Performance

- Documents processed in parallel by queue workers
- Pages downscaled before sending to the model
- Extraction cached by file hash (same file is never read twice)
- Only affected rules rerun when one document changes
- Pagination
- Indexes on supplier, expiry date and status columns
- Lazy-loaded page images in the document viewer
- Code Splitting

---

# Running

Requires Node 22+ and Docker.

```bash
# 1. Infrastructure: PostgreSQL (:5432), Redis (:6379), MinIO (:9000, only used with STORAGE_DRIVER=s3)
docker compose up -d

# 2. Install (npm workspaces) and build shared packages
npm install
npm run build -w @vp/shared -w @vp/rules

# 3. API env, migrations and demo data
cp apps/api/.env.example apps/api/.env   # set ANTHROPIC_API_KEY
npm run db:migrate          # prisma migrate dev
npm run db:seed             # demo organizations, users and documents (wipes existing data)

# 4. Run
npm run dev:api             # http://localhost:4000/api/v1  (Swagger: http://localhost:4000/docs)
npm run dev:worker          # document processing worker
npm run dev:web             # http://localhost:8888
```

Seed accounts (password `Password123!`):

- `admin@vp.local`
- `supplier@binajaya.local` (supplier: Bina Jaya)
- `buyer@procurement.local` (buyer officer)

## Demo script (about 90 seconds)

1. Sign in as the supplier and drop `fixtures/documents/bina-jaya/` (8 scans and PDFs). Each file sorts itself into place.
2. Open a document: extracted fields are highlighted on the page. The cross-check catches the company name mismatch between the insurance policy and SSM, and the CIDB grade against a tender above its limit.
3. Sign in as the buyer: the trust score ring fills with its reasons; insurance expiring in 23 days shows amber and a reminder goes to the supplier.
4. Back as the supplier, share the passport link; open it in a private window as any other buyer.

All fixture documents are fictional.

## Tests

```bash
npm test -w @vp/rules            # rules engine unit tests
npm test -w @vp/api              # API unit tests (Jest)
npm run test:e2e -w @vp/api      # REST and pipeline e2e against the seeded database
npm test -w @vp/web              # component tests (Vitest)
npx playwright install chromium && npm run test:e2e -w @vp/web
```

## Implementation notes

- Set `AI_PROVIDER=mock` to run the whole app offline with recorded extractions for the fixture documents.
- Uploaded files are stored in the repo-root `uploads/` folder (`STORAGE_DRIVER=local`). Set `STORAGE_DRIVER=s3` to use MinIO or S3 instead.
- `AI_MODEL` and `CONFIDENCE_THRESHOLD` are set in `apps/api/.env`.
- If ports are taken locally, start the containers with `POSTGRES_PORT=5442 docker compose up -d` and update `DATABASE_URL` in `apps/api/.env`.
- Full stack in containers: `docker compose --profile app up --build` (web on :8888, API on :4000).

---

# Roadmap

- Official SSM and CIDB lookups to verify documents against the source (forgery detection)
- News and risk watch on suppliers
- Post-job performance ratings from buyers
- Mobile view for site teams
- Bahasa Malaysia / English interface
- ERP export (SAP Ariba, Coupa)

---

# License

MIT
