import { isValidSlackWebhookUrl } from './slack-webhook-url.validator';

describe('isValidSlackWebhookUrl', () => {
	describe('accepts', () => {
		it.each([
			[
				'a canonical incoming-webhook URL',
				'https://hooks.slack.com/services/T0/B0/XYZ',
			],
			['a lowercase-hostname variant', 'https://HOOKS.SLACK.COM/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX'],
			['a trailing slash', 'https://hooks.slack.com/services/T0/B0/XYZ/'],
		])('%s', (_label, url) => {
			expect(isValidSlackWebhookUrl(url)).toBe(true);
		});
	});

	describe('rejects', () => {
		it('a private IP host', () => {
			expect(isValidSlackWebhookUrl('https://10.0.0.1/services/T0/B0/XYZ')).toBe(false);
		});

		it('an arbitrary host', () => {
			expect(isValidSlackWebhookUrl('https://evil.example.com/services/T0/B0/XYZ')).toBe(false);
		});

		it('a look-alike host that merely contains hooks.slack.com', () => {
			expect(isValidSlackWebhookUrl('https://hooks.slack.com.evil.example.com/services/T0/B0/XYZ')).toBe(false);
		});

		it('http:', () => {
			expect(isValidSlackWebhookUrl('http://hooks.slack.com/services/T0/B0/XYZ')).toBe(false);
		});

		it('a Slack host that is not a webhook path', () => {
			expect(isValidSlackWebhookUrl('https://hooks.slack.com/api/chat.postMessage')).toBe(false);
		});

		it('a wrong Slack path shape (missing the B segment)', () => {
			expect(isValidSlackWebhookUrl('https://hooks.slack.com/services/T0/XYZ')).toBe(false);
		});

		it('a URL with userinfo', () => {
			expect(isValidSlackWebhookUrl('https://user:pass@hooks.slack.com/services/T0/B0/XYZ')).toBe(false);
		});

		it('a URL with an explicit non-default port', () => {
			expect(isValidSlackWebhookUrl('https://hooks.slack.com:8443/services/T0/B0/XYZ')).toBe(false);
		});

		it('a malformed URL', () => {
			expect(isValidSlackWebhookUrl('not-a-url')).toBe(false);
		});

		it('null', () => {
			expect(isValidSlackWebhookUrl(null)).toBe(false);
		});
	});
});
