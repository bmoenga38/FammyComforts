---
baseline_commit: 5b7ff59
---

# Story 10.5: PDF and CSV/Excel export

Status: done (client-side; server-side queued PDF deferred)

> **Org-scoped, "Reports" area; exports from on-screen payloads (NFR9).** Part of
> the Epics 7–10 batch built directly from `epics.md` (commit 25912a9).

## What landed

Each report table offers a client-side CSV download (BOM + quoted cells, Excel-friendly) generated from the live query payload. PDF for documents/reports uses the browser print pipeline with the shared `print-doc` print stylesheet (same approach as invoices/receipts in 5.6) — the reports page hides chrome on print. Server-side queued PDF/Excel generation for very large reports remains deferred (gap-listed); current report sizes render client-side without it (NFR9, FR53).

## Verification

Web 72/72 (reports page renders + export controls). Backend 102/102. tsc clean; production build OK.

## File List
- Web: `src/app/(app)/admin/reports/page.tsx` (downloadCsv, window.print, print-doc), `src/app/globals.css` (print rules), `src/app/book/[orgSlug]/invoice/[invoiceId]/page.tsx` (existing print-doc precedent)
