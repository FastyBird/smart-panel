import { SuggestionType } from '../../../modules/buddy/buddy.constants';
import { BuddyConversationService } from '../../../modules/buddy/services/buddy-conversation.service';
import { BuddySuggestion, SuggestionEngineService } from '../../../modules/buddy/services/suggestion-engine.service';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BUDDY_WHATSAPP_PLUGIN_NAME, WhatsAppConnectionStatus } from '../buddy-whatsapp.constants';
import { BuddyWhatsappConfigModel } from '../models/config.model';

import { WhatsAppBotProvider } from './whatsapp-bot.provider';

jest.mock('@whiskeysockets/baileys', () => ({
	__esModule: true,
	default: jest.fn(),
	DisconnectReason: { loggedOut: 401 },
	fetchLatestBaileysVersion: jest.fn().mockResolvedValue({ version: [2, 3000, 0] }),
	makeCacheableSignalKeyStore: jest.fn().mockReturnValue({}),
	useMultiFileAuthState: jest.fn().mockResolvedValue({
		state: { creds: {}, keys: {} },
		saveCreds: jest.fn(),
	}),
}));

function makeConfig(overrides: Partial<BuddyWhatsappConfigModel> = {}): BuddyWhatsappConfigModel {
	return Object.assign(new BuddyWhatsappConfigModel(), {
		type: BUDDY_WHATSAPP_PLUGIN_NAME,
		enabled: false,
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

		provider = new WhatsAppBotProvider(
			configService as unknown as ConfigService,
			conversationService as unknown as BuddyConversationService,
			suggestionEngine as unknown as SuggestionEngineService,
		);
	});

	afterEach(() => {
		provider.onModuleDestroy();
	});

	describe('onApplicationBootstrap', () => {
		it('should initialize with disabled config', () => {
			configService.getPluginConfig.mockReturnValue(makeConfig({ enabled: false }));

			provider.onApplicationBootstrap();

			expect(provider.getConnectionStatus()).toBe(WhatsAppConnectionStatus.DISCONNECTED);
		});
	});

	describe('onConfigUpdated', () => {
		it('should not restart when config has not changed', () => {
			configService.getPluginConfig.mockReturnValue(makeConfig({ enabled: false }));

			provider.onApplicationBootstrap();

			const stopSpy = jest.spyOn(provider as any, 'stopBot');

			provider.onConfigUpdated();

			expect(stopSpy).not.toHaveBeenCalled();

			stopSpy.mockRestore();
		});
	});

	describe('getConnectionStatus', () => {
		it('should return disconnected by default', () => {
			expect(provider.getConnectionStatus()).toBe(WhatsAppConnectionStatus.DISCONNECTED);
		});
	});

	describe('getCurrentQr', () => {
		it('should return null by default', () => {
			expect(provider.getCurrentQr()).toBeNull();
		});
	});

	describe('isConnected', () => {
		it('should return false by default', () => {
			expect(provider.isConnected()).toBe(false);
		});
	});

	describe('onSuggestionCreated', () => {
		it('should not throw when bot is not connected', async () => {
			const suggestion = makeSuggestion();

			await expect(provider.onSuggestionCreated(suggestion)).resolves.not.toThrow();
		});
	});

	describe('getPluginConfig fallback', () => {
		it('should handle config service throwing', () => {
			configService.getPluginConfig.mockImplementation(() => {
				throw new Error('Config not found');
			});

			provider.onApplicationBootstrap();

			expect(provider.getConnectionStatus()).toBe(WhatsAppConnectionStatus.DISCONNECTED);
		});
	});
});
