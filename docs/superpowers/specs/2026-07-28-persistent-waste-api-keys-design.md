# Persistent Waste API Keys Design

**Goal:** Let authenticated users manage persistent API keys from Profile and use them for existing waste CRUD/upload endpoints with the same business rules as the UI.

## Scope

API keys authenticate only these existing routes:

- `POST /api/upload-file`
- `POST /api/submit-waste`
- `GET|POST|PUT|DELETE /api/items`
- `GET /api/get-day-data`

Keys cannot access users, personnel, tenant configuration, History Input, PDF generation, dashboard administration, or API-key management. API-key access matches current store-wide waste access rather than per-record ownership.

## Persistence and Security

Create an `api_keys` PostgreSQL table linked to `users.id`. Each record stores a name, non-secret prefix, SHA-256 key hash for authentication, AES-256-GCM ciphertext/IV/tag for password-gated reveal, expiry, revocation timestamp, creation timestamp, and last-used timestamp. Raw keys use a recognizable random format and are never stored as plaintext.

`API_KEY_ENCRYPTION_KEY` is a 32-byte production secret supplied through Vercel environment variables. Password verification is required before decrypting and revealing a key. Revoked and expired keys cannot authenticate. A user can have at most five active, unexpired keys.

Expiry choices are 7, 30, 90 days, or no expiry. Revocation is permanent; records remain visible for audit.

## Authentication

Existing JWT Bearer behavior remains unchanged. Waste endpoints use an async authenticator that first validates JWT, then validates an API key hash when the bearer token has the API-key prefix. API-key lookup joins the active owner account, enforcing user status and role at request time. Successful API-key use updates `last_used_at` without blocking the main operation if that timestamp update fails.

API-key management itself requires JWT authentication, never API-key authentication.

## API-Key Management

Reuse `api/admin/[action].ts` under action `api-keys`, preserving the Vercel Hobby function count.

- `GET /api/admin/api-keys`: list current user's masked keys and status.
- `POST /api/admin/api-keys`: create key using name and expiry option.
- `POST /api/admin/api-keys?operation=reveal`: verify password, decrypt one owned key.
- `DELETE /api/admin/api-keys?id=...`: revoke one owned key.

All ownership checks derive user identity from the JWT; client-supplied usernames are ignored.

## Profile UI

Profile gains an API Keys section with create form, expiry selector, active/history list, masked prefix, created/expiry/last-used timestamps, password-gated reveal dialog, copy action, and revoke confirmation. Generated and revealed raw values are held only in component memory and cleared when the dialog closes.

## Waste Validation

API-key calls follow the same server-side validation as JWT calls. Existing UI-only mandatory checks are moved into shared server validation: valid date/shift/station, non-empty products/reasons, positive finite quantities, aligned arrays, QC/manager fields, and duplicate shift/station protection. Image upload stays two-step: upload first, then submit returned proxy URL in documentation fields.

## Error Handling

Invalid, expired, or revoked keys return 401. Out-of-scope routes return 401 because they retain JWT-only authentication. Key limit or duplicate name errors return 409. Invalid payloads return 400 with a specific message. Wrong reveal password returns 403 without exposing whether ciphertext is valid.

## Verification

Add runnable Node assertions for key generation/hash/encryption/decryption, expiry logic, scope authentication, and waste payload validation. Run frontend/API typechecks, focused checks, production build, and verify deployed serverless function count remains at most 12.
