import { test, expect, type Page } from '@playwright/test';
import { admin } from './admin';

test.use({ viewport: { width: 390, height: 844 } });
async function basket(page: Page, lang: string, baseURL: string) {
  await page.context().addCookies([{name:'sushina-lang',value:lang,url:baseURL}]);
  await page.clock.setFixedTime(new Date('2026-10-23T15:00:00+03:00'));
  await page.goto('/down-town');
  await page.locator('#dish-sushinaa-burger .slide-hit').click();
  await page.locator('.detail-sheet textarea').fill('Sauce on the side');
  await page.locator('.detail-add').click();
  await page.locator('.ticket-close').click();
  await page.locator('.sticky-cta').click();
  await expect(page.locator('.checkout-ticket')).toContainText('Sauce on the side');
  await page.locator('.checkout-step-action button').click();
  await page.locator('#collection-name').fill('Test guest');
  await page.locator('#collection-phone').fill(lang === 'ar' ? '٥٥٥٥١٢٣٤' : '55551234');
  await page.locator('#collection-plate').fill(lang === 'ar' ? '٠١٢٣' : '0123');
  await page.locator('.plate-series button').nth(1).click();
  await page.locator('.checkout-step-action button').click();
}
async function signIn(page: Page, origin: string) {
  expect((await page.request.post('/api/admin/session',{headers:{Origin:origin},data:admin})).status()).toBe(200);
  await page.goto('/admin');
}
for (const lang of ['en','ar']) {
  test(`customer mock-pays and staff handles the order (${lang})`, async ({ page, browser, baseURL }, info) => {
    const staffContext = await browser.newContext({viewport:{width:390,height:844},baseURL});
    const staff = await staffContext.newPage();
    await signIn(staff,baseURL!);
    await staff.getByRole('button',{name:'Orders',exact:true}).click();
    await expect(staff.locator('.staff-order-list')).toHaveCount(1);
    await basket(page,lang,baseURL!);
    await page.locator('.checkout-step-action button').click();
    await expect(page.locator('.sadad-pay')).toBeVisible();
    // No editable card data is ever collected.
    await expect(page.locator('.sadad-demo input')).toHaveCount(0);
    const settled = page.waitForResponse(r=>r.url().includes('/mock-pay') && r.request().method()==='POST');
    await page.locator('.sadad-pay').click();
    const response = await settled; expect(response.status()).toBe(200);
    const order = await response.json(); expect(order.paymentStatus).toBe('paid');
    await expect(page.locator('.order-confirmation-reference')).toHaveText(order.id);
    await expect(page.locator('.directions-link')).toBeInViewport({ratio:1});
    await expect(page.locator('.directions-link')).toHaveAttribute('href','https://maps.app.goo.gl/ewbskv1D8Dhts5bHA');
    await expect(page.locator('.checkout-ticket')).toContainText('Sauce on the side');
    await page.screenshot({path:info.outputPath(`confirmation-${lang}.png`),fullPage:true});
    // No reload: the new card arrives from the visible-tab polling loop.
    const card = staff.locator(`[data-order-id="${order.id}"]`);
    await expect(card).toBeVisible({timeout:25000});
    await expect(card).not.toContainText('97455551234');
    await staff.getByLabel('Order branch').selectOption('west-bay');await expect(card).toHaveCount(0);
    await staff.getByLabel('Order branch').selectOption('down-town');
    await staff.getByLabel('Order status').selectOption('received');await expect(card).toBeVisible();
    await card.click();
    await expect(staff.locator('.staff-contact')).not.toContainText('97455551234');
    await staff.getByRole('button',{name:'Show contact',exact:true}).click();
    await expect(staff.locator('.staff-contact')).toContainText('97455551234');
    const activity = await (await staff.request.get('/api/admin/activity?area=orders')).json();
    expect(activity.rows.some((r:{action:string;entityId:string})=>r.action==='order.contact_viewed' && r.entityId===order.id)).toBe(true);
    for(const name of ['Accept order','Preparing','Ready','Collected']) {
      await staff.getByRole('button',{name,exact:true}).click();
      await expect(staff.getByRole('button',{name,exact:true})).toHaveCount(0);
    }
    const final = await (await staff.request.get(`/api/admin/orders/${order.id}`)).json();expect(final.status).toBe('completed');
    expect(final.snapshot.lines[0].note).toBe('Sauce on the side');
    if(lang==='ar') {
      await staff.locator('.staff-tools .lang-btn').click();
      await expect(staff.locator('.staff-orders')).toHaveAttribute('dir','rtl');
      await expect(staff.locator('.staff-detail-head')).toContainText('تم التسليم');
      expect(await staff.locator('.staff-orders').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
      await staff.screenshot({path:info.outputPath('staff-rtl.png'),fullPage:true});
    }
    await staffContext.close();
  });
}

test('pay-at-pickup order needs Mark paid & collected',async({page,browser,baseURL})=>{
  await basket(page,'en',baseURL!);
  await page.getByRole('radio',{name:'Pay at pickup',exact:true}).click();
  await page.locator('.checkout-step-action button').click();
  const id=await page.locator('.order-confirmation-reference').textContent();expect(id).toMatch(/^SU-/);
  const context=await browser.newContext({baseURL,viewport:{width:390,height:844}});const staff=await context.newPage();
  await signIn(staff,baseURL!);await staff.getByRole('button',{name:'Orders',exact:true}).click();
  await staff.locator(`[data-order-id="${id}"]`).click();
  for(const name of ['Accept order','Preparing','Ready']) {await staff.getByRole('button',{name,exact:true}).click();await expect(staff.getByRole('button',{name,exact:true})).toHaveCount(0);}
  const blocked=await staff.request.post(`/api/admin/orders/${id}/status`,{headers:{Origin:baseURL!},data:{to:'completed',expected:'ready'}});expect(blocked.status()).toBe(409);
  await staff.getByRole('button',{name:'Mark paid & collected',exact:true}).click();
  await expect(staff.locator('.staff-detail-head')).toContainText('Collected');
  const detail=await(await staff.request.get(`/api/admin/orders/${id}`)).json();expect(detail.paidAt).toBeTruthy();
  await context.close();
});

test('admin order APIs return 401 when signed out and 403 cross-origin',async({request,baseURL})=>{
  const id='SU-00000000-0000-0000-0000-000000000000';
  for(const path of ['/api/admin/orders',`/api/admin/orders/${id}`]) expect((await request.get(path)).status()).toBe(401);
  expect((await request.post(`/api/admin/orders/${id}/status`,{headers:{Origin:baseURL!},data:{to:'accepted',expected:'placed'}})).status()).toBe(401);
  await request.post('/api/admin/session',{headers:{Origin:baseURL!},data:admin});
  const blocked=await request.post(`/api/admin/orders/${id}/status`,{headers:{Origin:'https://other.example'},data:{to:'accepted',expected:'placed'}});
  expect(blocked.status()).toBe(403);expect(await blocked.json()).toEqual({code:'FORBIDDEN'});
  expect(blocked.headers()['cache-control']).toBe('no-store');
});

test('unread badge and sound preference follow new orders without reloading',async({page,browser,baseURL})=>{
  await signIn(page,baseURL!);
  await page.getByRole('button',{name:'Orders',exact:true}).click();await page.getByRole('button',{name:'Enable sound',exact:true}).click();
  await page.getByRole('button',{name:'Dashboard',exact:true}).click();
  const customer=await browser.newContext({baseURL});const api=customer.request;
  await api.get('/api/orders');
  const menu=(await(await api.get('/api/menu')).json()).menu;
  const dish=menu.dishes.find((d:{kind:{type:string}})=>d.kind.type==='simple');
  const response=await api.post('/api/orders',{headers:{Origin:baseURL!,'Idempotency-Key':crypto.randomUUID()},data:{branchId:'down-town',paymentMethod:'pay_at_pickup',customer:{name:'Test',phone:'55551234',plate:'Q123'},lines:[{dishId:dish.id,selection:{},quantity:1,note:'',expectedUnitMinor:dish.kind.priceQar*100}]}});
  expect(response.status()).toBe(201);
  await expect(page.locator('.staff-unread')).toBeVisible({timeout:25000});
  await page.getByRole('button',{name:/^Orders/}).click();await expect(page.locator('.staff-unread')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Sound on',exact:true})).toHaveAttribute('aria-pressed','true');
  await customer.close();
});
