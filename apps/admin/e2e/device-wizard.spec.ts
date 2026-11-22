import { expect, test } from '@playwright/test';

import { mockBackend } from './support/mock-backend';
import { serveShellyDiscovery } from './support/shelly-discovery';

/*
 * The device wizard: the Wizard button opens the picker over the Devices list, and a discovery wizard runs Discover →
 * Select → Confirm → Results in the shared wizard shell. A device that fails to be added is retried on its own.
 */

// The first visit waits for the dev server to compile the devices screens
test.describe.configure({ timeout: 120_000 });

test('adds discovered devices through Discover, Select, Confirm and Results, retrying the one that failed', async ({ page, baseURL }) => {
	await mockBackend(page, baseURL!, []);
	const discovery = await serveShellyDiscovery(page);

	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/devices', { timeout: 60_000 });

	await page.getByRole('button', { name: 'Wizard' }).first().click({ timeout: 60_000 });

	const picker = page.locator('[data-test-id="type-picker"]');

	await expect(picker).toBeVisible();
	// Every virtual device wizard has its own tile, badged with the plugin
	await expect(picker.locator('[data-option-id="devices-virtual:group"] [data-test-id="type-picker-badge"]')).toBeVisible();

	await picker.locator('[data-option-id="devices-shelly-ng-plugin"]').click();
	await expect(page).toHaveURL(/\/devices\/wizard\/devices-shelly-ng-plugin$/);

	const next = page.locator('[data-test-id="wizard-shell-next"]');
	const step = page.locator('[data-test-id="wizard-shell-step"][aria-current="step"]');

	await expect(step).toContainText('Discovery', { timeout: 60_000 });
	await expect(page.getByText('Kitchen relay').first()).toBeVisible();
	await next.click();

	await expect(step).toContainText('Select');
	await expect(page.locator('[data-test-id="wizard-shell-selected"]')).toHaveText('3 selected');
	await next.click();

	await expect(step).toContainText('Confirm');
	await expect(page.locator('[data-test-id="wizard-confirm-table"]')).toBeVisible();
	await next.click();

	await expect(step).toContainText('Results');
	await expect(page.locator('[data-test-id="wizard-result-retry"]')).toHaveCount(1);
	expect(discovery.adoptions[0]).toHaveLength(3);

	await page.locator('[data-test-id="wizard-result-retry"]').click();

	await expect(page.locator('[data-test-id="wizard-result-retry"]')).toHaveCount(0);
	expect(discovery.adoptions[1]).toEqual([expect.objectContaining({ hostname: 'shellyplus2pm-kitchen.local' })]);
	await expect(page.getByText('All selected devices were added successfully')).toBeVisible();
});

test('opens the picker from its own address and returns to the list when dismissed', async ({ page, baseURL }) => {
	await mockBackend(page, baseURL!, []);
	await serveShellyDiscovery(page);

	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/devices/wizard', { timeout: 60_000 });

	await expect(page.locator('[data-test-id="type-picker"]')).toBeVisible({ timeout: 60_000 });
	await expect(page).toHaveURL(/\/devices\?wizard=select$/);

	await page.keyboard.press('Escape');

	await expect(page.locator('[data-test-id="type-picker"]')).toBeHidden();
	await expect(page).toHaveURL(/\/devices$/);
});

test('confirms the devices as one card each on tablet portrait', async ({ page, baseURL }) => {
	await mockBackend(page, baseURL!, []);
	await serveShellyDiscovery(page);

	await page.setViewportSize({ width: 744, height: 1000 });
	await page.goto('/devices/wizard/devices-shelly-ng-plugin', { timeout: 60_000 });

	const next = page.locator('[data-test-id="wizard-shell-next"]');

	await expect(page.getByText('Kitchen relay').first()).toBeVisible({ timeout: 60_000 });
	await next.click();
	await next.click();

	await expect(page.locator('[data-test-id="wizard-confirm-card"]')).toHaveCount(3);
	await expect(page.locator('[data-test-id="wizard-confirm-table"]')).toHaveCount(0);
});
