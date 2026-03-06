import { SYSTEM_MODULE_NAME } from '../../system/system.constants';
import { SystemConfigModel } from '../../system/models/config.model';
import { BUDDY_MODULE_NAME, TTS_AUDIO_CACHE_TTL_MS, TTS_PLUGIN_NONE } from '../buddy.constants';
import { BuddyTtsNotConfiguredException } from '../buddy.exceptions';
import { BuddyConfigModel } from '../models/config.model';

import { TtsProviderRegistryService } from './tts-provider-registry.service';
import { TtsProviderService } from './tts-provider.service';

describe('TtsProviderService', () => {
	let service: TtsProviderService;
	let configService: { getModuleConfig: jest.Mock; getPluginConfig: jest.Mock };
	let ttsProviderRegistry: { get: jest.Mock; register: jest.Mock; list: jest.Mock };
	let mockProvider: { synthesize: jest.Mock; isConfigured: jest.Mock; getType: jest.Mock };

	const fakeAudio = { buffer: Buffer.from('fake-audio-data'), contentType: 'audio/wav' };

	function makeConfig(overrides: Record<string, unknown> = {}): BuddyConfigModel {
		const config = new BuddyConfigModel();

		config.ttsPlugin = (overrides['ttsPlugin'] as string) ?? 'buddy-openai-plugin';
		config.voiceEnabled = (overrides['voiceEnabled'] as boolean) ?? true;

		return config;
	}

	beforeEach(() => {
		mockProvider = {
			synthesize: jest.fn().mockResolvedValue({ ...fakeAudio }),
			isConfigured: jest.fn().mockReturnValue(true),
			getType: jest.fn().mockReturnValue('buddy-openai-plugin'),
		};

		configService = {
			getModuleConfig: jest.fn().mockImplementation((moduleName: string) => {
				if (moduleName === SYSTEM_MODULE_NAME) return new SystemConfigModel();
				return makeConfig();
			}),
			getPluginConfig: jest.fn().mockReturnValue({ enabled: true }),
		};

		ttsProviderRegistry = {
			get: jest.fn().mockReturnValue(mockProvider),
			register: jest.fn(),
			list: jest.fn().mockReturnValue([mockProvider]),
		};

		service = new TtsProviderService(
			configService as any,
			ttsProviderRegistry as unknown as TtsProviderRegistryService,
		);
	});

	describe('isConfigured', () => {
		it('should return true when voice is enabled and provider is registered and configured', () => {
			expect(service.isConfigured()).toBe(true);
		});

		it('should return false when voiceEnabled is false', () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ voiceEnabled: false }));

			expect(service.isConfigured()).toBe(false);
		});

		it('should return false when ttsPlugin is none', () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ ttsPlugin: TTS_PLUGIN_NONE }));

			expect(service.isConfigured()).toBe(false);
		});

		it('should return false when provider is not registered', () => {
			ttsProviderRegistry.get.mockReturnValue(null);

			expect(service.isConfigured()).toBe(false);
		});

		it('should return false when provider is not configured', () => {
			mockProvider.isConfigured.mockReturnValue(false);

			expect(service.isConfigured()).toBe(false);
		});

		it('should return false when config service throws', () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('No config');
			});

			expect(service.isConfigured()).toBe(false);
		});
	});

	describe('synthesize', () => {
		it('should delegate to the registered provider', async () => {
			const result = await service.synthesize('Hello world', 'msg-1');

			expect(result.buffer).toEqual(fakeAudio.buffer);
			expect(result.contentType).toBe('audio/wav');
			expect(ttsProviderRegistry.get).toHaveBeenCalledWith('buddy-openai-plugin');
			expect(mockProvider.synthesize).toHaveBeenCalledWith('Hello world', expect.objectContaining({}));
		});

		it('should throw BuddyTtsNotConfiguredException when voiceEnabled is false', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ voiceEnabled: false }));

			await expect(service.synthesize('Hello', 'msg-1')).rejects.toThrow(BuddyTtsNotConfiguredException);
		});

		it('should throw BuddyTtsNotConfiguredException when ttsPlugin is none', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ ttsPlugin: TTS_PLUGIN_NONE }));

			await expect(service.synthesize('Hello', 'msg-1')).rejects.toThrow(BuddyTtsNotConfiguredException);
		});

		it('should throw BuddyTtsNotConfiguredException when provider not registered', async () => {
			ttsProviderRegistry.get.mockReturnValue(null);

			await expect(service.synthesize('Hello', 'msg-1')).rejects.toThrow(BuddyTtsNotConfiguredException);
		});

		it('should throw BuddyTtsNotConfiguredException when config service throws', async () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('No config');
			});

			await expect(service.synthesize('Hello', 'msg-1')).rejects.toThrow(BuddyTtsNotConfiguredException);
		});

		it('should call config service with correct module name', async () => {
			await service.synthesize('Hello', 'msg-1');

			expect(configService.getModuleConfig).toHaveBeenCalledWith(BUDDY_MODULE_NAME);
		});
	});

	describe('caching', () => {
		it('should return cached audio for the same message ID', async () => {
			const first = await service.synthesize('Hello', 'msg-1');
			const second = await service.synthesize('Hello', 'msg-1');

			expect(mockProvider.synthesize).toHaveBeenCalledTimes(1);
			expect(first.buffer).toEqual(fakeAudio.buffer);
			expect(second.buffer).toEqual(fakeAudio.buffer);
		});

		it('should treat different message IDs as separate cache entries', async () => {
			await service.synthesize('Hello', 'msg-1');
			await service.synthesize('Hello', 'msg-2');

			expect(mockProvider.synthesize).toHaveBeenCalledTimes(2);
		});

		it('should re-synthesize after TTL expires', async () => {
			jest.useFakeTimers();

			try {
				await service.synthesize('Hello', 'msg-1');

				// Advance time past TTL
				jest.setSystemTime(Date.now() + TTS_AUDIO_CACHE_TTL_MS + 1);

				await service.synthesize('Hello', 'msg-1');

				expect(mockProvider.synthesize).toHaveBeenCalledTimes(2);
			} finally {
				jest.useRealTimers();
			}
		});

		it('should deduplicate concurrent requests for the same message', async () => {
			let resolveCall!: (value: typeof fakeAudio) => void;

			mockProvider.synthesize.mockImplementation(() => new Promise((resolve) => (resolveCall = resolve)));

			const promise1 = service.synthesize('Hello', 'msg-1');
			const promise2 = service.synthesize('Hello', 'msg-1');

			resolveCall({ ...fakeAudio });

			const [result1, result2] = await Promise.all([promise1, promise2]);

			expect(mockProvider.synthesize).toHaveBeenCalledTimes(1);
			expect(result1.buffer).toEqual(fakeAudio.buffer);
			expect(result2.buffer).toEqual(fakeAudio.buffer);
		});
	});
});
