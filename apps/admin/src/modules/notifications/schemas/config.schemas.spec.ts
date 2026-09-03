import { describe, expect, it } from 'vitest';

import { NOTIFICATIONS_MODULE_NAME } from '../notifications.constants';

import { NotificationsConfigEditFormSchema } from './config.schemas';

const validModel = {
	type: NOTIFICATIONS_MODULE_NAME,
	enabled: true,
	retentionDays: 30,
	maxNotifications: 500,
};

describe('NotificationsConfigEditFormSchema', () => {
	it('accepts a model within both ranges', () => {
		const parsed = NotificationsConfigEditFormSchema.safeParse(validModel);

		expect(parsed.success).toBe(true);
	});

	it.each([1, 365])('accepts retentionDays at the %i-day boundary', (retentionDays) => {
		const parsed = NotificationsConfigEditFormSchema.safeParse({ ...validModel, retentionDays });

		expect(parsed.success).toBe(true);
	});

	it.each([0, 366])('rejects retentionDays of %i, outside 1-365', (retentionDays) => {
		const parsed = NotificationsConfigEditFormSchema.safeParse({ ...validModel, retentionDays });

		expect(parsed.success).toBe(false);
	});

	it.each([50, 5000])('accepts maxNotifications at the %i boundary', (maxNotifications) => {
		const parsed = NotificationsConfigEditFormSchema.safeParse({ ...validModel, maxNotifications });

		expect(parsed.success).toBe(true);
	});

	it.each([49, 5001])('rejects maxNotifications of %i, outside 50-5000', (maxNotifications) => {
		const parsed = NotificationsConfigEditFormSchema.safeParse({ ...validModel, maxNotifications });

		expect(parsed.success).toBe(false);
	});

	it('rejects a non-integer retentionDays', () => {
		const parsed = NotificationsConfigEditFormSchema.safeParse({ ...validModel, retentionDays: 30.5 });

		expect(parsed.success).toBe(false);
	});

	it('rejects a non-integer maxNotifications', () => {
		const parsed = NotificationsConfigEditFormSchema.safeParse({ ...validModel, maxNotifications: 500.5 });

		expect(parsed.success).toBe(false);
	});
});
