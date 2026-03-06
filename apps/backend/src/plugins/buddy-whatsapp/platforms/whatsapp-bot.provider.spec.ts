import { SuggestionType } from '../../../modules/buddy/buddy.constants';
import { BuddySuggestion } from '../../../modules/buddy/services/suggestion-engine.service';
import { BUDDY_WHATSAPP_PLUGIN_NAME } from '../buddy-whatsapp.constants';
import { BuddyWhatsappConfigModel } from '../models/config.model';

import { WhatsAppBotProvider } from './whatsapp-bot.provider';

function makeConfig(overrides: Partial<BuddyWhatsappConfigModel> = {}): BuddyWhatsappConfigModel {
	return Object.assign(new BuddyWhatsappConfigModel(), {
		type: BUDDY_WHATSAPP_PLUGIN_NAME,
		enabled: false,
		phoneNumberId: null,
		accessToken: null,
		webhookVerifyToken: null,
		allowedPhoneNumbers: null,
		...overrides,
	});
}

function makeSuggestion(overrides: Partial<BuddySuggestion> = {}): BuddySuggestion {
	return {
		id: 'sug-1',
		type: SuggestionType.CONFLICT_HEATING_WINDOW,
		title: 'Heating conflict',
		reason: 'Living room window is open but heating is active.',
		spaceId: 'space-1',
		metadata: {},
		createdAt: new Date(),
		expiresAt: new Date(Date.now() + 86_400_000),
		...overrides,
	};
}

function makeWebhookPayload(from: string, text: string) {
	return {
		object: 'whatsapp_business_account',
		entry: [
			{
				id: 'entry-1',
				changes: [
					{
						value: {
							messaging_product: 'whatsapp',
							metadata: { phone_number_id: '123456' },
							messages: [
								{
									from,
									id: 'msg-1',
									type: 'text',
									text: { body: text },
								},
							],
						},
					},
				],
			},
		],
	};
}

function makeButtonReplyPayload(from: string, buttonId: string) {
	return {
		object: 'whatsapp_business_account',
		entry: [
			{
				id: 'entry-1',
				changes: [
					{
						value: {
							messaging_product: 'whatsapp',
							metadata: { phone_number_id: '123456' },
							messages: [
								{
									from,
									id: 'msg-1',
									type: 'interactive',
									interactive: {
										type: 'button_reply',
										button_reply: { id: buttonId, title: 'Accept' },
									},
								},
							],
						},
					},
				],
			},
		],
	};
}

