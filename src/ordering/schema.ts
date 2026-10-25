// Keep identical to db/migrations/0002_orders.sql. Bootstrap is guarded in initDb.
export const ORDER_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed',
  payment_method TEXT NOT NULL DEFAULT 'mock',
  paid_at TEXT,
  session_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  total_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'QAR',
  customer_name TEXT, customer_phone TEXT, car_plate TEXT,
  car_colour TEXT, car_model TEXT, instructions TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, purge_after TEXT,
  UNIQUE(session_hash, idempotency_key)
)`,
  `CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at DESC, id DESC)`,
  `CREATE TABLE IF NOT EXISTS payment_attempts (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), provider TEXT NOT NULL, reference TEXT UNIQUE, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS order_events (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), provider_event TEXT UNIQUE, type TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS order_outbox (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), event TEXT NOT NULL, created_at TEXT NOT NULL, delivered_at TEXT, UNIQUE(order_id,event))`
];

export const ORDER_NUMBER_SQL = [
  `ALTER TABLE orders ADD COLUMN order_number INTEGER`,
  `CREATE UNIQUE INDEX IF NOT EXISTS orders_branch_number ON orders(branch_id, order_number)`,
];

export const STAFF_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS staff_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  branch_id TEXT,
  auth_version INTEGER NOT NULL DEFAULT 1,
  disabled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS staff_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  auth_version INTEGER NOT NULL,
  expires INTEGER NOT NULL,
  created_at TEXT NOT NULL
)`,
];

export const PRINT_SQL = [
  `ALTER TABLE orders ADD COLUMN printed_at TEXT`,
  `ALTER TABLE orders ADD COLUMN print_count INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE orders ADD COLUMN print_claim_id TEXT`,
  `ALTER TABLE orders ADD COLUMN print_claimed_at TEXT`,
  `CREATE INDEX IF NOT EXISTS orders_branch_printed ON orders(branch_id, printed_at)`,
];
