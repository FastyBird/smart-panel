import { SystemConfigModel } from '../../system/models/config.model';
import { SYSTEM_MODULE_NAME } from '../../system/system.constants';
import { BUDDY_MODULE_NAME, STT_PLUGIN_NONE } from '../buddy.constants';
import { BuddySttNotConfiguredException } from '../buddy.exceptions';
import { BuddyConfigModel } from '../models/config.model';
import type { ISttProvider } from '../platforms/stt-provider.platform';

import { SttProviderRegistryService } from './stt-provider-registry.service';
import { SttProviderService } from './stt-provider.service';

describe('SttProviderService', () => {
	let service: SttProviderService;
	let configService: { getModuleConfig: jest.Mock; getPluginConfig: jest.Mock };
	let sttProviderRegistry: SttProviderRegistryService;

	const audioBuffer = Buffer.from('fake audio data');
	const mimeType = 'audio/wav';

	const mockSttProvider: ISttProvider = {
		getType: () => 'buddy-openai-plugin',
		getName: () => 'Whisper API',
		getDescription: () => 'Test STT provider',
		isConfigured: (config: Record<string, unknown>) => !!config['apiKey'],
		transcribe: jest.fn().mockResolvedValue('Hello world'),
	};

	function makeConfig(overrides: Partial<BuddyConfigModel> = {}): BuddyConfigModel {
		const config = new BuddyConfigModel();

		config.voiceEnabled = 'voiceEnabled' in overrides ? overrides.voiceEnabled : true;
		config.sttPlugin = 'sttPlugin' in overrides ? overrides.sttPlugin : 'buddy-openai-plugin';

		return config;
	}

	function makeSystemConfig(): SystemConfigModel {
		const config = new SystemConfigModel();
		return config;
	}

	beforeEach(() => {
		configService = {
			getModuleConfig: jest.fn().mockImplementation((moduleName: string) => {
				if (moduleName === SYSTEM_MODULE_NAME) return makeSystemConfig();
				return makeConfig();
			}),
			getPluginConfig: jest.fn().mockReturnValue({ apiKey: 'test-key' }),
		};

		sttProviderRegistry = new SttProviderRegistryService();
		sttProviderRegistry.register(mockSttProvider);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		service = new SttProviderService(configService as any, sttProviderRegistry);
	});

	describe('isConfigured', () => {
		it('should return false when voiceEnabled is false', () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ voiceEnabled: false }));

			expect(service.isConfigured()).toBe(false);
		});

		it('should return true when STT plugin is registered and configured', () => {
			expect(service.isConfigured()).toBe(true);
		});

		it('should return false when STT plugin has no credentials', () => {
			configService.getPluginConfig.mockReturnValue({ apiKey: null });

			expect(service.isConfigured()).toBe(false);
		});

		it('should return false when STT plugin is NONE', () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ sttPlugin: STT_PLUGIN_NONE }));

			expect(service.isConfigured()).toBe(false);
		});

		it('should return false when STT plugin is not registered', () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ sttPlugin: 'unknown-plugin' }));

			expect(service.isConfigured()).toBe(false);
		});

		it('should return false when config service throws', () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('No config');
			});

			expect(service.isConfigured()).toBe(false);
		});
	});

	describe('transcribe', () => {
		it('should throw BuddySttNotConfiguredException when voiceEnabled is false', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ voiceEnabled: false }));

			await expect(service.transcribe(audioBuffer, mimeType)).rejects.toThrow(BuddySttNotConfiguredException);
		});

		it('should throw BuddySttNotConfiguredException when plugin is NONE', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ sttPlugin: STT_PLUGIN_NONE }));

			await expect(service.transcribe(audioBuffer, mimeType)).rejects.toThrow(BuddySttNotConfiguredException);
		});

		it('should throw BuddySttNotConfiguredException when plugin is not registered', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ sttPlugin: 'unknown-plugin' }));

			await expect(service.transcribe(audioBuffer, mimeType)).rejects.toThrow(BuddySttNotConfiguredException);
		});

		it('should throw BuddySttNotConfiguredException when config service throws', async () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('No config');
			});

			await expect(service.transcribe(audioBuffer, mimeType)).rejects.toThrow(BuddySttNotConfiguredException);
		});

		it('should delegate to the registered provider', async () => {
			const result = await service.transcribe(audioBuffer, mimeType);

			expect(result).toBe('Hello world');
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockSttProvider.transcribe).toHaveBeenCalledWith(
				audioBuffer,
				mimeType,
				expect.objectContaining({ language: 'en' }),
			);
		});

		it('should throw when provider is not configured', async () => {
			configService.getPluginConfig.mockReturnValue({ apiKey: null });

			await expect(service.transcribe(audioBuffer, mimeType)).rejects.toThrow(BuddySttNotConfiguredException);
		});
	});

	describe('config reading', () => {
		it('should call config service with correct module name', () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ sttPlugin: STT_PLUGIN_NONE }));

			service.transcribe(audioBuffer, mimeType).catch(() => {
				// Expected to throw
			});

			expect(configService.getModuleConfig).toHaveBeenCalledWith(BUDDY_MODULE_NAME);
		});
	});
});
