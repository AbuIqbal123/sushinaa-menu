import {test, expect} from '@playwright/test';
for (const lang of ['en', 'ar']) for (const [width, height] of [[320,568], [375,667], [390,844]]) {
  test(`categories fit ${width}x${height} in ${lang}`, async ({page, baseURL}, info) => {
    await page.setViewportSize({width, height});
    await page.context().addCookies([{name:'sushina-lang', value:lang, url:baseURL!}]);
    await page.goto('/down-town');
    await page.locator('.category-toggle').click();
    const overlay = page.locator('#category-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('.category-tile')).toHaveCount(14);
    for (const tile of await overlay.locator('.category-tile').all()) await expect(tile).toBeInViewport({ratio:1});
    expect(await overlay.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    await page.screenshot({path:info.outputPath(`categories-${lang}-${width}.png`)});
  });
}
