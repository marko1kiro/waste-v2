# PDF and Submission Lock Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the PDF logo and make deletion/duplicate-lock state consistent.

**Architecture:** Keep PDF assets limited to data-referenced images. Use one SQL statement for deletion, serializing same-shift/station operations with an advisory transaction lock before counting rows and removing the submission lock. Check duplicates from the submission-lock table.

**Tech Stack:** TypeScript, Neon serverless PostgreSQL, jsPDF.

---

### Task 1: Regression checks

**Files:**
- Modify: `scripts/check-generate-pdf.ts`
- Create: `scripts/check-submission-locks.ts`

- [ ] Add an assertion that a PDF renders without a logo input.
- [ ] Add a rollback-safe PostgreSQL `DO` regression check for deleting the last station row, clearing its lock, and retaining a lock while rows remain.
- [ ] Run each script; the database check must require `DATABASE_URL` and leave no rows.

### Task 2: PDF logo removal

**Files:**
- Modify: `api/generate-pdf.ts`
- Modify: `api/pdf-renderer.ts`
- Modify: `docs/03-API.md`
- Modify: `docs/07-PDF.md`

- [ ] Remove `/logo.webp` loading and the renderer logo input/drawing.
- [ ] Retain centered title positions without logo reservation.
- [ ] Remove PDF documentation references requiring/rendering a logo.

### Task 3: Lock correctness

**Files:**
- Modify: `api/items.ts`
- Modify: `api/get-day-data.ts`

- [ ] Delete under an advisory transaction lock keyed by deleted date/shift/station, count after deletion in a separate statement, then delete the submission lock only at zero remaining rows.
- [ ] Query `waste_submission_locks` for `isDuplicate`.
- [ ] Run focused checks, both TypeScript checks, and the production build.
