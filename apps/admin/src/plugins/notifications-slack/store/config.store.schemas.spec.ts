import { describe, expect, it } from 'vitest';

import { SlackConfigResSchema, SlackConfigSchema, SlackConfigUpdateReqSchema } from './config.store.schemas';

describe('SlackConfigSchema', () => {
	it('accepts null for the redacted webhook URL', () => {
		expect(SlackConfigSchema.safeParse({ type: 'notifications-slack-plugin', enabled: true, webhookUrl: null }).success).toBe(true);
	});

	it('defaults webhookUrlConfigured to false when absent', () => {
		const parsed = SlackConfigSchema.parse({ type: 'notifications-slack-plugin', enabled: true });

		expect(parsed.webhookUrlConfigured).toBe(false);
	});
});

describe('SlackConfigUpdateReqSchema', () => {
	it('accepts null for the webhook URL, expressing a removal', () => {
		const parsed = SlackConfigUpdateReqSchema.parse({ type: 'notifications-slack-plugin', webhook_url: null });

		expect(parsed.webhook_url).toBeNull();
	});

	it('rejects an http webhook URL', () => {
		expect(
			SlackConfigUpdateReqSchema.safeParse({
				type: 'notifications-slack-plugin',
				webhook_url: 'http://hooks.slack.com/services/T0/B0/XYZ',
			}).success
		).toBe(false);
	});
});

describe('SlackConfigResSchema', () => {
	it('accepts a redacted response with only webhook_url_configured', () => {
		const result = SlackConfigResSchema.safeParse({
			type: 'notifications-slack-plugin',
			enabled: true,
			webhook_url_configured: true,
			min_severity: 'warning',
		});

		expect(result.success).toBe(true);
	});
});
