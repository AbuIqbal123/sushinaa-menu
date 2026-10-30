export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { db } = await import("./cms/db");
    const { assertDatabaseAllowed, assertPaymentProviderAllowed } = await import("./cms/env-guard");
    assertPaymentProviderAllowed();
    await assertDatabaseAllowed(db);
  }
}
