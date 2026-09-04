import { describe, expect, it } from 'vitest';

import { SlackWebhookUrlSchema, isValidSlackWebhookUrl } from './slack-webhook-url.schemas';

describe('isValidSlackWebhookUrl', () => {
	it.each([
		['a canonical incoming-webhook URL', 'https://hooks.slack.com/services/T0/B0/XYZ'],
		['a lowercase-hostname variant', 'https://HOOKS.SLACK.COM/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX'],
	])('accepts %s', (_label, url) => {
		expect(isValidSlackWebhookUrl(url)).toBe(true);
	});

	it.each([
		['a private IP host', 'https://10.0.0.1/services/T0/B0/XYZ'],
		['an arbitrary host', 'https://evil.example.com/services/T0/B0/XYZ'],
		['a look-alike host', 'https://hooks.slack.com.evil.example.com/services/T0/B0/XYZ'],
		['http:', 'http://hooks.slack.com/services/T0/B0/XYZ'],
		['ftp:', 'ftp://hooks.slack.com/services/T0/B0/XYZ'],
		['a non-webhook Slack path', 'https://hooks.slack.com/api/chat.postMessage'],
		['a wrong Slack path shape', 'https://hooks.slack.com/services/T0/XYZ'],
		['userinfo', 'https://admin:secret@hooks.slack.com/services/T0/B0/XYZ'],
		['a non-default port', 'https://hooks.slack.com:8443/services/T0/B0/XYZ'],
		['not-a-url', 'not-a-url'],
	])('rejects %s', (_label, url) => {
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

	it('rejects an arbitrary https host', () => {
		expect(SlackWebhookUrlSchema.safeParse('https://evil.example.com/services/T0/B0/XYZ').success).toBe(false);
	});
});
