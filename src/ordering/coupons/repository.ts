import { randomUUID } from 'node:crypto';
import { db, initDb } from '@/cms/db';
import type { DbRow, SqlStatement } from '@/cms/sql';
import { validateManualCode } from './code';
import { applyOrderDiscount, couponOffer } from './discount';
import {
  CouponError,
  isCouponKind,
  isCouponStatus,
  type Coupon,
  type CouponSnapshot,
  type CreateCouponInput,
} from './types';

export const HOLD_TTL_MS = 2 * 60 * 60 * 1000;

const COLUMNS = 'id, code, kind, value, expires_at, status, held_order_id, held_at, redeemed_order_id, redeemed_at, disabled_at, created_at, updated_at';
const REDEEM_ASSIGN = `status='redeemed', redeemed_order_id=?, redeemed_at=?, held_order_id=NULL, held_at=NULL, updated_at=?`;
const RELEASE_ASSIGN = `status='available', held_order_id=NULL, held_at=NULL, updated_at=?`;

type Queryable = {
  execute(statement: SqlStatement): Promise<{ rows: DbRow[]; rowsAffected: number }>;
};

function text(row: DbRow, key: string): string {
  const value = row[key];
  if (typeof value !== 'string' || !value) throw new CouponError('INVALID_VALUE');
  return value;
}

function nullableText(row: DbRow, key: string): string | null {
  const value = row[key];
  if (value == null) return null;
  if (typeof value !== 'string') throw new CouponError('INVALID_VALUE');
  return value;
}

function integer(row: DbRow, key: string): number {
  const value = row[key];
  const number = typeof value === 'bigint' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isInteger(number)) throw new CouponError('INVALID_VALUE');
  return number;
}

