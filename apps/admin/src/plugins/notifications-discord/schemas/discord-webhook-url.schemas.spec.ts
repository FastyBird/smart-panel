import { describe, expect, it } from 'vitest';

import { DiscordWebhookUrlSchema, isValidDiscordWebhookUrl } from './discord-webhook-url.schemas';

describe('isValidDiscordWebhookUrl', () => {
	it('accepts a valid https Discord webhook URL', () => {
		expect(isValidDiscordWebhookUrl('https://discord.com/api/webhooks/123456789/token')).toBe(true);
	});

	it.each([
		'http://discord.com/api/webhooks/123456789/token',
		'ftp://discord.com/api/webhooks/123456789/token',
		'https://admin:secret@discord.com/api/webhooks/123456789/token',
		'not-a-url',
	])('rejects %s', (url) => {
		expect(isValidDiscordWebhookUrl(url)).toBe(false);
	});
});

describe('DiscordWebhookUrlSchema', () => {
	it('accepts a valid URL', () => {
		expect(DiscordWebhookUrlSchema.safeParse('https://discord.com/api/webhooks/123456789/token').success).toBe(true);
	});

	it('rejects an http URL', () => {
		expect(DiscordWebhookUrlSchema.safeParse('http://discord.com/api/webhooks/123456789/token').success).toBe(false);
	});
});
