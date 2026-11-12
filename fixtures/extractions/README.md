# Recorded extractions

One JSON file per fixture document, named `<file name>.json`, matched by the mock extraction provider (`AI_PROVIDER=mock`) **by file name, case-insensitive**. Files without a recording are classified `OTHER` with confidence 0.5.

Shape (`ExtractionRecording` in `@vp/shared`):

```json
{
  "fileName": "04-public-liability-policy.jpg",
  "classification": { "docType": "PUBLIC_LIABILITY", "confidence": 0.94, "reason": "..." },
  "fields": [
    {
      "key": "expiry_date",
      "rawValue": "{{today+23d:dd/MM/yyyy}}",
      "confidence": 0.95,
      "page": 1,
      "bbox": { "x": 0.4194, "y": 0.4288, "width": 0.1168, "height": 0.0192 }
    }
  ]
}
```

- `key` is one of `DOC_TYPE_DEFINITIONS[docType].fields[].key`.
- `rawValue` is the text as printed on the page (what a vision model would read). Normalisation happens later with `normalizeValue` from `@vp/rules`.
- `bbox` is in page fractions (0..1), origin top-left; `page` is 1-based. `null` when the value has no visible source.
- `confidence` below the threshold (0.85) means an officer must confirm the field.

## Date tokens

Date fields may contain a token so the demo is true on any day:

```
{{today}}                     today, ISO (yyyy-MM-dd)
{{today+23d}}                 23 days from today, ISO
{{today-60d:dd/MM/yyyy}}      60 days ago, printed as dd/MM/yyyy
{{today+23d:d MMMM yyyy}}     e.g. 5 December 2026
```

Grammar: `{{today([+-]N)d(:FORMAT)?}}`. Supported formats: `yyyy-MM-dd` (default), `dd/MM/yyyy`, `dd-MM-yyyy`, `d MMMM yyyy`, `dd MMMM yyyy`, `d MMM yyyy`, `dd MMM yyyy`. "Today" is the current **UTC** date. The reference resolver is `fixtures/relative-dates.ts` (`resolveDateTokens`); the API's mock provider implements the same grammar so values match what the seed writes.
