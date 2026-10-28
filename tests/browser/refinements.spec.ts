import { writeFileSync } from 'node:fs';
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { admin } from './admin';

test.use({ viewport: { width: 390, height: 844 } });
const headers = (origin: string) => ({ Origin: origin });
async function login(request: APIRequestContext, origin: string) {
  const response = await request.post('/api/admin/session', { headers: headers(origin), data: admin });
  expect(response.status(), await response.text()).toBe(200);
}
async function order(request: APIRequestContext, origin: string, long = false) {
  await request.get('/api/orders');
  const response = await request.post('/api/orders', { headers: { ...headers(origin), 'Idempotency-Key': crypto.randomUUID() }, data: {
    branchId: 'down-town', paymentMethod: 'mock', customer: { name: 'Preview guest', phone: '55551234', plate: 'Q123456' },
    lines: long ? [
      { dishId: 'sushinaa-burger', selection: { extras: ['spicy-mayo'] }, quantity: 2, note: 'Sauce on the side · الصوص على الجانب', expectedUnitMinor: 5800 },
      { dishId: 'shrimp-kunafa', selection: {}, quantity: 1, note: 'No sesame', expectedUnitMinor: 3500 },
      { dishId: 'redbull', selection: {}, quantity: 1, note: '', expectedUnitMinor: 1500 },
    ] : [{ dishId: 'shrimp-kunafa', selection: {}, quantity: 1, note: 'No sesame', expectedUnitMinor: 3500 }],
  } });
  expect(response.status(), await response.text()).toBe(201);
  const created = await response.json();
  expect((await request.post(`/api/orders/${created.id}/mock-pay`, { headers: headers(origin), data: {} })).status()).toBe(200);
  return created.id as string;
}
async function status(request: APIRequestContext, origin: string, id: string, expected: string, to: string) {
  const result = await request.post(`/api/admin/orders/${id}/status`, { headers: headers(origin), data: { expected, to } });
  expect(result.status(), await result.text()).toBe(200);
}
async function fitLanguageButton(page: Page) {
  const fit = await page.locator('.ordering-header .lang-btn').evaluate(button => {
    const outer = button.getBoundingClientRect(); const inner = button.querySelector('span')!.getBoundingClientRect();
    return inner.left >= outer.left + 8 && inner.right <= outer.right - 8 && outer.height >= 44;
  });
  expect(fit).toBe(true);
}

for (const lang of ['en', 'ar']) test(`customer sees staff readiness live, including after refresh (${lang})`, async ({page,browser,baseURL}, info) => {
  await page.context().addCookies([{name:'sushina-lang',value:lang,url:baseURL!}]);
  await page.goto('/down-town');
  await page.locator('#dish-sushinaa-burger .slide-hit').click();
  await page.locator('.detail-add').click(); await page.locator('.ticket-close').click();
  await page.locator('.sticky-cta').click();
  await page.getByRole('button',{name:lang === 'ar' ? 'اطلب للاستلام' : 'Order for pickup'}).click();
  await fitLanguageButton(page);
  if(lang === 'ar') await expect(page.locator('.ordering-header .lang-btn')).toHaveText('English');
  await page.locator('#collection-name').fill('Preview guest');
  await page.locator('#collection-phone').fill('55551234'); await page.locator('#collection-plate').fill('123456');
  await page.locator('.checkout-step-action button').click(); await page.locator('.checkout-step-action button').click();
  const paid = page.waitForResponse(r=>r.url().includes('/mock-pay') && r.request().method()==='POST');
  await page.locator('.sadad-pay').click(); const id=(await (await paid).json()).id as string;
  await expect(page.locator('.order-progress')).toHaveAttribute('data-status','paid');
  const staff=await browser.newContext({baseURL}); await login(staff.request,baseURL!);
  await status(staff.request,baseURL!,id,'paid','accepted'); await status(staff.request,baseURL!,id,'accepted','preparing');
  await expect(page.locator('.order-progress')).toHaveAttribute('data-status','preparing',{timeout:10000});
  await status(staff.request,baseURL!,id,'preparing','ready');
  await expect(page.locator('.order-progress h2')).toHaveText(lang === 'ar' ? 'طلبك جاهز' : 'Your order is ready',{timeout:10000});
  await expect(page.locator('.directions-link')).toBeInViewport({ratio:1});
  await page.screenshot({path:info.outputPath(`ready-${lang}.png`),fullPage:true});
  await page.reload(); await expect(page.locator('.order-progress')).toHaveAttribute('data-status','ready');
  await status(staff.request,baseURL!,id,'ready','completed');
  await expect(page.locator('.order-progress')).toHaveAttribute('data-status','completed',{timeout:10000});
  await staff.close();
});

