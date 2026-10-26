CREATE TABLE IF NOT EXISTS staff_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  branch_id TEXT,
  auth_version INTEGER NOT NULL DEFAULT 1,
  disabled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS staff_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  auth_version INTEGER NOT NULL,
  expires INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
