import { test, expect } from '@playwright/test';

test.use({isMobile:true,hasTouch:true,deviceScaleFactor:3});

for (const lang of ['en', 'ar']) for (const width of [320, 375, 390, 430]) {
  test(`menu navigation stays readable at ${width}px in ${lang}`, async ({page, baseURL}, info) => {
    await page.setViewportSize({width,height:844});
    await page.context().addCookies([{name:'sushina-lang',value:lang,url:baseURL!}]);
    await page.goto('/down-town');
    await expect(page.locator('.category-discovery')).toBeVisible();
    await expect(page.locator('.category-discovery')).toHaveCSS('white-space','nowrap');
    await expect(page.locator('.filter-bar')).toHaveCount(0);
    await expect(page.locator('.chrome-header .chip-diet')).toHaveCount(0);
    const layout = await page.locator('.chrome-header').evaluate(header => {
      const logo = header.querySelector('.wordmark-img')!.getBoundingClientRect();
      const brand = header.querySelector('.brand-mark')!.getBoundingClientRect();
      const actions = header.querySelector('.chrome-actions')!.getBoundingClientRect();
      const category = header.querySelector('.category-toggle')!.getBoundingClientRect();
      const controls = Array.from(header.querySelectorAll('.chrome-actions > button, .search-toggle')).map(b=>b.getBoundingClientRect());
      const branch = header.querySelector('.branch-switch')!;
      return {logoHeight:logo.height,font:parseFloat(getComputedStyle(branch).fontSize),overlap:Math.min(brand.right,actions.right)-Math.max(brand.left,actions.left),overflow:document.documentElement.scrollWidth>window.innerWidth, alignment:Math.max(...[category,...controls].map(r=>Math.abs(r.top+r.height/2-(logo.top+logo.height/2))))};
    });
    expect(layout.logoHeight).toBeGreaterThanOrEqual(52);
    expect(layout.font).toBeGreaterThanOrEqual(22);
    expect(layout.alignment).toBeLessThan(1);
    await page.screenshot({path:info.outputPath(`header-${lang}-${width}.png`)});
    expect(layout.overlap).toBeLessThanOrEqual(0);
    expect(layout.overflow).toBe(false);
    await page.locator('.category-toggle').click();
    const overlay = page.locator('#category-overlay');
    await expect(overlay).toBeVisible();
    const filter = overlay.locator('.chip-diet').nth(1);
    const filterName = await filter.textContent();
    await filter.click();
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('.chip-on')).toHaveText(filterName!);
    await overlay.locator('.category-tile:not(:disabled)').last().click();
    await expect(overlay).not.toBeVisible();
    await expect(page.locator('.category-toggle')).toBeFocused();
    const feed = page.locator('.feed');
    await feed.evaluate(f=>f.scrollBy(0,f.clientHeight));
    await page.locator('.category-toggle').click();
    await expect(overlay.locator('.chip-on')).toHaveText(filterName!);
    await overlay.locator('.chip-diet').first().click();
    await page.keyboard.press('Escape');
    await page.locator('.search-toggle').click();
    await page.locator('#menu-search').fill('shrimp');
    await expect(page.locator('.search-result').first()).toBeVisible();
    await page.screenshot({path:info.outputPath(`search-${lang}-${width}.png`)});
  });
}

test('opening flick moves the hand upward, then the menu settles and hints fade', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{
    (window as unknown as {peek:number[]}).peek=[];
    (window as unknown as {handY:number[]}).handY=[];
    (window as unknown as {gestureFrames:{angle:number;difference:number}[]}).gestureFrames=[];
    const recordHand = () => {
      const hand = document.querySelector<HTMLElement>('.scroll-gesture');
      const hint = document.querySelector<HTMLElement>('.category-discovery');
      if (hand && !hand.hidden && hint && parseFloat(getComputedStyle(hand).opacity) > .2) {
        (window as unknown as {handY:number[]}).handY.push(hand.getBoundingClientRect().top);
        const transform = getComputedStyle(hand.querySelector('.scroll-gesture-hand')!).transform;
        const matrix = new DOMMatrix(transform);
        (window as unknown as {gestureFrames:{angle:number;difference:number}[]}).gestureFrames.push({
          angle:Math.atan2(matrix.b,matrix.a)*180/Math.PI,
          difference:Math.abs(parseFloat(hand.style.opacity)-parseFloat(hint.style.opacity)),
        });
      }
      requestAnimationFrame(recordHand);
    };
    requestAnimationFrame(recordHand);
    document.addEventListener('scroll',e=>{
      if((e.target as HTMLElement)?.classList?.contains('feed')) (window as unknown as {peek:number[]}).peek.push((e.target as HTMLElement).scrollTop);
    },true);
  });
  await page.goto('/down-town');
  const feed=page.locator('.feed');
  await expect(feed.locator('.is-active')).toBeInViewport();
  await expect(page.locator('.scroll-gesture')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>{
    const f=document.querySelector('.feed')!; const samples=(window as unknown as {peek:number[]}).peek;
    return Math.max(...samples)-Math.min(...samples) > f.clientHeight*.2;
  })).toBe(true);
  await expect.poll(()=>feed.evaluate(f=>f.style.scrollSnapType),{timeout:8000}).toBe('');
  expect(await feed.evaluate(f=>Math.abs(f.scrollTop/f.clientHeight-Math.round(f.scrollTop/f.clientHeight)))).toBeLessThan(.01);
  await expect(page.locator('.category-discovery')).toHaveCount(0,{timeout:8000});
  await expect(page.locator('.swipe-hint')).toHaveCount(0);
  await expect(page.locator('.scroll-gesture')).toBeHidden();
  const positions = await page.evaluate(()=>(window as unknown as {handY:number[]}).handY);
  const frames = await page.evaluate(()=>(window as unknown as {gestureFrames:{angle:number;difference:number}[]}).gestureFrames);
  expect(frames[0].angle).toBeCloseTo(-120,0);
  expect(frames.at(-1)!.angle).toBeCloseTo(-30,0);
  expect(Math.max(...frames.map(f=>f.difference))).toBeLessThan(.01);
  expect(positions.length).toBeGreaterThan(3);
  expect(positions[0] - positions.at(-1)!).toBeGreaterThan(160);
  for (let i=1;i<positions.length;i++) expect(positions[i]-positions[i-1]).toBeLessThanOrEqual(.5);
});

test('opening peek respects reduced motion and never interrupts interaction', async ({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/down-town');
  const feed=page.locator('.feed');
  await expect(feed.locator('.is-active')).toBeInViewport();
  const initial=await feed.evaluate(f=>f.scrollTop);
  await page.waitForTimeout(2800);
  expect(await feed.evaluate(f=>f.scrollTop)).toBe(initial);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.reload();
  await feed.dispatchEvent('pointerdown');
  await feed.evaluate(f=>f.scrollBy(0,f.clientHeight));
  await expect.poll(()=>feed.evaluate(f=>f.style.scrollSnapType),{timeout:8000}).toBe('');
  const moved=await feed.evaluate(f=>f.scrollTop);
  await page.waitForTimeout(2800);
  expect(await feed.evaluate(f=>f.scrollTop)).toBe(moved);
});
