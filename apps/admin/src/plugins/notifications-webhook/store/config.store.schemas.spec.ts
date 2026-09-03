import { describe, expect, it } from 'vitest';

import { WebhookConfigResSchema, WebhookConfigSchema, WebhookConfigUpdateReqSchema } from './config.store.schemas';

describe('WebhookConfigSchema', () => {
	it('accepts null for the redacted url and headers fields', () => {
		expect(WebhookConfigSchema.safeParse({ type: 'notifications-webhook-plugin', enabled: true, url: null, headers: null }).success).toBe(true);
	});

	it('accepts an absent url and headers, defaulting the _configured flags to false', () => {
		const parsed = WebhookConfigSchema.parse({ type: 'notifications-webhook-plugin', enabled: true });

		expect(parsed.urlConfigured).toBe(false);
		expect(parsed.headersConfigured).toBe(false);
	});
});

describe('WebhookConfigUpdateReqSchema', () => {
	it('accepts null for url and headers, expressing a removal', () => {
		const parsed = WebhookConfigUpdateReqSchema.parse({
			type: 'notifications-webhook-plugin',
			url: null,
			headers: null,
		});

		expect(parsed.url).toBeNull();
		expect(parsed.headers).toBeNull();
	});

	it('parses the headers JSON text into an object for the wire request', () => {
		const parsed = WebhookConfigUpdateReqSchema.parse({
			type: 'notifications-webhook-plugin',
			headers: '{"Authorization":"Bearer token"}',
		});

		expect(parsed.headers).toEqual({ Authorization: 'Bearer token' });
	});

	it('treats a blank headers string as unset rather than an empty object', () => {
		const parsed = WebhookConfigUpdateReqSchema.parse({
			type: 'notifications-webhook-plugin',
			headers: '   ',
		});

		expect(parsed.headers).toBeUndefined();
	});

	it('rejects a malformed url', () => {
		expect(WebhookConfigUpdateReqSchema.safeParse({ type: 'notifications-webhook-plugin', url: 'not-a-url' }).success).toBe(false);
	});
});

describe('WebhookConfigResSchema', () => {
	it('accepts a redacted response with only the _configured flags', () => {
		const result = WebhookConfigResSchema.safeParse({
			type: 'notifications-webhook-plugin',
			enabled: true,
			url_configured: true,
			headers_configured: false,
			min_severity: 'warning',
		});

		expect(result.success).toBe(true);
	});
});