test('sound is enabled by default, can be muted, and remembers the mute', async ({page,baseURL})=>{
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    (window as Window & { __chimes?: number }).__chimes = 0;
    HTMLMediaElement.prototype.play = function() {
      const root = window as Window & { __chimes?: number };
      if(!this.muted) root.__chimes = (root.__chimes ?? 0) + 1;
      return play.call(this).catch(()=>undefined);
    };
  });
  await login(page.request,baseURL!); await page.goto('/admin'); await page.getByRole('button',{name:'Orders',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sound on',exact:true})).toHaveAttribute('aria-pressed','true');
  // Complete the baseline poll before creating an order in a separate customer session.
  await page.waitForTimeout(500);
  const customer=await page.context().browser()!.newContext({baseURL});
  await order(customer.request,baseURL!);
  await expect.poll(()=>page.evaluate(()=>(window as Window & { __chimes?: number }).__chimes ?? 0),{timeout:22000}).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Sound on',exact:true}).click();
  await expect(page.getByRole('button',{name:'Enable sound',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.reload(); await page.getByRole('button',{name:'Orders',exact:true}).click();
  await expect(page.getByRole('button',{name:'Enable sound',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Enable sound',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sound on',exact:true})).toHaveAttribute('aria-pressed','true');
  await customer.close();
});

test('CMS printouts use the branded full-width receipt and content-sized 80mm paper',async({page,baseURL},info)=>{
  const shortId=await order(page.request,baseURL!); const longId=await order(page.request,baseURL!,true);
  await login(page.request,baseURL!);
  const heights: number[]=[];
  for(const [id,kind] of [[shortId,'short'],[longId,'long']] as const) {
    await page.goto(`/cms/orders/${id}/ticket`);
    await page.evaluate(async()=>{await document.fonts.ready; await Promise.all(Array.from(document.images).map(img=>img.decode()));});
    await expect(page.locator('.thermal-logo')).toBeVisible();
    await expect(page.locator('.ticket-sheet')).toContainText('Sushinaa Restaurant');
    await expect(page.locator('.thermal-columns')).toContainText('Amount');
    await expect(page.locator('.ticket-sheet')).toContainText('Q123456');
    await expect(page.locator('.thermal-barcode')).toBeVisible();
    const box=await page.locator('.ticket-sheet').boundingBox(); expect(box!.width).toBeCloseTo(80*96/25.4,0);
    expect(await page.locator('.ticket-sheet').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
    await page.emulateMedia({media:'print'});
    const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});
    writeFileSync(info.outputPath(`receipt-${kind}.pdf`),pdf);
    const source=pdf.toString('latin1');
    expect((source.match(/\/Type\s*\/Page\b/g)||[]).length).toBe(1);
    const media=/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/.exec(source)!;
    expect(Number(media[1])).toBeCloseTo(80*72/25.4,0); heights.push(Number(media[2]));
    expect(Number(media[2])).toBeLessThan(box!.height*72/96+15);
    await page.screenshot({path:info.outputPath(`receipt-${kind}.png`),fullPage:true});
  }
  expect(heights[1]).toBeGreaterThan(heights[0]);
  await page.goto(`/cms/orders/${longId}/receipt`);
  await expect(page.locator('.thermal-logo')).toBeVisible();
  await expect(page.locator('.ticket-sheet')).toContainText('Sauce on the side');
  await expect(page.locator('.thermal-amount').first()).toHaveText('116.00');
  await page.screenshot({path:info.outputPath('customer-receipt.png'),fullPage:true});
});

test('CMS Print ticket waits for receipt assets and prints the isolated 80mm document',async({page,baseURL})=>{
  await page.context().addInitScript(()=>{
    window.print=()=>{
      const root=window.top as Window & {__receiptPrint?: {logo:boolean;fonts:string;page:string;markup:string}};
      const img=document.querySelector<HTMLImageElement>('.thermal-logo');
      root.__receiptPrint={logo:!!img?.complete && img.naturalWidth>0, fonts:document.fonts.status, page:document.querySelector('#ticket-page-size')?.textContent||'', markup:document.body.innerHTML};
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  const id=await order(page.request,baseURL!);
  await login(page.request,baseURL!); await page.goto('/admin');
  await page.getByRole('button',{name:'Orders',exact:true}).click();
  await page.locator(`[data-order-id="${id}"]`).click();
  await page.getByRole('button',{name:'Print ticket',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as Window & {__receiptPrint?:unknown}).__receiptPrint)).toBeTruthy();
  const printed=await page.evaluate(()=>(window as Window & {__receiptPrint?: {logo:boolean;fonts:string;page:string;markup:string}}).__receiptPrint!);
  expect(printed.logo).toBe(true);expect(printed.fonts).toBe('loaded');expect(printed.page).toMatch(/size:80mm \d+mm/);
  expect(printed.markup).toContain('Sushinaa Restaurant');expect(printed.markup).toContain('AMOUNT DUE');
  expect(printed.markup).not.toContain('self.__next_f.push');
  await expect.poll(async()=> (await(await page.request.get(`/api/admin/orders/${id}`)).json()).printCount).toBe(1);
});
