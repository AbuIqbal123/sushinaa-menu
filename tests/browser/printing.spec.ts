import { execFileSync } from 'node:child_process';
import { createClient } from '@libsql/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { admin } from './admin';

const shots = '/tmp/sushinaa-phase1-shots';
mkdirSync(shots, { recursive: true });

test.use({ viewport: { width: 390, height: 844 } });

const customer = {
  brand: 'toyota',
  name: 'Test guest',
  phone: '97455551234',
  plate: 'Q123456',
  colour: 'silver',
  car: 'test car',
  instructions: '',
};

async function signIn(page: Page, origin: string) {
  expect((await page.request.post('/api/admin/session', { headers: { Origin: origin }, data: admin })).status()).toBe(200);
}

async function checkout(request: APIRequestContext, origin: string, lines: unknown[]) {
  expect((await request.get('/api/orders')).ok()).toBeTruthy();
  const created = await request.post('/api/orders', {
    headers: { Origin: origin, 'idempotency-key': `print-${Date.now()}-${Math.random().toString(16).slice(2)}` },
    data: { branchId: 'down-town', paymentMethod: 'mock', customer, lines },
  });
  expect(created.status(), await created.text()).toBe(201);
  const order = await created.json();
  const paid = await request.post(`/api/orders/${order.id}/mock-pay`, { headers: { Origin: origin }, data: {} });
  expect(paid.status(), await paid.text()).toBe(200);
  return order.id as string;
}

async function savePdf(page: Page, name: string) {
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ width: '80mm', preferCSSPageSize: true, printBackground: true });
  const file = `${shots}/${name}.pdf`;
  writeFileSync(file, pdf);
  execFileSync('pdftoppm', ['-png', '-r', '144', '-singlefile', file, `${shots}/${name}`]);
}

test('auto-print is off by default and calls window.print once per order', async ({ page, baseURL }) => {
  await page.context().addInitScript(() => {
    window.print = () => {
      const root = window.top as Window & { __prints?: number; __printed?: string[] };
      root.__printed = root.__printed ?? [];
      root.__printed.push(document.documentElement?.innerHTML ?? '');
      root.__prints = (root.__prints ?? 0) + 1;
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  const id = await checkout(page.request, baseURL!, [{
    dishId: 'shrimp-kunafa', selection: {}, quantity: 1, note: '', expectedUnitMinor: 3500,
  }]);
  await signIn(page, baseURL!);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  const card = page.locator(`[data-order-id="${id}"]`);
  await expect(card).toBeVisible();
  await page.getByLabel('Order branch').selectOption('down-town');
  await expect(card).toBeVisible();
  await page.route('**/api/admin/orders?*since=*', (route) => route.abort());
  await expect(page.getByRole('status')).toContainText('Updates paused', { timeout: 20000 });
  await page.screenshot({ path: `${shots}/orders-not-printed-en.png`, fullPage: true });
  await page.unroute('**/api/admin/orders?*since=*');
  await page.locator('summary', { hasText: 'Date & search' }).click();
  await page.getByLabel('Order reference or last 4 phone digits').fill(id);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(card).toBeVisible();
  await expect(card).toContainText('Not printed');
  expect(await page.evaluate(() => (window as Window & { __prints?: number }).__prints ?? 0)).toBe(0);
  await page.getByRole('button', { name: 'Auto-print on this device' }).click();
  const item = page.locator('li').filter({ has: card });
  await expect(item.getByRole('button', { name: 'Reprint' })).toBeVisible({ timeout: 20000 });
  const times = () => page.evaluate((orderId) => {
    const root = window as Window & { __printed?: string[] };
    return (root.__printed ?? []).filter((value) => value.includes(orderId)).length;
  }, id);
  await expect.poll(times, { timeout: 15000 }).toBe(1);
  await page.waitForTimeout(1000);
  expect(await times()).toBe(1);
});

test('staff screen and branch orders in Arabic', async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: 'sushina-lang', value: 'ar', url: baseURL! }]);
  const id = await checkout(page.request, baseURL!, [{
    dishId: 'shrimp-kunafa', selection: {}, quantity: 1, note: '', expectedUnitMinor: 3500,
  }]);
  await signIn(page, baseURL!);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'الموظفون' })).toBeVisible();
  await page.screenshot({ path: `${shots}/staff-ar.png`, fullPage: true });
  await page.getByRole('button', { name: /الطلبات/ }).click();
  await page.getByLabel('فرع الطلب').selectOption('down-town');
  await expect(page.locator(`[data-order-id="${id}"]`)).toContainText('لم تُطبع');
  await page.route('**/api/admin/orders?*since=*', (route) => route.abort());
  await expect(page.getByRole('status')).toContainText('التحديثات متوقفة', { timeout: 20000 });
  await page.screenshot({ path: `${shots}/orders-not-printed-ar.png`, fullPage: true });
});

