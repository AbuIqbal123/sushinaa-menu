ALTER TABLE orders ADD COLUMN order_number INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS orders_branch_number ON orders(branch_id, order_number);
