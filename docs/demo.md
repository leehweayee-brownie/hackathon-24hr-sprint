# Demo runbook (about 90 seconds)

Before the demo: `npm run fixtures:generate && npm run db:seed` on the morning of the demo so "expires in 23 days" is true. Keep `AI_PROVIDER=mock` as the fallback; switch to `anthropic` only if the live model has been exercised on the fixtures in the last hour.

| Step | Screen | Say |
|---|---|---|
| 1 | Login as `supplier@binajaya.local`, open Documents, drop `fixtures/documents/bina-jaya/` | "Eight messy scans and PDFs. Watch each one sort itself." |
| 2 | Click the public liability policy | "Every value points back to where it was read. The cross-check already caught that the insurer wrote *Bina Jaya Engineering* while SSM says *Bina Jaya*." |
| 3 | Login as `buyer@procurement.local`, open the Package 3B check | "RM8 million tender, G5 contractor: the grade stops at RM5 million. Insurance runs out in 23 days. Score 35, every point explained." Confirm the two low-confidence fields and watch it rise to 45. |
| 4 | Back as supplier, Passport, create a share link, open it in a private window | "One passport, always current, shared by link. The supplier sees who looked and when." |

Fallbacks:
- Files stuck in Processing: check the API log; `GET /api/v1/admin/queue` shows counts. Restarting the API resumes documents left in progress.
- Upload fails on stage: Mega Wira (`supplier@megawira.local`) is pre-processed; its passport and check are fully populated.
- Model slow or rate limited: set `AI_PROVIDER=mock` in `apps/api/.env` and restart the API.
- Backup video recorded at the feature freeze.
