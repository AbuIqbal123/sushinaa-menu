import {test,expect} from '@playwright/test';

test.use({isMobile:true,hasTouch:true});
for (const lang of ['en','ar']) for (const width of [320,390]) {
  test(`category cue and cart actions stay aligned (${lang}, ${width})`, async ({page,baseURL},info)=>{
    await page.setViewportSize({width,height:844});
    await page.context().addCookies([{name:'sushina-lang',value:lang,url:baseURL!}]);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/down-town');
    await page.evaluate(()=>document.fonts.ready);
    const cue=page.locator('.category-discovery');
    await expect(cue).toBeVisible();
    const category=(await page.locator('.category-toggle').boundingBox())!;
    const arrow=(await cue.locator('svg').boundingBox())!;
    const label=(await cue.locator('span').boundingBox())!;
    expect(Math.abs(category.x+category.width/2-arrow.x-arrow.width/2)).toBeLessThan(1);
    expect(label.y).toBeGreaterThanOrEqual(arrow.y+arrow.height);
    const dish=page.locator('#dish-sushinaa-burger');
    const before=await dish.locator('.dish-name,.dish-desc,.slide-cta').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().y));
    await dish.locator('.slide-hit').click();
    await page.locator('.detail-add').click();
    await page.locator('.ticket-close').click();
    const view=page.locator('.sticky-cta');
    await expect(view).toBeVisible();
    await expect(page.locator('.category-discovery')).toHaveCount(0);
    await expect(page.locator('.scroll-gesture')).toBeHidden();
    const after=await dish.locator('.dish-name,.dish-desc,.slide-cta').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().y));
    before.forEach((y,i)=>expect(Math.abs(after[i]-y)).toBeLessThan(1));
    const addBox=(await dish.locator('.slide-cta').boundingBox())!;
    const viewBox=(await view.boundingBox())!;
    expect(Math.abs(addBox.y+addBox.height-viewBox.y-viewBox.height)).toBeLessThan(1);
    if(lang==='ar') expect(viewBox.x+viewBox.width).toBeLessThan(addBox.x-8);
    else expect(viewBox.x).toBeGreaterThan(addBox.x+addBox.width+8);
    await page.screenshot({path:info.outputPath(`actions-${lang}-${width}.png`)});
    await view.click();
    await expect(page.locator('#ticket-title')).toHaveText(lang==='ar'?'طلبك':'Your order');
  });
}
