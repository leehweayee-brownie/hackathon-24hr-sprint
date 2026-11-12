# Fixtures: fictional demo documents

Everything in this folder is **fictional**. Company names, registration numbers, addresses, policy numbers, people and issuing bodies are invented for the demo and do not refer to real entities.

```bash
npm run fixtures:generate        # regenerate documents + recordings (dates relative to today)
npx tsx fixtures/validate.ts     # check recordings against the doc-type field definitions
npx tsx fixtures/preview.ts bina-jaya 8000000   # what the rules engine will say, without the API
```

Dates are relative to the generation day (UTC), so **re-run the generator on the morning of the demo**: Bina Jaya's insurance then expires in exactly 23 days, as in the README demo script. The recordings use `{{today+23d}}` tokens (see `extractions/README.md`), so the mock extraction provider and the seed stay correct even if you forget.

## `documents/bina-jaya/` (the demo upload: 8 files, drop the whole folder)

| File | What it is | Drives |
|---|---|---|
| `01-ssm-form9.pdf` | SSM Section 17 certificate of incorporation, Bina Jaya Sdn Bhd, 201501023456 (1156789-K), incorporated 15 June 2015 | Reference company name and registration number for every cross-check |
| `02-ssm-einfo-profile.pdf` | SSM e-Info company profile, **2 pages** (particulars, share capital, directors) | Second SSM document of the same company (page handling; duplicate/supersede logic) |
| `03-cidb-certificate.pdf` | CIDB contractor registration, **grade G5**, categories B and CE, valid about 14 more months | **CIDB grade below contract value** against the seeded RM8,000,000 tender (G5 allows up to RM5,000,000), -25 |
| `04-public-liability-policy.jpg` | Scanned policy schedule from "Perisai Takaful Am Berhad"; insured party **Bina Jaya Engineering Sdn Bhd**; limit RM2,000,000; period ends **today + 23 days** | **Company name mismatch** vs SSM, -20; **expiring within 30 days**, -10; reminder to the supplier |
| `05-socso-coverage.pdf` | PERKESO employer coverage certificate, valid to the end of next year; coverage amount printed faintly | **Low-confidence field** `coverage_amount` (0.72) that an officer must confirm, -5 |
| `06-lhdn-tax-clearance.pdf` | LHDN tax compliance letter issued ~2 months ago, valid 12 months | Required document present; registration number consistency (old number 1156789-K) |
| `07-bank-reference.png` | Scanned banker's reference from "Bank Maju Berhad"; "account since" date printed faintly | **Low-confidence field** `account_since` (0.66), -5 |
| `08-iso9001.pdf` | ISO 9001:2015 certificate from "Nusantara Certification Services Sdn Bhd", valid ~2 years | Clean certificate on the expiry timeline |

Expected result against the seeded Package 3B tender (RM8,000,000): **score 35 (red)**, with the five findings above. Confirming the two low-confidence fields raises it to 45; renewing the insurance in the right company name would make it 75.

## `documents/mega-wira/` (seeded as an already-verified supplier)

`mw-01-ssm-form9.pdf`, `mw-02-cidb-certificate.pdf` (G7), `mw-03-public-liability-policy.pdf` (RM5,000,000, valid 10 months), `mw-04-socso-coverage.pdf`, `mw-05-lhdn-tax-clearance.pdf`, `mw-06-iso14001.pdf`. All consistent for Mega Wira Construction Sdn Bhd, 201801034567 (1287654-A). The seed uploads these to storage and processes them, so the buyer sees a **score 100 (green)** passport on first login.

## `documents/misc/`

- `company-brochure.pdf`: a marketing brochure. Classified **OTHER**: kept on file, not scored.
- `unreadable-scan.png`: a blank 64x64 image. Recorded as OTHER with classification confidence 0.15 and no fields, for the "unreadable files are listed, not silently dropped" path.

## How the files are made

`generate.ts` draws each document with `pdf-lib` (PDFs) or as SVG rendered by `sharp` (scans, with paper tint, 0.35 degree skew and film grain). The same layout code records every field's bounding box, so `extractions/<file>.json` always matches the page. `lib/companies.ts` holds the two fictional companies; `lib/docs.ts` holds one function per document type.
