import { describe, expect, it } from 'vitest';

import {
	NotificationsDiscordConfigResSchema,
	NotificationsDiscordConfigSchema,
	NotificationsDiscordConfigUpdateReqSchema,
} from './config.store.schemas';

describe('NotificationsDiscordConfigSchema', () => {
	it('accepts null for the redacted webhook URL', () => {
		expect(NotificationsDiscordConfigSchema.safeParse({ type: 'notifications-discord-plugin', enabled: true, webhookUrl: null }).success).toBe(true);
	});

	it('defaults webhookUrlConfigured to false when absent', () => {
		const parsed = NotificationsDiscordConfigSchema.parse({ type: 'notifications-discord-plugin', enabled: true });

		expect(parsed.webhookUrlConfigured).toBe(false);
	});
});

describe('NotificationsDiscordConfigUpdateReqSchema', () => {
	it('accepts null for the webhook URL, expressing a removal', () => {
		const parsed = NotificationsDiscordConfigUpdateReqSchema.parse({ type: 'notifications-discord-plugin', webhook_url: null });

		expect(parsed.webhook_url).toBeNull();
	});

	it('rejects an http webhook URL', () => {
		expect(
			NotificationsDiscordConfigUpdateReqSchema.safeParse({
				type: 'notifications-discord-plugin',
				webhook_url: 'http://discord.com/api/webhooks/1/token',
			}).success
		).toBe(false);
	});
});

describe('NotificationsDiscordConfigResSchema', () => {
	it('accepts a redacted response with only webhook_url_configured', () => {
		const result = NotificationsDiscordConfigResSchema.safeParse({
			type: 'notifications-discord-plugin',
			enabled: true,
			webhook_url_configured: true,
			min_severity: 'warning',
		});

		expect(result.success).toBe(true);
	});
});
