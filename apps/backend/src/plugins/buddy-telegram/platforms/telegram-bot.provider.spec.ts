import { SuggestionType } from '../../../modules/buddy/buddy.constants';
import { BuddySuggestion } from '../../../modules/buddy/services/suggestion-engine.service';
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

		provider = new TelegramBotProvider(configService as any, conversationService as any, suggestionEngine as any);
	});

	afterEach(() => {
		provider.onModuleDestroy();
	});

	describe('onModuleInit', () => {
		it('should not start bot when plugin is disabled', async () => {
			configService.getPluginConfig.mockReturnValue(makeConfig({ enabled: false }));

			await provider.onModuleInit();

			expect(provider.isRunning()).toBe(false);
		});

		it('should not start bot when token is missing', async () => {
			configService.getPluginConfig.mockReturnValue(makeConfig({ enabled: true, botToken: null }));

			await provider.onModuleInit();

			expect(provider.isRunning()).toBe(false);
		});
	});

	describe('onConfigUpdated', () => {
		it('should stop bot when plugin is disabled on config update', async () => {
			configService.getPluginConfig.mockReturnValue(makeConfig({ enabled: false }));

			await provider.onConfigUpdated();

			expect(provider.isRunning()).toBe(false);
		});
	});

	describe('onSuggestionCreated', () => {
		it('should not throw when bot is not running', async () => {
			const suggestion = makeSuggestion();

			await expect(provider.onSuggestionCreated(suggestion)).resolves.not.toThrow();
		});
	});

	describe('getPluginConfig fallback', () => {
		it('should return null when config service throws', async () => {
			configService.getPluginConfig.mockImplementation(() => {
				throw new Error('Config not found');
			});

			// Should not throw - falls back to null config, bot stays stopped
			await provider.onModuleInit();

			expect(provider.isRunning()).toBe(false);
		});
	});
});
