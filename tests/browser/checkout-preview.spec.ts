import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });
for (const lang of ['en', 'ar']) {
  test(`paper ticket, collection details and review are separate screens (${lang})`, async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: 'sushina-lang', value: lang, url: baseURL! }]);
    await page.clock.setFixedTime(new Date('2026-10-23T15:00:00+03:00'));
    await page.goto('/down-town');
    await page.locator('#dish-sushinaa-burger .slide-hit').click();
    await page.locator('.detail-add').click();
    await page.locator('.ticket-close').click();
    await page.locator('.sticky-cta').click();
    await expect(page.locator('.checkout-ticket.ticket')).toBeVisible();
    await expect(page.locator('#collection-name')).toHaveCount(0);
    await expect(page.locator('.checkout-step-action button')).toBeInViewport({ ratio: 1 });
    await page.locator('.checkout-step-action button').click();
    await expect(page.locator('.checkout-ticket')).toHaveCount(0);
    await page.locator('#collection-name').fill('Test guest');
    await page.locator('#collection-phone').fill(lang === 'ar' ? '٥٥٥٥١٢٣٤' : '55551234');
    await page.locator('#collection-plate').fill(lang === 'ar' ? '٠١٢٣' : '0123');
    await expect(page.locator('#collection-phone')).toHaveValue('55551234');
    await expect(page.locator('#collection-plate')).toHaveValue('0123');
    await expect(page.locator('.checkout-step-action button')).toBeEnabled({ timeout: 20000 });
    await page.locator('.checkout-step-action button').click();
    await expect(page.locator('.checkout-ticket.ticket')).toBeVisible();
    await expect(page.locator('.review-details')).toContainText('Test guest');
    await expect(page.locator('#collection-name')).toHaveCount(0);
    await expect(page.locator('.checkout-step-action button')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
