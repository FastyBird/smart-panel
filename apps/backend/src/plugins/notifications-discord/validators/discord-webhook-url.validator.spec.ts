import { isValidDiscordWebhookUrl } from './discord-webhook-url.validator';

describe('isValidDiscordWebhookUrl', () => {
	describe('accepts', () => {
		it.each([
			['discord.com', 'https://discord.com/api/webhooks/123456789012345678/abcDEF-token_1'],
			['discordapp.com', 'https://discordapp.com/api/webhooks/123456789012345678/abcDEF-token'],
			['ptb.discord.com', 'https://ptb.discord.com/api/webhooks/123456789012345678/abcDEF-token'],
			['canary.discord.com', 'https://canary.discord.com/api/webhooks/123456789012345678/abcDEF-token'],
			['a versioned API path', 'https://discord.com/api/v10/webhooks/123456789012345678/abcDEF-token'],
		])('a canonical webhook URL on %s', (_label, url) => {
			expect(isValidDiscordWebhookUrl(url)).toBe(true);
		});
	});

	describe('rejects', () => {
		it('a private IP host', () => {
			expect(isValidDiscordWebhookUrl('https://10.0.0.1/api/webhooks/1/x')).toBe(false);
		});

		it('an arbitrary host', () => {
			expect(isValidDiscordWebhookUrl('https://evil.example.com/api/webhooks/1/x')).toBe(false);
		});

		it('a look-alike host that merely contains discord.com', () => {
			expect(isValidDiscordWebhookUrl('https://discord.com.evil.example.com/api/webhooks/1/x')).toBe(false);
		});

		it('http:', () => {
			expect(isValidDiscordWebhookUrl('http://discord.com/api/webhooks/1/x')).toBe(false);
		});

		it('a Discord URL that is not a webhook path', () => {
			expect(isValidDiscordWebhookUrl('https://discord.com/api/users/@me')).toBe(false);
		});

		it('a non-numeric webhook id', () => {
			expect(isValidDiscordWebhookUrl('https://discord.com/api/webhooks/not-a-number/token')).toBe(false);
		});

		it('a URL with userinfo', () => {
			expect(isValidDiscordWebhookUrl('https://user:pass@discord.com/api/webhooks/1/x')).toBe(false);
		});

		it('a URL with an explicit non-default port', () => {
			expect(isValidDiscordWebhookUrl('https://discord.com:8443/api/webhooks/1/x')).toBe(false);
		});

		it('a malformed URL', () => {
			expect(isValidDiscordWebhookUrl('not-a-url')).toBe(false);
		});

		it('null', () => {
			expect(isValidDiscordWebhookUrl(null)).toBe(false);
		});
	});
});
