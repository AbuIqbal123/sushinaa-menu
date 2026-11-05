CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  attempt_id TEXT,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,
  our_status TEXT NOT NULL,
  provider_reference TEXT,
  amount_minor INTEGER,
  raw_digest TEXT,
  recorded_at TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS payment_events_order ON payment_events(order_id, recorded_at);
CREATE INDEX IF NOT EXISTS payment_attempts_order ON payment_attempts(order_id);
