import { describe, expect, it, vi } from 'vitest';

import { WebhookConfigEditFormSchema } from './config.schemas';

vi.mock('../../../modules/config', async () => {
	const schemas = await vi.importActual<typeof import('../../../modules/config/schemas/plugins.schemas')>(
		'../../../modules/config/schemas/plugins.schemas'
	);

	return { ConfigPluginEditFormSchema: schemas.ConfigPluginEditFormSchema };
});

const createConfig = (overrides: Record<string, unknown> = {}) => ({
	type: 'notifications-webhook-plugin',
	enabled: true,
	url: undefined,
	urlConfigured: false,
	headers: undefined,
	headersConfigured: false,
	minSeverity: 'warning',
	...overrides,
});

describe('WebhookConfigEditFormSchema', () => {
	it.each([
		['a non-empty https replacement', { url: 'https://example.com/hooks/panel' }],
		['an existing stored URL', { url: undefined, urlConfigured: true }],
		['a removed URL', { url: null, urlConfigured: true }],
		['an http URL without headers', { url: 'http://n8n.local/webhook/panel', headers: undefined }],
	])('accepts %s', (_label, overrides) => {
		expect(WebhookConfigEditFormSchema.safeParse(createConfig(overrides)).success).toBe(true);
	});

	it('rejects a malformed URL', () => {
		expect(WebhookConfigEditFormSchema.safeParse(createConfig({ url: 'not-a-url' })).success).toBe(false);
	});

	it('accepts valid JSON headers alongside an https URL', () => {
		const result = WebhookConfigEditFormSchema.safeParse(
			createConfig({ url: 'https://example.com/hooks/panel', headers: '{"Authorization":"Bearer token"}' })
		);

		expect(result.success).toBe(true);
	});

	it('rejects headers that are not valid JSON', () => {
		const result = WebhookConfigEditFormSchema.safeParse(createConfig({ url: 'https://example.com/hooks/panel', headers: 'not-json' }));

		expect(result.success).toBe(false);
	});

	it('rejects an http URL combined with custom headers', () => {
		const result = WebhookConfigEditFormSchema.safeParse(
			createConfig({ url: 'http://n8n.local/webhook/panel', headers: '{"Authorization":"Bearer token"}' })
		);

		expect(result.success).toBe(false);
	});

	it('accepts min_severity as one of the four severities', () => {
		for (const severity of ['info', 'warning', 'error', 'critical']) {
			expect(WebhookConfigEditFormSchema.safeParse(createConfig({ minSeverity: severity })).success).toBe(true);
		}
	});

	it('rejects an unknown min_severity', () => {
		expect(WebhookConfigEditFormSchema.safeParse(createConfig({ minSeverity: 'unknown' })).success).toBe(false);
	});
});
