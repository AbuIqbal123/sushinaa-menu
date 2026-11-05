import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { admin } from './admin';

// Run against scripts/seed-operations-demo.ts on an isolated local preview.
test.skip(!process.env.CMS_OPERATIONS_DEMO_TEST, 'Needs the isolated operations demo database.');
async function login(page:Page, origin:string, credentials=admin){
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  expect((await page.request.post('/api/admin/session',{headers:{Origin:origin},data:credentials})).status()).toBe(200);
  // WebKit will not send a Secure localhost cookie over this HTTP test server.
  await page.context().addCookies((await page.context().cookies()).map(cookie=>({...cookie,secure:false})));
  await page.goto('/admin');await page.waitForLoadState('networkidle');expect(errors).toEqual([]);
}
async function navigate(page:Page,name:string){
  if(await page.locator('.ops-mobile-menu').isVisible())await page.locator('.ops-mobile-menu').click();
  await page.locator('.admin-sidebar').getByRole('button',{name,exact:true}).click();
  if(await page.locator('.ops-mobile-menu').isVisible())await expect(page.locator('.admin-sidebar')).toBeHidden();
}
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);}

test('owner dashboard, scoped live workflow, history and private-data-free export',async({page,baseURL},info)=>{
  await page.setViewportSize({width:1440,height:1000});
  expect((await page.request.get('/api/admin/operations')).status()).toBe(401);
  expect((await page.request.get('/api/admin/orders/export')).status()).toBe(401);
  await login(page,baseURL!);
  await expect(page.locator('.ops-live-stage')).toHaveCount(3);
  await expect(page.locator('.ops-branch-row')).toHaveCount(4);
  await expect(page.locator('.ops-popular-row')).toHaveCount(5);
  const all=await (await page.request.get('/api/admin/operations')).json();
  expect(all.counts.active).toBe(24);expect(all.metrics.paidSalesMinor).toBeGreaterThan(0);
  await expect(page.getByText('Demo data',{exact:true})).toBeVisible();
  await noOverflow(page);await page.screenshot({path:info.outputPath('dashboard-desktop.png'),fullPage:true});
  await page.getByLabel('Order branch',{exact:true}).selectOption('down-town');
  await expect(page.locator('.stage-preparing strong')).toHaveText('2');
  await page.locator('.stage-preparing').click();
  await expect(page.locator('.ops-order-card')).toHaveCount(2);
  await page.screenshot({path:info.outputPath('live-orders-desktop.png'),fullPage:true});
  await page.locator('.ops-order-card').first().click();
  await expect(page.locator('.ops-customer-call')).toHaveAttribute('href',/^tel:\+974\d{8}$/);
  await expect(page.locator('.ops-order-detail-pane img').first()).toBeVisible();
  await expect(page.locator('.ops-detail-car .car-brand-logo')).toBeVisible();
  await page.screenshot({path:info.outputPath('order-detail-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Ready',exact:true}).click();
  await expect(page.locator('.ops-order-card')).toHaveCount(1);
  await expect(page.locator('.ops-detail-heading .staff-status')).toHaveText('Ready');
  await navigate(page,'Order history');
  await expect(page.locator('.ops-history-table tbody tr')).toHaveCount(14);
  const csv=await page.request.get(await page.locator('.ops-export').getAttribute('href')??'');
  expect(csv.status()).toBe(200);expect(csv.headers()['content-disposition']).toContain('attachment');
  const body=await csv.text();expect(body).not.toContain('Demo Guest');expect(body).not.toContain('9745555');
  const first=page.locator('.ops-history-table tbody tr').first();const code=(await first.locator('td').first().innerText()).replace('#','');
  await page.getByLabel('Search orders',{exact:true}).fill(code);
  await expect(page.locator('.ops-history-table tbody tr')).toHaveCount(1);
  await page.getByLabel('Search orders',{exact:true}).fill('');
  await expect(page.locator('.ops-history-table tbody tr')).toHaveCount(14);
  await page.screenshot({path:info.outputPath('history-desktop.png'),fullPage:true});
});

test('branch staff can only see and export their own branch',async({page,browser,baseURL})=>{
  await login(page,baseURL!);
  const credentials={username:`ops-${randomUUID().slice(0,12)}`,password:randomUUID()};
  const created=await page.request.post('/api/admin/staff',{headers:{Origin:baseURL!},data:{...credentials,role:'branch_staff',branchId:'down-town'}});
  expect(created.status()).toBe(201);
  const context:BrowserContext=await browser.newContext({baseURL,viewport:{width:1280,height:900}});
  const staff=await context.newPage();await login(staff,baseURL!,credentials);
  await expect(staff.getByLabel('Order branch',{exact:true})).toHaveCount(0);
  await expect(staff.locator('.admin-sidebar').getByRole('button',{name:'Users',exact:true})).toHaveCount(0);
  const data=await (await staff.request.get('/api/admin/operations')).json();
  expect(data.counts.active).toBe(6);expect(data.branches.map((b:{id:string})=>b.id)).toEqual(['down-town']);
  expect((await staff.request.get('/api/admin/operations?branch=west-bay')).status()).toBe(403);
  expect((await staff.request.get('/api/admin/orders/export?branch=west-bay')).status()).toBe(403);
  const orders=await (await staff.request.get('/api/admin/orders?branch=west-bay')).json();
  expect(orders.rows.every((r:{branchId:string})=>r.branchId==='down-town')).toBe(true);
  await context.close();
});

test('Arabic desktop and phone layouts stay usable without horizontal overflow',async({page,baseURL},info)=>{
  await page.context().addCookies([{name:'sushina-lang',value:'ar',url:baseURL!}]);
  await page.setViewportSize({width:1440,height:1000});await login(page,baseURL!);
  await expect(page.locator('.admin-workspace')).toHaveAttribute('dir','rtl');
  await expect(page.locator('.ops-popular-row')).toHaveCount(5);
  await noOverflow(page);await page.screenshot({path:info.outputPath('dashboard-arabic-desktop.png'),fullPage:true});
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});await noOverflow(page);
    await page.screenshot({path:info.outputPath(`dashboard-arabic-${width}.png`),fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  await navigate(page,'الطلبات المباشرة');await expect(page.locator('.ops-order-card')).toHaveCount(24);
  await noOverflow(page);await page.screenshot({path:info.outputPath('live-orders-arabic-phone.png'),fullPage:true});
  await page.locator('.ops-order-card').first().click();await expect(page.locator('.ops-customer-call')).toBeVisible();
  await noOverflow(page);await page.screenshot({path:info.outputPath('order-detail-arabic-phone.png'),fullPage:true});
  await navigate(page,'سجل الطلبات');await expect(page.locator('.ops-history-table tbody tr')).toHaveCount(25);
  await noOverflow(page);await page.screenshot({path:info.outputPath('history-arabic-phone.png'),fullPage:true});
});
