import { expect, test } from '@playwright/test';

test('marketing page presents the DM and Player experience with real product media', async ({ page }) => {
    await page.goto('/landing.html');

    await expect(page.getByRole('heading', { name: /make the table a stage/i })).toBeVisible();
    await expect(page.locator('.app-window-hero img')).toHaveAttribute('src', /dm-scene-control\.webp$/);
    await expect(page.getByText('DM channel', { exact: true })).toBeVisible();
    await expect(page.getByText('Player channel', { exact: true })).toBeVisible();
    await expect(page.locator('.channel-demo video')).toHaveCount(2);
    await expect(page.locator('.channel-demo video[data-playlist-channel="dm"]')).toHaveAttribute('src', /dm-e2e-scenes-\d{2}-[a-z0-9-]+\.webm$/);
    await expect(page.locator('.channel-demo video[data-playlist-channel="player"]')).toHaveAttribute('src', /player-e2e-scenes-\d{2}-[a-z0-9-]+\.webm$/);
    await expect(page.locator('.tool-directory-links a')).toHaveCount(7);
    await expect(page.getByRole('link', { name: /dice/i })).toHaveAttribute('href', '/feature.html?tool=dice');
    await expect(page.getByRole('link', { name: /initiative/i })).toHaveAttribute('href', '/feature.html?tool=initiative');
    await expect(page.getByRole('link', { name: /chronicle/i })).toHaveAttribute('href', '/feature.html?tool=chronicle');
    await expect(page.getByRole('link', { name: /open dm control/i }).first()).toHaveAttribute('href', '/index.html?mode=dm');
});

test('marketing page remains usable at a narrow viewport and its videos have poster fallbacks', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/landing.html');

    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(horizontalOverflow).toBe(false);
    await page.mouse.wheel(0, 1_000);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    await expect(page.locator('video[poster]')).toHaveCount(4);
    await expect(page.locator('[data-playlist-channel="player"]')).toHaveAttribute('poster', /player-scene-table\.webp$/);
    await expect(page.getByRole('link', { name: /read the guides/i })).toBeVisible();
});

test('feature tours present both channels through their numbered workflow playlist', async ({ page }) => {
    await page.goto('/feature.html?tool=dice');

    await expect(page.getByRole('heading', { name: /let the roll have a stage/i })).toBeVisible();
    await expect(page.getByText('DM channel', { exact: true })).toBeVisible();
    await expect(page.getByText('Player channel', { exact: true })).toBeVisible();
    await expect(page.locator('video[data-paired-playlist="dice"]')).toHaveCount(2);
    await expect(page.locator('video[data-playlist-channel="dm"]')).toHaveAttribute('src', /dm-e2e-dice-01-configure\.webm$/);
    await expect(page.locator('video[data-playlist-channel="player"]')).toHaveAttribute('src', /player-e2e-dice-01-configure\.webm$/);
});
