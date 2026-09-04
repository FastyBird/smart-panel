import { describe, expect, it, vi } from 'vitest';

import { NotificationsTelegramConfigEditFormSchema } from './config.schemas';

vi.mock('../../../modules/config', async () => {
	const schemas = await vi.importActual<typeof import('../../../modules/config/schemas/plugins.schemas')>(
		'../../../modules/config/schemas/plugins.schemas'
	);

	return { ConfigPluginEditFormSchema: schemas.ConfigPluginEditFormSchema };
});

const createConfig = (overrides: Record<string, unknown> = {}) => ({
	type: 'notifications-telegram-plugin',
	enabled: true,
	botToken: undefined,
	botTokenConfigured: false,
	chatId: null,
	minSeverity: 'warning',
	...overrides,
});

describe('NotificationsTelegramConfigEditFormSchema', () => {
	it.each([
		['a non-empty replacement token', { botToken: '123456:ABC-token' }],
		['an existing stored token', { botToken: undefined, botTokenConfigured: true }],
		['a removed token', { botToken: null, botTokenConfigured: true }],
		['a chat id', { chatId: '123456789' }],
	])('accepts %s', (_label, overrides) => {
		expect(NotificationsTelegramConfigEditFormSchema.safeParse(createConfig(overrides)).success).toBe(true);
	});

	it('accepts min_severity as one of the four severities', () => {
		for (const severity of ['info', 'warning', 'error', 'critical']) {
			expect(NotificationsTelegramConfigEditFormSchema.safeParse(createConfig({ minSeverity: severity })).success).toBe(true);
		}
	});

	it('rejects an unknown min_severity', () => {
		expect(NotificationsTelegramConfigEditFormSchema.safeParse(createConfig({ minSeverity: 'unknown' })).success).toBe(false);
	});
});
