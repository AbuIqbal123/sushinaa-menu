import { databaseHost, touchesLiveDatabaseHost } from '@/lib/deploy-env';

export class OrderingUnavailable extends Error {
  constructor() { super('ORDERING_UNAVAILABLE'); }
}
/** Pure guard: no client or connection is constructed to make this decision. */
export function orderDatabaseAllowed(url: string) {
  if (url.startsWith('file:')) return true;
  if (touchesLiveDatabaseHost(url)) return false;
  const host = databaseHost(url);
  return Boolean(host && /^(libsql|https):/i.test(url));
}
export function assertOrderDatabaseAllowed(url: string) {
  if (!orderDatabaseAllowed(url)) throw new OrderingUnavailable();
}
