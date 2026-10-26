import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
const cookie = 'sushinaa-order-session';
export async function orderSession(create = false) {
  const jar = await cookies();
  const token = jar.get(cookie)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) return token;
  if (!create) return null;
  const fresh = randomBytes(32).toString('hex');
  jar.set(cookie, fresh, { httpOnly: true, sameSite: 'strict', secure: Boolean(process.env.VERCEL), path: '/api/orders', maxAge: 86400 });
  return fresh;
}
