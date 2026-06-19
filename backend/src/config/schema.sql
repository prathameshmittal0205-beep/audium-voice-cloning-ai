CREATE TABLE IF NOT EXISTS audium_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audium_generations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES audium_users(id) ON DELETE CASCADE,
  voice_id         TEXT NOT NULL,
  text             TEXT NOT NULL CHECK (char_length(text) <= 500),
  audio_blob_url   TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generations_user_id ON audium_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON audium_generations(created_at DESC);

CREATE TABLE IF NOT EXISTS audium_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES audium_users(id) ON DELETE CASCADE,
  refresh_token  TEXT UNIQUE NOT NULL,
  device_info    TEXT DEFAULT 'unknown',
  ip_address     TEXT DEFAULT 'unknown',
  is_revoked     BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON audium_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON audium_sessions(refresh_token);

CREATE TABLE IF NOT EXISTS audium_voices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES audium_users(id) ON DELETE CASCADE,
  voice_id         TEXT UNIQUE NOT NULL,
  upload_id        TEXT NOT NULL,
  job_id           TEXT,
  is_ready         BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voices_user_id ON audium_voices(user_id);
CREATE INDEX IF NOT EXISTS idx_voices_voice_id ON audium_voices(voice_id);
