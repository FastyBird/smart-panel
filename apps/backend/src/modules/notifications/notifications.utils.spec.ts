import { sanitizeErrorMessage } from './notifications.utils';

describe('sanitizeErrorMessage', () => {
	it('reduces a Telegram bot URL to scheme://host, dropping the token-bearing path', () => {
		expect(sanitizeErrorMessage('https://api.telegram.org/bot123:ABC/sendMessage')).toBe('https://api.telegram.org');
	});

	it('reduces a Slack webhook URL to scheme://host, dropping the webhook path', () => {
		expect(sanitizeErrorMessage('https://hooks.slack.com/services/T0/B0/XYZ')).toBe('https://hooks.slack.com');
	});

	it('drops userinfo from a URL', () => {
		expect(sanitizeErrorMessage('https://user:secret@example.com/path')).toBe('https://example.com');
	});

	it('drops a query string from a URL', () => {
		expect(sanitizeErrorMessage('https://example.com/webhook?token=abc123')).toBe('https://example.com');
	});

	it('drops the port from a URL', () => {
		expect(sanitizeErrorMessage('http://192.168.1.20:8123/api/webhook')).toBe('http://192.168.1.20');
	});

	it('reduces every URL when a message names more than one', () => {
		expect(
			sanitizeErrorMessage(
				'POST https://hooks.slack.com/services/T0/B0/XYZ failed, retry at https://example.com/retry',
			),
		).toBe('POST https://hooks.slack.com failed, retry at https://example.com');
	});

	it('masks a bearer token, keeping the Bearer prefix', () => {
		expect(sanitizeErrorMessage('Authorization: Bearer abc.def.ghi rejected')).toBe(
			'Authorization: Bearer *** rejected',
		);
	});

	it('masks a bearer token case-insensitively', () => {
		expect(sanitizeErrorMessage('header was bearer sometoken123')).toBe('header was bearer ***');
	});

	it('masks a token= value outside of a URL', () => {
		expect(sanitizeErrorMessage('rejected: token=abc123def')).toBe('rejected: token=***');
	});

	it('masks key=, password= and secret= values case-insensitively', () => {
		expect(sanitizeErrorMessage('KEY=abc PASSWORD=def secret=ghi')).toBe('KEY=*** PASSWORD=*** secret=***');
	});

	it('masks a JSON token value completely even when it contains an escaped quote', () => {
		const out = sanitizeErrorMessage('request failed: {"token":"abc\\"def","other":"kept"}');

		expect(out).toMatch(/"token"\s*:\s*"\*\*\*"/);
		expect(out).not.toContain('abc');
		expect(out).not.toContain('def');
		expect(out).toContain('kept');
	});

	it('masks a token value inside JSON-like text', () => {
		expect(sanitizeErrorMessage('reply was {"ok":false,"token":"abc123"}')).toBe(
			'reply was {"ok":false,"token":"***"}',
		);
	});

	it('collapses newlines and repeated whitespace into single spaces', () => {
		expect(sanitizeErrorMessage('line one\n\n  line two\ttab')).toBe('line one line two tab');
	});

	it('truncates to 300 characters', () => {
		const result = sanitizeErrorMessage('a'.repeat(500));

		expect(result).toHaveLength(300);
		expect(result).toBe('a'.repeat(300));
	});

	it('leaves a short, plain message untouched', () => {
		expect(sanitizeErrorMessage('connection refused')).toBe('connection refused');
	});
});
