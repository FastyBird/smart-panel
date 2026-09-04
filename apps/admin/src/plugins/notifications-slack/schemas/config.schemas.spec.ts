import { describe, expect, it, vi } from 'vitest';

import { SlackConfigEditFormSchema } from './config.schemas';

vi.mock('../../../modules/config', async () => {
	const schemas = await vi.importActual<typeof import('../../../modules/config/schemas/plugins.schemas')>(
		'../../../modules/config/schemas/plugins.schemas'
	);

	return { ConfigPluginEditFormSchema: schemas.ConfigPluginEditFormSchema };
});

const createConfig = (overrides: Record<string, unknown> = {}) => ({
	type: 'notifications-slack-plugin',
	enabled: true,
	webhookUrl: undefined,
	webhookUrlConfigured: false,
	minSeverity: 'warning',
	...overrides,
});

describe('SlackConfigEditFormSchema', () => {
	it.each([
		['a non-empty https replacement', { webhookUrl: 'https://hooks.slack.com/services/T0/B0/XYZ' }],
		['an existing stored webhook URL', { webhookUrl: undefined, webhookUrlConfigured: true }],
		['a removed webhook URL', { webhookUrl: null, webhookUrlConfigured: true }],
	])('accepts %s', (_label, overrides) => {
		expect(SlackConfigEditFormSchema.safeParse(createConfig(overrides)).success).toBe(true);
	});

	it('rejects a malformed webhook URL', () => {
		expect(SlackConfigEditFormSchema.safeParse(createConfig({ webhookUrl: 'not-a-url' })).success).toBe(false);
	});

	it('rejects an http webhook URL', () => {
		expect(SlackConfigEditFormSchema.safeParse(createConfig({ webhookUrl: 'http://hooks.slack.com/services/T0/B0/XYZ' })).success).toBe(false);
	});

	it('accepts min_severity as one of the four severities', () => {
		for (const severity of ['info', 'warning', 'error', 'critical']) {
			expect(SlackConfigEditFormSchema.safeParse(createConfig({ minSeverity: severity })).success).toBe(true);
		}
	});

	it('rejects an unknown min_severity', () => {
		expect(SlackConfigEditFormSchema.safeParse(createConfig({ minSeverity: 'unknown' })).success).toBe(false);
	});
});
