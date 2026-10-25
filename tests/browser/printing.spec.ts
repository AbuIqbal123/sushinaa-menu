import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { admin } from './admin';

const shots = '/tmp/sushinaa-phase1-shots';
mkdirSync(shots, { recursive: true });

test.use({ viewport: { width: 390, height: 844 } });

const customer = {
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
  await page.screenshot({ path: `${shots}/orders-not-printed-en.png`, fullPage: true });
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
