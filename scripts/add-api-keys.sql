CREATE TABLE IF NOT EXISTS api_keys (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id),
    name           TEXT NOT NULL,
    key_prefix     TEXT NOT NULL,
    key_hash       TEXT NOT NULL UNIQUE,
    key_ciphertext TEXT NOT NULL,
    key_iv         TEXT NOT NULL,
    key_tag        TEXT NOT NULL,
    expires_at     TIMESTAMPTZ,
    revoked_at     TIMESTAMPTZ,
    last_used_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_active ON api_keys(user_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_active_name ON api_keys(user_id, name) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS waste_submission_locks (
    business_date DATE NOT NULL,
    shift         TEXT NOT NULL,
    station       TEXT NOT NULL,
    PRIMARY KEY (business_date, shift, station)
);