describe('WhatsAppBotProvider', () => {
	let provider: WhatsAppBotProvider;
	let configService: { getPluginConfig: jest.Mock };
	let conversationService: {
		findOne: jest.Mock;
		create: jest.Mock;
		sendMessage: jest.Mock;
	};
	let suggestionEngine: { recordFeedback: jest.Mock };

	beforeEach(() => {
		configService = {
			getPluginConfig: jest.fn().mockReturnValue(makeConfig()),
		};

		conversationService = {
			findOne: jest.fn().mockResolvedValue(null),
			create: jest.fn().mockResolvedValue({ id: 'conv-1' }),
			sendMessage: jest.fn().mockResolvedValue({ content: 'Hello from buddy!' }),
		};

		suggestionEngine = {
			recordFeedback: jest.fn().mockReturnValue({ success: true }),
		};

		provider = new WhatsAppBotProvider(configService as any, conversationService as any, suggestionEngine as any);
	});

	afterEach(() => {
		provider.onModuleDestroy();
	});

	describe('onModuleInit', () => {
		it('should initialize with disabled config', async () => {
			configService.getPluginConfig.mockReturnValue(makeConfig({ enabled: false }));

			await provider.onModuleInit();

			expect(provider.isConfigured()).toBe(false);
		});

		it('should initialize when fully configured', async () => {
			configService.getPluginConfig.mockReturnValue(
				makeConfig({
					enabled: true,
					phoneNumberId: '123456',
					accessToken: 'test-token',
					webhookVerifyToken: 'verify-123',
				}),
			);

			await provider.onModuleInit();

			expect(provider.isConfigured()).toBe(true);
		});
	});

	describe('verifyWebhookToken', () => {
		it('should return true when token matches', async () => {
			configService.getPluginConfig.mockReturnValue(
				makeConfig({ enabled: true, webhookVerifyToken: 'my-verify-token' }),
			);

			await provider.onModuleInit();

			expect(provider.verifyWebhookToken('my-verify-token')).toBe(true);
		});

		it('should return false when token does not match', async () => {
			configService.getPluginConfig.mockReturnValue(
				makeConfig({ enabled: true, webhookVerifyToken: 'my-verify-token' }),
			);

			await provider.onModuleInit();

			expect(provider.verifyWebhookToken('wrong-token')).toBe(false);
		});

		it('should return false when no verify token configured', async () => {
			configService.getPluginConfig.mockReturnValue(makeConfig({ enabled: true }));

			await provider.onModuleInit();

			expect(provider.verifyWebhookToken('any-token')).toBe(false);
		});
	});

	describe('handleWebhookPayload', () => {
		beforeEach(async () => {
			configService.getPluginConfig.mockReturnValue(
				makeConfig({
					enabled: true,
					phoneNumberId: '123456',
					accessToken: 'test-token',
				}),
			);

			// Mock fetch globally
			global.fetch = jest.fn().mockResolvedValue({
				ok: true,
				text: jest.fn().mockResolvedValue('{}'),
			});

			await provider.onModuleInit();
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		it('should ignore non-whatsapp payloads', async () => {
			await provider.handleWebhookPayload({ object: 'other' });

			expect(conversationService.create).not.toHaveBeenCalled();
		});

		it('should process text messages and create conversations', async () => {
			const payload = makeWebhookPayload('+1234567890', 'Hello buddy');

			await provider.handleWebhookPayload(payload);

			expect(conversationService.create).toHaveBeenCalledWith('WhatsApp (+1234567890)');
			expect(conversationService.sendMessage).toHaveBeenCalledWith('conv-1', 'Hello buddy');
			expect(global.fetch).toHaveBeenCalled();
		});

		it('should reject messages from unauthorized phone numbers', async () => {
			configService.getPluginConfig.mockReturnValue(
				makeConfig({
					enabled: true,
					phoneNumberId: '123456',
					accessToken: 'test-token',
					allowedPhoneNumbers: '+9999999999',
				}),
			);

			const payload = makeWebhookPayload('+1234567890', 'Hello');

			await provider.handleWebhookPayload(payload);

			expect(conversationService.create).not.toHaveBeenCalled();
		});

		it('should allow messages from whitelisted phone numbers', async () => {
			configService.getPluginConfig.mockReturnValue(
				makeConfig({
					enabled: true,
					phoneNumberId: '123456',
					accessToken: 'test-token',
					allowedPhoneNumbers: '+1234567890,+9999999999',
				}),
			);

			const payload = makeWebhookPayload('+1234567890', 'Hello');

			await provider.handleWebhookPayload(payload);

			expect(conversationService.create).toHaveBeenCalled();
		});

		it('should handle button reply for suggestion feedback', async () => {
			const payload = makeButtonReplyPayload('+1234567890', 'suggestion:accept:sug-1');

			await provider.handleWebhookPayload(payload);

			expect(suggestionEngine.recordFeedback).toHaveBeenCalledWith('sug-1', 'applied');
		});

		it('should handle dismiss button reply for suggestion feedback', async () => {
			const payload = makeButtonReplyPayload('+1234567890', 'suggestion:dismiss:sug-1');

			await provider.handleWebhookPayload(payload);

			expect(suggestionEngine.recordFeedback).toHaveBeenCalledWith('sug-1', 'dismissed');
		});

		it('should not process when plugin is disabled', async () => {
			configService.getPluginConfig.mockReturnValue(makeConfig({ enabled: false }));

			const payload = makeWebhookPayload('+1234567890', 'Hello');

			await provider.handleWebhookPayload(payload);

			expect(conversationService.create).not.toHaveBeenCalled();
		});
	});

	describe('onConfigUpdated', () => {
		it('should update config when values change', async () => {
			configService.getPluginConfig.mockReturnValue(makeConfig({ enabled: false }));
			await provider.onModuleInit();

			configService.getPluginConfig.mockReturnValue(
				makeConfig({
					enabled: true,
					phoneNumberId: '123456',
					accessToken: 'test-token',
				}),
			);

			provider.onConfigUpdated();

			expect(provider.isConfigured()).toBe(true);
		});

		it('should not update when config has not changed', async () => {
			const config = makeConfig({ enabled: false });

			configService.getPluginConfig.mockReturnValue(config);
			await provider.onModuleInit();

			// Call again with same config
			provider.onConfigUpdated();

			// Should not throw or change state
			expect(provider.isConfigured()).toBe(false);
		});
	});

	describe('onSuggestionCreated', () => {
		it('should not throw when plugin is not configured', async () => {
			const suggestion = makeSuggestion();

			await expect(provider.onSuggestionCreated(suggestion)).resolves.not.toThrow();
		});
	});

	describe('getPluginConfig fallback', () => {
		it('should return null when config service throws', async () => {
			configService.getPluginConfig.mockImplementation(() => {
				throw new Error('Config not found');
			});

			// Should not throw - falls back to null config
			await provider.onModuleInit();

			expect(provider.isConfigured()).toBe(false);
		});
	});
});