function couponFrom(row: DbRow): Coupon {
  const kind = text(row, 'kind');
  const status = text(row, 'status');
  if (!isCouponKind(kind) || !isCouponStatus(status)) throw new CouponError('INVALID_VALUE');
  return {
    id: text(row, 'id'),
    code: text(row, 'code'),
    kind,
    value: integer(row, 'value'),
    expiresAt: text(row, 'expires_at'),
    status,
    heldOrderId: nullableText(row, 'held_order_id'),
    heldAt: nullableText(row, 'held_at'),
    redeemedOrderId: nullableText(row, 'redeemed_order_id'),
    redeemedAt: nullableText(row, 'redeemed_at'),
    disabledAt: nullableText(row, 'disabled_at'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

function expiresAt(raw: string): string {
  if (typeof raw !== 'string' || !raw.trim()) throw new CouponError('EXPIRES_REQUIRED');
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new CouponError('EXPIRES_REQUIRED');
  return parsed.toISOString();
}

function isUnique(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = 'code' in error ? String(error.code) : '';
  return /unique/i.test(code) || /unique constraint failed/i.test(error.message);
}

function rejection(row: Coupon | null, at: string): CouponError {
  if (!row) return new CouponError('NOT_FOUND');
  if (row.status === 'disabled' || row.status === 'redeemed') return new CouponError('UNAVAILABLE');
  if (row.expiresAt <= at) return new CouponError('EXPIRED');
  return new CouponError('UNAVAILABLE');
}

async function readWhere(executor: Queryable, clause: string, args: string[]): Promise<Coupon | null> {
  const row = (await executor.execute({ sql: `SELECT ${COLUMNS} FROM coupons WHERE ${clause}`, args })).rows[0];
  return row ? couponFrom(row) : null;
}

async function releaseHeld(executor: Queryable, now: Date, ttlMs: number, code?: string) {
  const at = now.toISOString();
  const before = new Date(now.getTime() - ttlMs).toISOString();
  const result = await executor.execute({
    sql: `UPDATE coupons SET status='available', held_order_id=NULL, held_at=NULL, updated_at=?
      WHERE status='held' AND held_at IS NOT NULL AND held_at<?${code ? ' AND code=?' : ''}`,
    args: code ? [at, before, code] : [at, before],
  });
  return Number(result.rowsAffected);
}

async function withWrite<T>(run: (tx: Queryable) => Promise<T>): Promise<T> {
  const tx = await db.transaction('write');
  let committed = false;
  try {
    const value = await run(tx);
    await tx.commit();
    committed = true;
    return value;
  } finally {
    if (!committed) await tx.rollback().catch(() => undefined);
    tx.close();
  }
}

export async function createCoupon(input: CreateCouponInput, now = new Date()): Promise<Coupon> {
  await initDb();
  const code = validateManualCode(input.code);
  const offer = couponOffer(input);
  const expiry = expiresAt(input.expiresAt);
  const at = now.toISOString();
  const id = randomUUID();
  try {
    await db.execute({
      sql: `INSERT INTO coupons (
        id, code, kind, value, expires_at, status,
        held_order_id, held_at, redeemed_order_id, redeemed_at, disabled_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'available', NULL, NULL, NULL, NULL, NULL, ?, ?)`,
      args: [id, code, offer.kind, offer.value, expiry, at, at],
    });
  } catch (error) {
    if (isUnique(error)) throw new CouponError('CONFLICT');
    throw error;
  }
  const row = await readWhere(db, 'id=?', [id]);
  if (!row) throw new CouponError('NOT_FOUND');
  return row;
}

export async function listCoupons(): Promise<Coupon[]> {
  await initDb();
  const result = await db.execute(`SELECT ${COLUMNS} FROM coupons ORDER BY created_at DESC, id DESC`);
  return result.rows.map(couponFrom);
}

const UNPAID_ONLINE_ORDER = `paid_at IS NULL AND status='placed' AND payment_method IN ('sadad','mock')`;

export async function releaseHeldCoupon(id: string, now = new Date()): Promise<Coupon> {
  await initDb();
  const at = now.toISOString();
  const purgeAt = new Date(now.getTime() + 90 * 86400000).toISOString();
  return withWrite(async (tx) => {
    const current = await readWhere(tx, 'id=?', [id]);
    if (!current) throw new CouponError('NOT_FOUND');
    if (current.status !== 'held') throw new CouponError('CONFLICT');
    if (current.heldOrderId) {
      const order = (await tx.execute({
        sql: 'SELECT status, paid_at FROM orders WHERE id=?',
        args: [current.heldOrderId],
      })).rows[0];
      const alreadyCancelled = order != null && order.paid_at == null && order.status === 'cancelled';
      if (order && !alreadyCancelled) {
        const cancelled = await tx.execute({
          sql: `UPDATE orders SET status='cancelled', updated_at=?, purge_after=? WHERE id=? AND ${UNPAID_ONLINE_ORDER}`,
          args: [at, purgeAt, current.heldOrderId],
        });
        if (Number(cancelled.rowsAffected) !== 1) throw new CouponError('CONFLICT');
        await tx.execute({
          sql: `UPDATE payment_attempts SET status='cancelled', updated_at=?
            WHERE order_id=? AND status NOT IN ('paid', 'failed', 'cancelled')`,
          args: [at, current.heldOrderId],
        });
      }
    }
    const updated = (await tx.execute({
      sql: `UPDATE coupons SET ${RELEASE_ASSIGN} WHERE id=? AND status='held' RETURNING ${COLUMNS}`,
      args: [at, id],
    })).rows[0];
    if (!updated) throw new CouponError('CONFLICT');
    return couponFrom(updated);
  });
}

export async function disableCoupon(id: string, now = new Date()): Promise<Coupon> {
  await initDb();
  const at = now.toISOString();
  const updated = (await db.execute({
    sql: `UPDATE coupons SET status='disabled', disabled_at=?, updated_at=?
      WHERE id=? AND status='available' RETURNING ${COLUMNS}`,
    args: [at, at, id],
  })).rows[0];
  if (updated) return couponFrom(updated);
  const row = await readWhere(db, 'id=?', [id]);
  if (!row) throw new CouponError('NOT_FOUND');
  if (row.status === 'disabled') return row;
  throw new CouponError('CONFLICT');
}

export async function loadUsableByCode(code: string, now = new Date()): Promise<Coupon> {
  await initDb();
  const normalized = validateManualCode(code);
  const at = now.toISOString();
  await releaseHeld(db, now, HOLD_TTL_MS, normalized);
  const row = await readWhere(db, 'code=?', [normalized]);
  if (!row || row.status !== 'available' || row.expiresAt <= at) throw rejection(row, at);
  return row;
}

export async function previewCoupon(code: string, subtotalMinor: number, now = new Date()) {
  const coupon = await loadUsableByCode(code, now);
  const quote = applyOrderDiscount(subtotalMinor, coupon);
  const snapshot: CouponSnapshot = {
    code: coupon.code,
    kind: coupon.kind,
    value: coupon.value,
    discountMinor: quote.discountMinor,
  };
  return { coupon, ...quote, snapshot };
}

export async function claimCouponOn(executor: Queryable, code: string, orderId: string, now = new Date()): Promise<Coupon> {
  const normalized = validateManualCode(code);
  const at = now.toISOString();
  await releaseHeld(executor, now, HOLD_TTL_MS, normalized);
  const other = (await executor.execute({
    sql: `SELECT code FROM coupons WHERE status='held' AND held_order_id=? AND code<>?`,
    args: [orderId, normalized],
  })).rows[0];
  if (other) throw new CouponError('CONFLICT');
  const claimed = (await executor.execute({
    sql: `UPDATE coupons SET status='held', held_order_id=?, held_at=?, updated_at=?
      WHERE code=? AND status='available' AND expires_at>?
      RETURNING ${COLUMNS}`,
    args: [orderId, at, at, normalized, at],
  })).rows[0];
  if (claimed) return couponFrom(claimed);
  const current = await readWhere(executor, 'code=?', [normalized]);
  if (current?.status === 'held' && current.heldOrderId === orderId) return current;
  throw rejection(current, at);
}

export async function claimCoupon(code: string, orderId: string, now = new Date()): Promise<Coupon> {
  await initDb();
  return withWrite((tx) => claimCouponOn(tx, code, orderId, now));
}

/** Last statement in a paid batch. A missing payment attempt updates zero rows, so this does not read changes(). */
export function redeemHeldCouponStatement(orderId: string, at: string): SqlStatement {
  return {
    sql: `UPDATE coupons SET ${REDEEM_ASSIGN}
      WHERE status='held' AND held_order_id=?
      AND EXISTS (SELECT 1 FROM orders WHERE id=? AND paid_at IS NOT NULL)`,
    args: [orderId, at, at, orderId, orderId],
  };
}

export async function redeemCouponForOrder(orderId: string, now = new Date()): Promise<Coupon> {
  await initDb();
  const at = now.toISOString();
  const updated = (await db.execute({
    sql: `UPDATE coupons SET ${REDEEM_ASSIGN}
      WHERE status='held' AND held_order_id=?
      RETURNING ${COLUMNS}`,
    args: [orderId, at, at, orderId],
  })).rows[0];
  if (updated) return couponFrom(updated);
  const existing = await readWhere(db, `status='redeemed' AND redeemed_order_id=?`, [orderId]);
  if (existing) return existing;
  throw new CouponError('NOT_FOUND');
}

/** A failed status write leaves changes() at 0, so a cancelled batch does not free a code it did not cancel. */
export function releaseCouponStatement(orderId: string, at: string): SqlStatement {
  return {
    sql: `UPDATE coupons SET ${RELEASE_ASSIGN} WHERE status='held' AND held_order_id=? AND changes()=1`,
    args: [at, orderId],
  };
}

export async function releaseCouponForOrder(orderId: string, now = new Date()): Promise<Coupon | null> {
  await initDb();
  const at = now.toISOString();
  const updated = (await db.execute({
    sql: `UPDATE coupons SET ${RELEASE_ASSIGN} WHERE status='held' AND held_order_id=? RETURNING ${COLUMNS}`,
    args: [at, orderId],
  })).rows[0];
  return updated ? couponFrom(updated) : null;
}

export async function releaseStaleHolds(now: Date, ttlMs = HOLD_TTL_MS) {
  await initDb();
  return releaseHeld(db, now, ttlMs);
}
