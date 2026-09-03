import { describe, expect, it } from 'vitest';

import { WebhookUrlSchema, isValidWebhookUrl } from './webhook-url.schemas';

describe('isValidWebhookUrl', () => {
	it.each(['https://example.com/hooks/panel', 'http://n8n.local/webhook/panel'])('accepts a safe webhook URL: %s', (url) => {
		expect(isValidWebhookUrl(url)).toBe(true);
	});

	it.each(['ftp://example.com/hooks/panel', 'http://admin:secret@example.com/hooks', 'not-a-url'])('rejects an unsafe webhook URL: %s', (url) => {
		expect(isValidWebhookUrl(url)).toBe(false);
	});
});

describe('WebhookUrlSchema', () => {
	it('accepts a valid URL', () => {
		expect(WebhookUrlSchema.safeParse('https://example.com/hooks/panel').success).toBe(true);
	});

	it('rejects an invalid URL', () => {
		expect(WebhookUrlSchema.safeParse('not-a-url').success).toBe(false);
	});
});
