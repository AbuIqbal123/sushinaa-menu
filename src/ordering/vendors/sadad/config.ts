export type SadadConfig = {
  secretKey: string;
  merchantId: string;
  publicOrigin: string;
  website: string;
  callbackUrl: string;
};

function trim(value: string | undefined) {
  return value?.trim() || '';
}

/** True when all required Sadad env vars are present (no secrets logged). */
export function sadadConfigComplete() {
  return Boolean(
    trim(process.env.SADAD_SECRET_KEY)
    && trim(process.env.SADAD_MERCHANT_ID)
    && trim(process.env.SADAD_PUBLIC_ORIGIN),
  );
}

export function loadSadadConfig(): SadadConfig {
  const secretKey = trim(process.env.SADAD_SECRET_KEY);
  const merchantId = trim(process.env.SADAD_MERCHANT_ID);
  const publicOrigin = trim(process.env.SADAD_PUBLIC_ORIGIN).replace(/\/$/, '');
  if (!secretKey || !merchantId || !publicOrigin) {
    throw new Error('Sadad configuration is incomplete');
  }
  let website: string;
  try {
    website = new URL(publicOrigin).hostname;
  } catch {
    throw new Error('Sadad public origin is invalid');
  }
  if (!website) throw new Error('Sadad public origin is invalid');
  return {
    secretKey,
    merchantId,
    publicOrigin,
    website,
    callbackUrl: `${publicOrigin}/api/payments/callback`,
  };
}
