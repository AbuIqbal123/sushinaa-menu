ALTER TABLE orders ADD COLUMN amended_at TEXT;
CREATE TABLE IF NOT EXISTS order_edits (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  kind TEXT NOT NULL,
  line_id TEXT,
  payload JSON NOT NULL,
  reason_code TEXT NOT NULL,
  note TEXT,
  actor TEXT,
  before_total_minor INTEGER NOT NULL,
  after_total_minor INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS order_edits_append_only_update BEFORE UPDATE ON order_edits BEGIN SELECT RAISE(ABORT, 'order_edits is append-only'); END;
CREATE TRIGGER IF NOT EXISTS order_edits_append_only_delete BEFORE DELETE ON order_edits BEGIN SELECT RAISE(ABORT, 'order_edits is append-only'); END;
CREATE TABLE IF NOT EXISTS order_adjustments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  edit_id TEXT NOT NULL REFERENCES order_edits(id),
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  created_at TEXT NOT NULL,
  settled_at TEXT
);
