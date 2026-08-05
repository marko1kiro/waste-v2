# Persistent Waste API Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add password-revealable, expiring, revocable per-user API keys for existing waste CRUD and upload endpoints.

**Architecture:** PostgreSQL stores API-key hashes for lookup and AES-256-GCM ciphertext for password-gated reveal. Existing waste endpoints accept JWT or API-key Bearer credentials through a dedicated async authenticator; management remains JWT-only inside the existing dynamic admin function so no serverless function is added.

**Tech Stack:** TypeScript, React, Neon PostgreSQL, Node crypto, Zod, Vercel Functions.

---

### Task 1: Database Schema

**Files:**
- Modify: `scripts/init-schema.sql`
- Create: `scripts/add-api-keys.sql`
- Modify: `.env.example`

- [ ] Add `api_keys` with `user_id`, `name`, `key_prefix`, unique `key_hash`, ciphertext fields, `expires_at`, `revoked_at`, `last_used_at`, timestamps, and indexes for hash and owner listing.
- [ ] Add an idempotent production migration using `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
- [ ] Document `API_KEY_ENCRYPTION_KEY` as a base64-encoded 32-byte secret.
- [ ] Execute the migration against the configured Neon database and inspect the resulting columns/indexes.

### Task 2: Key Cryptography and Validation

**Files:**
- Modify: `api/lib.ts`
- Create: `scripts/check-api-key-crypto.ts`

- [ ] Write assertions specifying key prefix/entropy, deterministic SHA-256 hashing, AES-GCM encrypt/decrypt round trip, ciphertext tamper rejection, and expiry calculations for 7/30/90/never.
- [ ] Run `npx tsx scripts/check-api-key-crypto.ts`; verify failure because helpers do not exist.
- [ ] Implement minimal helpers using Node `randomBytes`, `createHash`, `createCipheriv`, and `createDecipheriv`; validate the encryption secret is exactly 32 decoded bytes.
- [ ] Re-run the assertion script; verify all assertions pass.

### Task 3: Dual Waste Authentication

**Files:**
- Modify: `api/lib.ts`
- Modify: `api/upload-file.ts`
- Modify: `api/submit-waste.ts`
- Modify: `api/items.ts`
- Modify: `api/get-day-data.ts`
- Create: `scripts/check-api-key-auth.ts`

- [ ] Write assertions for JWT passthrough, active API-key acceptance, expired/revoked key rejection, inactive-owner rejection, and malformed Bearer rejection using an injected lookup function.
- [ ] Run the auth check; verify it fails because `authenticateWasteRequest` does not exist.
- [ ] Implement async `authenticateWasteRequest`: JWT first, API-key prefix second, hash lookup joined to active user, `last_used_at` update, normalized auth payload.
- [ ] Replace `authenticateRequest` only in the four approved waste routes; leave every other route JWT-only.
- [ ] Re-run auth assertions and `npm run typecheck:api`.

### Task 4: Server-Side Waste Rules

**Files:**
- Modify: `api/lib.ts`
- Modify: `api/submit-waste.ts`
- Modify: `api/items.ts`
- Create: `scripts/check-waste-validation.ts`

- [ ] Write assertions rejecting invalid calendar date, invalid shift/station, missing QC/manager, empty product/reason, non-positive or non-finite quantity, and misaligned arrays; include a valid complete payload.
- [ ] Run the validation check; verify expected failures.
- [ ] Add shared Zod schemas matching the current UI payload contract.
- [ ] Apply schemas to batch submit and item mutations while preserving current response shapes.
- [ ] Enforce duplicate date+shift+station protection server-side before batch insertion.
- [ ] Run validation assertions plus API typecheck.

### Task 5: API-Key Management in Existing Function

**Files:**
- Modify: `api/admin/[action].ts`
- Create: `scripts/check-api-key-management.ts`

- [ ] Write assertions for expiry parsing, maximum five active keys, owned-key filtering, masked output, password-gated reveal, and revoke state transition.
- [ ] Run the management check; verify failure before implementation.
- [ ] Add Zod schemas for create and reveal requests.
- [ ] Add JWT-only `handleApiKeys` supporting list, create, reveal, and revoke; derive owner from JWT username and join `users` for ID/password hash.
- [ ] Add `api-keys` to the existing router switch; do not create an API file.
- [ ] Log create/reveal/revoke actions without raw keys, ciphertext, or password values.
- [ ] Re-run focused assertions and API typecheck.

### Task 6: Profile API-Key UI

**Files:**
- Modify: `src/pages/profile.tsx`

- [ ] Add typed query/mutations for list, create, reveal, and revoke using `/api/admin/api-keys`.
- [ ] Add name and expiry form with 7/30/90/never options and active-key-limit feedback.
- [ ] Add masked active/history cards showing status and timestamps.
- [ ] Add password reveal dialog, copy button, and in-memory raw-key clearing on close.
- [ ] Add revoke confirmation; refresh list after create/revoke.
- [ ] Run `npm run typecheck` and manually inspect responsive layout and keyboard/button labels.

### Task 7: Local Routing and Documentation

**Files:**
- Modify: `scripts/dev-server.ts`
- Modify: `docs/03-API.md`

- [ ] Route `/api/items`, `/api/get`, and `/api/admin/:action` correctly in the local emulator while retaining current routes.
- [ ] Document Bearer API-key use, upload-first flow, waste submit payload, item CRUD examples, expiry/revocation behavior, and errors without including real keys.
- [ ] Verify local OPTIONS/CORS allows `Authorization` and required methods.

### Task 8: End-to-End Verification and Deployment

**Files:**
- No new files.

- [ ] Generate `API_KEY_ENCRYPTION_KEY` securely and set it in Vercel production without printing it into source/logs.
- [ ] Run all focused assertion scripts.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run typecheck:api`.
- [ ] Run `npm run build`.
- [ ] Count default-exporting files under `api/`; verify at most 12 and no new function was introduced.
- [ ] Deploy production.
- [ ] Smoke-test: create key, upload image, submit waste, read it, update it, delete it, reveal with correct password, reject wrong password, revoke key, and confirm revoked key returns 401.
