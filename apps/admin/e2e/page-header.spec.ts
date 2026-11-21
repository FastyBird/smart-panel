import { expect, test } from '@playwright/test';

import { mockBackend } from './support/mock-backend';

/*
 * Every routed screen has one header (spec § 4, `view-header`): the page header from tablet portrait up, the dark
 * app bar on phone. The backend is answered in the browser (`support/mock-backend.ts`); a screen whose data the mock
 * does not serve still shows its header, which is all this checks.
 */

const ROUTES = [
	'/devices',
	'/channels',
	'/automations',
	'/scenes',
	'/spaces',
	'/displays',
	'/pages',
	'/users',
	'/weather/locations',
	'/notifications',
	'/extensions',
	'/system',
	'/profile',
	'/config',
];

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

for (const route of ROUTES) {
	test(`${route} has a page header above phone width`, async ({ page, baseURL }) => {
		await mockBackend(page, baseURL!, []);
		await page.setViewportSize(DESKTOP);

		await page.goto(route);

		const header = page.locator('[data-test-id="view-header"]').first();

		// The first visit waits for the dev server to compile the screen
		await expect(header).toBeVisible({ timeout: 30_000 });
		await expect(header.locator('h1')).not.toHaveText('');
		await expect(page.locator('[data-test-id="app-bar"]')).toHaveCount(0);
	});

	test(`${route} fills the phone app bar`, async ({ page, baseURL }) => {
		await mockBackend(page, baseURL!, []);
		await page.setViewportSize(PHONE);

		await page.goto(route);

		const bar = page.locator('[data-test-id="app-bar"]');

		await expect(bar.locator('h1')).toBeVisible({ timeout: 30_000 });
		await expect(bar).toHaveCount(1);
		await expect(bar.locator('h1')).not.toHaveText('');
		await expect(page.locator('[data-test-id="view-header"]')).toHaveCount(0);
	});
}
