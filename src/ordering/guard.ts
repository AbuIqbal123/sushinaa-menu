import { databaseHost, LIVE_DATABASE_HOST } from '@/lib/deploy-env';

export class OrderingUnavailable extends Error {
  constructor() { super('ORDERING_UNAVAILABLE'); }
}
/** Pure guard: no client or connection is constructed to make this decision. */
export function orderDatabaseAllowed(url: string) {
  if (url.startsWith('file:')) return true;
  const host = databaseHost(url);
  return Boolean(host && host !== LIVE_DATABASE_HOST && /^(libsql|https):/.test(url));
}
export function assertOrderDatabaseAllowed(url: string) {
  if (!orderDatabaseAllowed(url)) throw new OrderingUnavailable();
}