test('staff screen in English', async ({ page, baseURL }) => {
  await signIn(page, baseURL!);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Staff' })).toBeVisible();
  await page.screenshot({ path: `${shots}/staff-en.png`, fullPage: true });
});

async function openTicket(context: BrowserContext, baseURL: string, id: string) {
  const page = await context.newPage();
  await page.goto(`${baseURL}/cms/orders/${id}/ticket`);
  await expect(page.locator('.ticket-sheet')).toBeVisible();
  return page;
}

test('auto-print works with a status filter, a search or page 2 open', async ({ page, baseURL }) => {
  await page.context().addInitScript(() => {
    window.print = () => {
      const root = window.top as Window & { __printed?: string[] };
      root.__printed = root.__printed ?? [];
      root.__printed.push(document.documentElement?.innerHTML ?? '');
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  const id = await checkout(page.request, baseURL!, [{
    dishId: 'shrimp-kunafa', selection: {}, quantity: 1, note: '', expectedUnitMinor: 3500,
  }]);
  await signIn(page, baseURL!);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await page.getByLabel('Order status').selectOption('collected');
  await page.locator('summary', { hasText: 'Date & search' }).click();
  await page.getByLabel('Order reference or last 4 phone digits').fill('0000');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click({ timeout: 2000 }).catch(() => undefined);
  await page.getByRole('button', { name: 'Auto-print on this device' }).click();
  await expect.poll(() => page.evaluate((orderId) => {
    const root = window as Window & { __printed?: string[] };
    return (root.__printed ?? []).filter((value) => value.includes(orderId)).length;
  }, id), { timeout: 20000 }).toBe(1);
});

test('auto-print retries an order whose claim request failed on the network', async ({ page, baseURL }) => {
  let failed = false;
  await page.context().addInitScript(() => {
    window.print = () => {
      const root = window.top as Window & { __printed?: string[] };
      root.__printed = root.__printed ?? [];
      root.__printed.push(document.documentElement?.innerHTML ?? '');
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  const id = await checkout(page.request, baseURL!, [{
    dishId: 'shrimp-kunafa', selection: {}, quantity: 1, note: '', expectedUnitMinor: 3500,
  }]);
  await page.route(`**/api/staff/orders/${id}/print`, async (route) => {
    if (!failed && route.request().method() === 'POST') {
      failed = true;
      await route.abort();
      return;
    }
    await route.continue();
  });
  await signIn(page, baseURL!);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await page.getByRole('button', { name: 'Auto-print on this device' }).click();
  await expect.poll(() => page.evaluate((orderId) => {
    const root = window as Window & { __printed?: string[] };
    return (root.__printed ?? []).filter((value) => value.includes(orderId)).length;
  }, id), { timeout: 20000 }).toBe(1);
});

test('auto-print queue continues when afterprint never fires', async ({ page, baseURL }) => {
  await page.context().addInitScript(() => {
    window.print = () => {
      const root = window.top as Window & { __printed?: string[] };
      root.__printed = root.__printed ?? [];
      root.__printed.push('printed');
    };
  });
  await page.addInitScript(() => {
    const original = window.setTimeout.bind(window);
    window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]) => original(fn, ms === 60000 ? 200 : ms, ...args)) as typeof setTimeout;
  });
  const first = await checkout(page.request, baseURL!, [{
    dishId: 'shrimp-kunafa', selection: {}, quantity: 1, note: '', expectedUnitMinor: 3500,
  }]);
  const second = await checkout(page.request, baseURL!, [{
    dishId: 'redbull', selection: {}, quantity: 1, note: '', expectedUnitMinor: 1500,
  }]);
  await signIn(page, baseURL!);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await page.getByRole('button', { name: 'Auto-print on this device' }).click();
  await expect.poll(() => page.evaluate(() => ((window as Window & { __printed?: string[] }).__printed ?? []).length), { timeout: 20000 }).toBeGreaterThan(1);
  const done = await page.request.get(`/api/admin/orders?limit=100`);
  const body = await done.json();
  const rows = (body.rows as { id: string; printCount: number }[]).filter((row) => row.id === first || row.id === second);
  expect(rows.every((row) => row.printCount === 0)).toBeTruthy();
});

test('80mm ticket PDF height follows the ticket content', async ({ page, baseURL }) => {
  await signIn(page, baseURL!);
  const shortId = await checkout(page.request, baseURL!, [{
    dishId: 'shrimp-kunafa', selection: {}, quantity: 1, note: '', expectedUnitMinor: 3500,
  }]);
  const longId = await checkout(page.request, baseURL!, [
    { dishId: 'sushinaa-burger', selection: { extras: ['spicy-mayo'] }, quantity: 1, note: 'No sesame on the bun, and please keep the sauce on the side of a very long note', expectedUnitMinor: 5800 },
    { dishId: 'shrimp-kunafa', selection: {}, quantity: 2, note: 'Extra chili', expectedUnitMinor: 3500 },
    { dishId: 'redbull', selection: {}, quantity: 1, note: 'Cold', expectedUnitMinor: 1500 },
  ]);
  const height = async (id: string) => {
    const ticket = await openTicket(page.context(), baseURL!, id);
    await savePdf(ticket, `height-${id}`);
    const info = execFileSync('pdfinfo', [`${shots}/height-${id}.pdf`], { encoding: 'utf8' });
    return Number(/Page size:\s+[\d.]+ x ([\d.]+) pts/.exec(info)?.[1]);
  };
  const short = await height(shortId);
  const long = await height(longId);
  expect(short).toBeLessThan(long);
  expect(short).not.toBeCloseTo(792, 0);
  expect(long).not.toBeCloseTo(792, 0);
});

test('admin can change a user\'s role and branch and reset a password from Settings → Staff', async ({ page, browser, baseURL }) => {
  await signIn(page, baseURL!);
  const username = `branch-${Date.now().toString(36)}`;
  const created = await page.request.post('/api/admin/staff', {
    headers: { Origin: baseURL!, 'content-type': 'application/json' },
    data: { username, password: 'password12', role: 'branch_staff', branchId: 'down-town' },
  });
  expect(created.status(), await created.text()).toBe(201);
  const id = (await created.json()).id as string;
  const other = await browser.newContext();
  const signed = await other.request.post('/api/admin/session', {
    headers: { Origin: baseURL! },
    data: { username, password: 'password12' },
  });
  expect(signed.status()).toBe(200);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const row = page.locator('li').filter({ hasText: username });
  await row.getByRole('button', { name: 'Change role and branch' }).click();
  await row.getByLabel('Change branch').selectOption('al-thumama');
  await row.getByRole('button', { name: 'Save role and branch' }).click();
  await expect(row).toContainText('Al-Thumama');
  await row.getByRole('button', { name: 'Change role and branch' }).click();
  await row.getByLabel('Change role').selectOption('admin');
  await row.getByRole('button', { name: 'Save role and branch' }).click();
  await expect(row).toContainText('Admin');
  await row.getByRole('button', { name: 'Reset password' }).click();
  await row.getByLabel('New password').fill('password13');
  await row.getByRole('button', { name: 'Save password' }).click();
  expect((await other.request.get('/api/admin/session')).status()).toBe(401);
  await other.close();
  void id;
});

test('reopening the orders screen does not auto-print orders paid more than 2 hours ago', async ({ page, baseURL }) => {
  await page.context().addInitScript(() => {
    localStorage.setItem('sushinaa-auto-print', 'true');
    window.print = () => {
      const root = window.top as Window & { __printed?: string[] };
      root.__printed = root.__printed ?? [];
      root.__printed.push(document.documentElement?.innerHTML ?? '');
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  const stale = await checkout(page.request, baseURL!, [{
    dishId: 'shrimp-kunafa', selection: {}, quantity: 1, note: '', expectedUnitMinor: 3500,
  }]);
  const fresh = await checkout(page.request, baseURL!, [{
    dishId: 'redbull', selection: {}, quantity: 1, note: '', expectedUnitMinor: 1500,
  }]);
  const database = process.env.CMS_DATABASE_URL ?? '';
  if (!database.startsWith('file:')) throw new Error('e2e database must be a local file');
  const client = createClient({ url: database });
  await client.execute({
    sql: 'UPDATE orders SET paid_at=?, created_at=? WHERE id=?',
    args: ['2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z', stale],
  });
  client.close();
  await signIn(page, baseURL!);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await expect.poll(() => page.evaluate((orderId) => {
    const root = window as Window & { __printed?: string[] };
    return (root.__printed ?? []).some((value) => value.includes(orderId));
  }, fresh), { timeout: 20000 }).toBeTruthy();
  await page.waitForTimeout(1000);
  expect(await page.evaluate((orderId) => {
    const root = window as Window & { __printed?: string[] };
    return (root.__printed ?? []).some((value) => value.includes(orderId));
  }, stale)).toBeFalsy();
});

test('orders screen shows the paused notice when the server returns 503', async ({ page, baseURL }) => {
  await signIn(page, baseURL!);
  let fail = false;
  await page.route('**/api/admin/orders*', (route) => {
    if (!fail) return route.continue();
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"ORDERING_UNAVAILABLE"}' });
  });
  await page.goto('/admin');
  const ready = page.waitForResponse((response) => response.url().includes('/api/admin/orders') && response.ok());
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await ready;
  fail = true;
  await expect(page.getByRole('status')).toContainText('Updates paused, retrying', { timeout: 20000 });
});

test('80mm tickets for a short order, a long order and a reprint', async ({ page, baseURL }) => {
  await signIn(page, baseURL!);
  const shortId = await checkout(page.request, baseURL!, [{
    dishId: 'shrimp-kunafa', selection: {}, quantity: 1, note: '', expectedUnitMinor: 3500,
  }]);
  const longId = await checkout(page.request, baseURL!, [
    { dishId: 'sushinaa-burger', selection: { extras: ['spicy-mayo'] }, quantity: 1, note: 'No sesame on the bun, and please keep the sauce on the side of a very long note', expectedUnitMinor: 5800 },
    { dishId: 'shrimp-kunafa', selection: {}, quantity: 2, note: 'Extra chili', expectedUnitMinor: 3500 },
    { dishId: 'redbull', selection: {}, quantity: 1, note: 'Cold', expectedUnitMinor: 1500 },
  ]);
  const short = await openTicket(page.context(), baseURL!, shortId);
  await savePdf(short, 'ticket-short');
  const long = await openTicket(page.context(), baseURL!, longId);
  await expect(long.locator('.ticket-sheet')).toContainText('Spicy mayo');
  await expect(long.locator('.ticket-sheet h2')).toHaveCount(3);
  await savePdf(long, 'ticket-long');
  const claim = await page.request.post(`/api/staff/orders/${longId}/print`, {
    headers: { Origin: baseURL!, 'content-type': 'application/json' },
    data: { mode: 'manual' },
  });
  expect(claim.ok(), await claim.text()).toBeTruthy();
  const done = await page.request.post(`/api/staff/orders/${longId}/print/done`, {
    headers: { Origin: baseURL!, 'content-type': 'application/json' },
    data: { claimId: (await claim.json()).claimId },
  });
  expect(done.ok(), await done.text()).toBeTruthy();
  await long.reload();
  await expect(long.locator('.ticket-banner')).toContainText('Reprint 1');
  await savePdf(long, 'ticket-reprint');
});
