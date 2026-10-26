ALTER TABLE orders ADD COLUMN printed_at TEXT;
ALTER TABLE orders ADD COLUMN print_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN print_claim_id TEXT;
ALTER TABLE orders ADD COLUMN print_claimed_at TEXT;
CREATE INDEX IF NOT EXISTS orders_branch_printed ON orders(branch_id, printed_at);
