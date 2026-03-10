import { SuggestionType } from '../../../modules/buddy/buddy.constants';
import { BuddyConversationService } from '../../../modules/buddy/services/buddy-conversation.service';
import { BuddySuggestion, SuggestionEngineService } from '../../../modules/buddy/services/suggestion-engine.service';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BUDDY_TELEGRAM_PLUGIN_NAME } from '../buddy-telegram.constants';
import { BuddyTelegramConfigModel } from '../models/config.model';

import { TelegramBotProvider } from './telegram-bot.provider';

function makeConfig(overrides: Partial<BuddyTelegramConfigModel> = {}): BuddyTelegramConfigModel {
	return Object.assign(new BuddyTelegramConfigModel(), {
		type: BUDDY_TELEGRAM_PLUGIN_NAME,
		enabled: false,
		botToken: null,
		allowedUserIds: null,
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

describe('TelegramBotProvider', () => {
	let provider: TelegramBotProvider;
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

		provider = new TelegramBotProvider(
			configService as unknown as ConfigService,
			conversationService as unknown as BuddyConversationService,
			suggestionEngine as unknown as SuggestionEngineService,
		);
	});

	afterEach(async () => {
		await provider.stop();
	});

	describe('IManagedPluginService interface', () => {
		it('should have correct pluginName and serviceId', () => {
			expect(provider.pluginName).toBe(BUDDY_TELEGRAM_PLUGIN_NAME);
			expect(provider.serviceId).toBe('bot');
		});

		it('should return stopped state by default', () => {
			expect(provider.getState()).toBe('stopped');
		});
	});

	describe('start', () => {
		it('should throw when token is missing', async () => {
			configService.getPluginConfig.mockReturnValue(makeConfig({ enabled: true, botToken: null }));

			await expect(provider.start()).rejects.toThrow('Telegram bot token is not configured');

			expect(provider.getState()).toBe('stopped');
			expect(provider.isRunning()).toBe(false);
		});
	});

	describe('onConfigChanged', () => {
		it('should return restartRequired false when not started', async () => {
			const result = await provider.onConfigChanged();

			expect(result).toEqual({ restartRequired: false });
		});
	});

	describe('onSuggestionCreated', () => {
		it('should not throw when bot is not running', async () => {
			const suggestion = makeSuggestion();

			await expect(provider.onSuggestionCreated(suggestion)).resolves.not.toThrow();
		});
	});

	describe('getPluginConfig fallback', () => {
		it('should throw when config service throws (no token available)', async () => {
			configService.getPluginConfig.mockImplementation(() => {
				throw new Error('Config not found');
			});

			await expect(provider.start()).rejects.toThrow('Telegram bot token is not configured');

			expect(provider.getState()).toBe('stopped');
			expect(provider.isRunning()).toBe(false);
		});
	});
});
