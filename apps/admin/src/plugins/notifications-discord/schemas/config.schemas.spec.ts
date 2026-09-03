import { describe, expect, it, vi } from 'vitest';

import { NotificationsDiscordConfigEditFormSchema } from './config.schemas';

vi.mock('../../../modules/config', async () => {
	const schemas = await vi.importActual<typeof import('../../../modules/config/schemas/plugins.schemas')>(
		'../../../modules/config/schemas/plugins.schemas'
	);

	return { ConfigPluginEditFormSchema: schemas.ConfigPluginEditFormSchema };
});

const createConfig = (overrides: Record<string, unknown> = {}) => ({
	type: 'notifications-discord-plugin',
	enabled: true,
	webhookUrl: undefined,
	webhookUrlConfigured: false,
	username: null,
	minSeverity: 'warning',
	...overrides,
});

describe('NotificationsDiscordConfigEditFormSchema', () => {
	it.each([
		['a non-empty https replacement', { webhookUrl: 'https://discord.com/api/webhooks/1/token' }],
		['an existing stored webhook URL', { webhookUrl: undefined, webhookUrlConfigured: true }],
		['a removed webhook URL', { webhookUrl: null, webhookUrlConfigured: true }],
		['a username override', { username: 'Smart Panel' }],
	])('accepts %s', (_label, overrides) => {
		expect(NotificationsDiscordConfigEditFormSchema.safeParse(createConfig(overrides)).success).toBe(true);
	});

	it('rejects a malformed webhook URL', () => {
		expect(NotificationsDiscordConfigEditFormSchema.safeParse(createConfig({ webhookUrl: 'not-a-url' })).success).toBe(false);
	});

	it('accepts min_severity as one of the four severities', () => {
		for (const severity of ['info', 'warning', 'error', 'critical']) {
			expect(NotificationsDiscordConfigEditFormSchema.safeParse(createConfig({ minSeverity: severity })).success).toBe(true);
		}
	});

	it('rejects an unknown min_severity', () => {
		expect(NotificationsDiscordConfigEditFormSchema.safeParse(createConfig({ minSeverity: 'unknown' })).success).toBe(false);
	});
});
