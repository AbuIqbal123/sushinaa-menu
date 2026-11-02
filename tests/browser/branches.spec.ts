import { test, expect, type BrowserContext } from '@playwright/test';
import { admin } from './admin';

// WebKit does not send Secure cookies over the local HTTP test server.
async function localSession(context:BrowserContext){
  const cookies=await context.cookies();
  await context.addCookies(cookies.map(cookie=>({...cookie,secure:false})));
}

for (const lang of ['en','ar'] as const) {
  test(`owner edits and publishes branch settings (${lang})`, async ({page,context,baseURL},testInfo)=>{
    const headers={Origin:baseURL!};
    expect((await page.request.post('/api/admin/session',{headers,data:admin})).status()).toBe(200);
    await localSession(context);
    const original=await (await page.request.get('/api/admin/menu')).json();
    await context.addCookies([{name:'sushina-lang',value:lang,url:baseURL!}]);
    const ar=lang==='ar';
    try {
      await page.goto('/admin');
      await page.getByRole('button',{name:ar?'الفروع':'Branches',exact:true}).click();
      await page.getByLabel(ar?'الاسم بالإنجليزية':'Name in English',{exact:true}).fill('Downtown Test');
      await page.getByLabel(ar?'الاسم بالعربية':'Name in Arabic',{exact:true}).fill('فرع الاختبار');
      await page.getByLabel(ar?'رقم هاتف الفرع':'Branch phone number',{exact:true}).fill('+974 5507 5999');
      await page.getByLabel(ar?'الجمعة وقت الفتح':'Friday opening time',{exact:true}).fill('14:00');
      await page.getByLabel(ar?'الجمعة وقت الإغلاق':'Friday closing time',{exact:true}).fill('02:30');
      const saved=page.waitForResponse(r=>r.url().endsWith('/api/admin/menu')&&r.request().method()==='PUT');
      await page.getByRole('button',{name:ar?'حفظ الفروع':'Save branches',exact:true}).click();
      expect((await saved).status()).toBe(200);
      await expect(page.getByRole('status').filter({hasText:ar?'تم حفظ جميع التغييرات':'All changes saved'})).toBeVisible();
      await page.reload();
      await page.getByRole('button',{name:ar?'الفروع':'Branches',exact:true}).click();
      await expect(page.getByLabel(ar?'الاسم بالإنجليزية':'Name in English',{exact:true})).toHaveValue('Downtown Test');
      await expect(page.getByLabel(ar?'رقم هاتف الفرع':'Branch phone number',{exact:true})).toHaveValue('+97455075999');
      await page.screenshot({path:testInfo.outputPath(`branches-desktop-${lang}.png`),fullPage:true});
      await page.setViewportSize({width:390,height:844});
      await page.screenshot({path:testInfo.outputPath(`branches-mobile-${lang}.png`),fullPage:true});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const published=await (await page.request.get('/api/menu')).json();
      expect(published.menu.branches[0]).toMatchObject({name:'Downtown Test',nameAr:'فرع الاختبار',phone:'+97455075999'});
      expect(published.menu.branches[0].hours[5]).toMatchObject({open:840,close:1590});
      await page.goto('/');
      await expect(page.locator('.bp-name').first()).toHaveText(ar?'فرع الاختبار':'Downtown Test');
      await page.goto('/down-town');
      await expect(page.locator('.branch-switch')).toContainText(ar?'فرع الاختبار':'Downtown Test');
    } finally {
      const latest=await (await page.request.get('/api/admin/menu')).json();
      expect((await page.request.put('/api/admin/menu',{headers,data:{menu:original.menu,revision:latest.revision}})).status()).toBe(200);
    }
  });
}

test('branch staff cannot edit branch settings',async({page,browser,baseURL})=>{
  const headers={Origin:baseURL!};
  await page.request.post('/api/admin/session',{headers,data:admin});
  const username=`branch-test-${Date.now()}`;const password='test-password-only';
  expect((await page.request.post('/api/admin/staff',{headers,data:{username,password,role:'branch_staff',branchId:'down-town'}})).status()).toBe(201);
  const staff=await browser.newContext({baseURL});
  try{
    expect((await staff.request.post('/api/admin/session',{headers,data:{username,password}})).status()).toBe(200);
    await localSession(staff);
    const screen=await staff.newPage();await screen.goto('/admin');
    await expect(screen.getByRole('button',{name:'Orders',exact:true})).toBeVisible();
    await expect(screen.getByRole('button',{name:'Branches',exact:true})).toHaveCount(0);
    expect((await staff.request.put('/api/admin/menu',{headers,data:{}})).status()).toBe(403);
  } finally {await staff.close();}
});
