import {test,expect} from '@playwright/test';
import {admin} from './admin';

test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
for (const lang of ['en','ar']) test(`confirmed order can be reopened without changing a new basket (${lang})`,async({page,browser,baseURL},info)=>{
  await page.context().addCookies([{name:'sushina-lang',value:lang,url:baseURL!}]);
  await page.goto('/down-town');
  await page.locator('#dish-sushinaa-burger .slide-hit').click();
  await page.locator('.detail-add').click();await page.locator('.ticket-close').click();
  await page.locator('.sticky-cta').click();
  await page.getByRole('button',{name:lang==='ar'?'اطلب للاستلام':'Order for pickup'}).click();
  await page.locator('#collection-name').fill('Recovery guest');await page.locator('#collection-phone').fill('55551234');await page.locator('#collection-plate').fill('123456');
  await page.locator('#collection-brand').click();await page.locator('#car-brand-dialog input').fill('Toyota');await page.locator('[data-brand-id="toyota"]').click();
  await page.locator('.checkout-step-action button').click();await page.locator('.checkout-step-action button').click();
  const paid=page.waitForResponse(r=>r.url().includes('/mock-pay')&&r.request().method()==='POST');await page.locator('.sadad-pay').click();const id=(await(await paid).json()).id;
  const confirmed=page.locator(`[data-order-id="${id}"]`);
  await expect(confirmed).toContainText('Recovery guest');
  await expect(confirmed.locator('.order-summary')).toContainText(lang==='ar'?'برجر سوشينا':'Sushinaa burger');
  await confirmed.getByRole('button',{name:lang==='ar'?'العودة للقائمة':'Back to menu'}).click();
  const tracker=page.locator('.order-tracker');await expect(tracker).toBeVisible();
  await expect(page.locator('.sticky-cta')).toHaveCount(0);
  await page.screenshot({path:info.outputPath(`tracking-menu-${lang}.png`)});
  // Build a new basket; the confirmed receipt must remain its own immutable order.
  await page.locator('#dish-sushinaa-burger .slide-hit').click();await page.locator('.detail-add').click();await page.locator('.ticket-close').click();
  await expect(page.locator('.sticky-cta')).toBeVisible();
  await tracker.click();await expect(confirmed).toContainText('Recovery guest');await expect(confirmed.locator('.order-summary li')).toHaveCount(1);
  await confirmed.getByRole('button',{name:lang==='ar'?'العودة للقائمة':'Back to menu'}).click();await expect(page.locator('.sticky-cta')).toBeVisible();
  // A fresh tab shares the protected cookie but no sessionStorage or React state.
  const tab=await page.context().newPage();await tab.goto('/west-bay');
  await expect(tab.locator(`[data-order-id="${id}"]`)).toContainText('Recovery guest');
  await expect(tab.locator('.checkout-branch')).toContainText(lang==='ar'?'داون تاون':'Down Town');
  await expect(tab.locator('.order-summary li')).toHaveCount(1);
  const stranger=await browser.newContext({baseURL});
  expect((await stranger.request.get(`/api/orders/${id}`)).status()).toBe(404);await stranger.close();
  const staff=await browser.newContext({baseURL});expect((await staff.request.post('/api/admin/session',{headers:{Origin:baseURL!},data:admin})).status()).toBe(200);
  for(const [expected,to] of [['paid','accepted'],['accepted','preparing'],['preparing','ready']]) {
    expect((await staff.request.post(`/api/admin/orders/${id}/status`,{headers:{Origin:baseURL!},data:{expected,to}})).status()).toBe(200);
  }
  await expect(tab.locator('.order-progress')).toHaveAttribute('data-status','ready',{timeout:12000});
  await tab.reload();await expect(tab.locator('.order-who')).toContainText('Recovery guest');await expect(tab.locator('.order-progress')).toHaveAttribute('data-status','ready');
  await staff.close();await tab.close();
});
