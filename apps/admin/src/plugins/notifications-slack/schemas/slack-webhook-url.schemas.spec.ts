import { describe, expect, it } from 'vitest';

import { SlackWebhookUrlSchema, isValidSlackWebhookUrl } from './slack-webhook-url.schemas';

describe('isValidSlackWebhookUrl', () => {
	it('accepts a valid https Slack webhook URL', () => {
		expect(isValidSlackWebhookUrl('https://hooks.slack.com/services/T0/B0/XYZ')).toBe(true);
	});

	it.each([
		'http://hooks.slack.com/services/T0/B0/XYZ',
		'ftp://hooks.slack.com/services/T0/B0/XYZ',
		'https://admin:secret@hooks.slack.com/services/T0/B0/XYZ',
		'not-a-url',
	])('rejects %s', (url) => {
		expect(isValidSlackWebhookUrl(url)).toBe(false);
	});
});

describe('SlackWebhookUrlSchema', () => {
	it('accepts a valid URL', () => {
		expect(SlackWebhookUrlSchema.safeParse('https://hooks.slack.com/services/T0/B0/XYZ').success).toBe(true);
	});

	it('rejects an http URL', () => {
		expect(SlackWebhookUrlSchema.safeParse('http://hooks.slack.com/services/T0/B0/XYZ').success).toBe(false);
	});
});
