import { describe, expect, it } from 'vitest';

import {
	NotificationsTelegramConfigResSchema,
	NotificationsTelegramConfigSchema,
	NotificationsTelegramConfigUpdateReqSchema,
} from './config.store.schemas';

describe('NotificationsTelegramConfigSchema', () => {
	it('accepts null for the redacted bot token', () => {
		expect(NotificationsTelegramConfigSchema.safeParse({ type: 'notifications-telegram-plugin', enabled: true, botToken: null }).success).toBe(true);
	});

	it('defaults botTokenConfigured to false when absent', () => {
		const parsed = NotificationsTelegramConfigSchema.parse({ type: 'notifications-telegram-plugin', enabled: true });

		expect(parsed.botTokenConfigured).toBe(false);
	});

	it('defaults chatId to null when absent', () => {
		const parsed = NotificationsTelegramConfigSchema.parse({ type: 'notifications-telegram-plugin', enabled: true });

		expect(parsed.chatId).toBeNull();
	});
});

describe('NotificationsTelegramConfigUpdateReqSchema', () => {
	it('accepts null for the bot token, expressing a removal', () => {
		const parsed = NotificationsTelegramConfigUpdateReqSchema.parse({ type: 'notifications-telegram-plugin', bot_token: null });

		expect(parsed.bot_token).toBeNull();
	});

	it('accepts a chat id', () => {
		const parsed = NotificationsTelegramConfigUpdateReqSchema.parse({ type: 'notifications-telegram-plugin', chat_id: '123456789' });

		expect(parsed.chat_id).toBe('123456789');
	});
});

describe('NotificationsTelegramConfigResSchema', () => {
	it('accepts a redacted response with only bot_token_configured', () => {
		const result = NotificationsTelegramConfigResSchema.safeParse({
			type: 'notifications-telegram-plugin',
			enabled: true,
			bot_token_configured: true,
			chat_id: '123456789',
			min_severity: 'warning',
		});

		expect(result.success).toBe(true);
	});
});
