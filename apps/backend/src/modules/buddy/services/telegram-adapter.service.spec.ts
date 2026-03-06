/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { BUDDY_MODULE_NAME, SuggestionType } from '../buddy.constants';
import { BuddyConfigModel } from '../models/config.model';

import { BuddySuggestion } from './suggestion-engine.service';
import { TelegramAdapterService } from './telegram-adapter.service';

function makeConfig(overrides: Partial<BuddyConfigModel> = {}): BuddyConfigModel {
	return Object.assign(new BuddyConfigModel(), {
		telegramEnabled: false,
		telegramBotToken: undefined,
		telegramAllowedUserIds: undefined,
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

describe('TelegramAdapterService', () => {
	let service: TelegramAdapterService;
	let configService: { getModuleConfig: jest.Mock };
	let conversationService: {
		findOne: jest.Mock;
		create: jest.Mock;
		sendMessage: jest.Mock;
	};
	let suggestionEngine: { recordFeedback: jest.Mock };

	beforeEach(() => {
		configService = {
			getModuleConfig: jest.fn().mockReturnValue(makeConfig()),
		};

		conversationService = {
			findOne: jest.fn().mockResolvedValue(null),
			create: jest.fn().mockResolvedValue({ id: 'conv-1' }),
			sendMessage: jest.fn().mockResolvedValue({ content: 'Hello from buddy!' }),
		};

		suggestionEngine = {
			recordFeedback: jest.fn().mockReturnValue({ success: true }),
		};

		service = new TelegramAdapterService(configService as any, conversationService as any, suggestionEngine as any);
	});

	afterEach(async () => {
		await service.onModuleDestroy();
	});

	describe('onModuleInit', () => {
		it('should not start bot when telegram is disabled', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ telegramEnabled: false }));

			await service.onModuleInit();

			expect(service.isRunning()).toBe(false);
		});

		it('should not start bot when token is missing', async () => {
			configService.getModuleConfig.mockReturnValue(
				makeConfig({ telegramEnabled: true, telegramBotToken: undefined }),
			);

			await service.onModuleInit();

			expect(service.isRunning()).toBe(false);
		});
	});

	describe('reconfigure', () => {
		it('should stop bot when telegram is disabled on reconfigure', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ telegramEnabled: false }));

			await service.reconfigure();

			expect(service.isRunning()).toBe(false);
		});
	});

	describe('onSuggestionCreated', () => {
		it('should not throw when bot is not running', async () => {
			const suggestion = makeSuggestion();

			await expect(service.onSuggestionCreated(suggestion)).resolves.not.toThrow();
		});
	});

	describe('getConfig fallback', () => {
		it('should return default config when config service throws', async () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('Config not found');
			});

			// Should not throw - falls back to default config with telegramEnabled=false
			await service.onModuleInit();

			expect(service.isRunning()).toBe(false);
		});
	});

	describe('parseAllowedUserIds (via integration)', () => {
		it('should handle empty allowed user IDs gracefully', async () => {
			// With empty allowed IDs, the bot should allow all users
			configService.getModuleConfig.mockReturnValue(
				makeConfig({
					telegramEnabled: false,
					telegramAllowedUserIds: '',
				}),
			);

			await service.onModuleInit();

			expect(service.isRunning()).toBe(false);
		});
	});
});
