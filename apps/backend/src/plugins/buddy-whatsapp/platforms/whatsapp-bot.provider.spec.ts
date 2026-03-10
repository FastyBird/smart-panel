import { SuggestionType } from '../../../modules/buddy/buddy.constants';
import { BuddyConversationService } from '../../../modules/buddy/services/buddy-conversation.service';
import { BuddySuggestion, SuggestionEngineService } from '../../../modules/buddy/services/suggestion-engine.service';
import { ConfigService } from '../../../modules/config/services/config.service';
import { PluginServiceManagerService } from '../../../modules/extensions/services/plugin-service-manager.service';
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
	let pluginServiceManager: { restartService: jest.Mock };

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

		pluginServiceManager = {
			restartService: jest.fn().mockResolvedValue(true),
		};

		provider = new WhatsAppBotProvider(
			configService as unknown as ConfigService,
			conversationService as unknown as BuddyConversationService,
			suggestionEngine as unknown as SuggestionEngineService,
			pluginServiceManager as unknown as PluginServiceManagerService,
		);
	});

	afterEach(async () => {
		await provider.stop();
	});

	describe('IManagedPluginService interface', () => {
		it('should have correct pluginName and serviceId', () => {
			expect(provider.pluginName).toBe(BUDDY_WHATSAPP_PLUGIN_NAME);
			expect(provider.serviceId).toBe('bot');
		});

		it('should return stopped state by default', () => {
			expect(provider.getState()).toBe('stopped');
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
		it('should handle config service throwing', async () => {
			configService.getPluginConfig.mockImplementation(() => {
				throw new Error('Config not found');
			});

			await expect(provider.start()).rejects.toThrow();

			expect(provider.getState()).toBe('error');
			expect(provider.getConnectionStatus()).toBe(WhatsAppConnectionStatus.DISCONNECTED);
		});
	});

	describe('onConfigChanged while starting', () => {
		it('should signal restart when config changes during starting state (QR scan)', async () => {
			// Setup: makeWASocket returns a mock that never fires connection=open,
			// so start() resolves while state is still 'starting'
			const mockSocket = {
				ev: {
					on: jest.fn(),
				},
				end: jest.fn(),
			};

			const baileys = await import('@whiskeysockets/baileys');

			(baileys.default as jest.Mock).mockReturnValue(mockSocket);

			await provider.start();

			// After start(), state should be 'starting' (no connection.update fired)
			expect(provider.getState()).toBe('starting');

			// Now change the config (different allowedPhoneNumbers)
			configService.getPluginConfig.mockReturnValue(makeConfig({ allowedPhoneNumbers: '+1234567890' }));

			const result = await provider.onConfigChanged();

			expect(result).toEqual({ restartRequired: true });
		});

		it('should not signal restart when config is unchanged during starting state', async () => {
			const mockSocket = {
				ev: {
					on: jest.fn(),
				},
				end: jest.fn(),
			};

			const baileys = await import('@whiskeysockets/baileys');

			(baileys.default as jest.Mock).mockReturnValue(mockSocket);

			await provider.start();

			expect(provider.getState()).toBe('starting');

			// Config hasn't changed (allowedPhoneNumbers is still null)
			const result = await provider.onConfigChanged();

			expect(result).toEqual({ restartRequired: false });
		});
	});
});
