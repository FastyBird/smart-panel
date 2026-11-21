import { readFileSync } from 'node:fs';
import path from 'node:path';

import { type Page, type Route, expect, test } from '@playwright/test';

import { mockBackend } from './support/mock-backend';

/*
 * An open device form keeps what was typed when the window crosses the phone/tablet boundary (720 px) in either
 * direction: the layout keeps the routed page mounted and the form keeps the presentation it opened in. A clean
 * form still closes to the Devices list.
 */

const devices = JSON.parse(readFileSync(path.resolve('e2e/fixtures/devices.json'), 'utf8')) as { id: string }[];
const DEVICE = devices[0];

const serveDevice = async (page: Page): Promise<void> => {
	await page.route(
		(url: URL): boolean => url.pathname.endsWith(`/modules/devices/devices/${DEVICE.id}`),
		(route: Route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', data: DEVICE }) })
	);
};

for (const [from, to] of [
	[700, 744],
	[744, 700],
]) {
	test(`edit form keeps its draft from ${from} to ${to} px and a clean form closes to Devices`, async ({ page, baseURL }) => {
		await mockBackend(page, baseURL!, []);
		await serveDevice(page);
		await page.setViewportSize({ width: from, height: 860 });
		await page.goto(`/devices/${DEVICE.id}`);

		const name = page.locator('input[name="name"]');

		await expect(name).toBeVisible({ timeout: 30_000 });
		const original = await name.inputValue();

		await name.fill('Kitchen lamp draft');
		await page.setViewportSize({ width: to, height: 860 });
		await page.waitForTimeout(500);

		await expect(page.locator('input[name="name"]')).toHaveValue('Kitchen lamp draft');
		await expect(page).toHaveURL(new RegExp(`/devices/${DEVICE.id}$`));

		// Back to clean, then close: no prompt, back on the list
		await page.locator('input[name="name"]').fill(original);
		await page.waitForTimeout(300);

		// The form's own Close: the footer's in a drawer, the page header's on a page (the phone bar's left button there)
		const footerClose = page.locator('[data-test-id="form-footer-close"]:visible');
		const headerClose = page.locator('[data-test-id="view-header-back"]:visible');

		if ((await footerClose.count()) > 0) {
			await footerClose.first().click();
		} else if ((await headerClose.count()) > 0) {
			await headerClose.first().click();
		} else {
			await page.locator('[data-test-id="app-bar-left"]').click();
		}

		await expect(page).toHaveURL(/\/devices$/, { timeout: 10_000 });
		await expect(page.locator('.el-message-box')).toHaveCount(0);
	});
}
