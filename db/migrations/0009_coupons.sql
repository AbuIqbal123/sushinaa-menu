CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('percent', 'amount')),
  value INTEGER NOT NULL CHECK ((kind = 'percent' AND value BETWEEN 1 AND 99) OR (kind = 'amount' AND value >= 1)),
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'held', 'redeemed', 'disabled')),
  held_order_id TEXT,
  held_at TEXT,
  redeemed_order_id TEXT,
  redeemed_at TEXT,
  disabled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS coupons_status_expires ON coupons(status, expires_at);
