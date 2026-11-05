/** Shared order/domain HTTP error. Safe for client and server modules. */
export class OrderError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}
