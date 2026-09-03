import { describe, expect, it } from 'vitest';

import { DiscordWebhookUrlSchema, isValidDiscordWebhookUrl } from './discord-webhook-url.schemas';

describe('isValidDiscordWebhookUrl', () => {
	it.each([
		['discord.com', 'https://discord.com/api/webhooks/123456789012345678/abcDEF-token'],
		['discordapp.com', 'https://discordapp.com/api/webhooks/123456789012345678/abcDEF-token'],
		['ptb.discord.com', 'https://ptb.discord.com/api/webhooks/123456789012345678/abcDEF-token'],
		['canary.discord.com', 'https://canary.discord.com/api/webhooks/123456789012345678/abcDEF-token'],
		['a versioned API path', 'https://discord.com/api/v10/webhooks/123456789012345678/abcDEF-token'],
	])('accepts a canonical webhook URL on %s', (_label, url) => {
		expect(isValidDiscordWebhookUrl(url)).toBe(true);
	});

	it.each([
		['a private IP host', 'https://10.0.0.1/api/webhooks/1/x'],
		['an arbitrary host', 'https://evil.example.com/api/webhooks/1/x'],
		['a look-alike host', 'https://discord.com.evil.example.com/api/webhooks/1/x'],
		['http:', 'http://discord.com/api/webhooks/123456789/token'],
		['ftp:', 'ftp://discord.com/api/webhooks/123456789/token'],
		['a non-webhook Discord path', 'https://discord.com/api/users/@me'],
		['a non-numeric webhook id', 'https://discord.com/api/webhooks/not-a-number/token'],
		['userinfo', 'https://admin:secret@discord.com/api/webhooks/123456789/token'],
		['a non-default port', 'https://discord.com:8443/api/webhooks/1/x'],
		['not-a-url', 'not-a-url'],
	])('rejects %s', (_label, url) => {
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

	it('rejects an arbitrary https host', () => {
		expect(DiscordWebhookUrlSchema.safeParse('https://evil.example.com/api/webhooks/123456789/token').success).toBe(false);
	});
});
