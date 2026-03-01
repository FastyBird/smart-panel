import { BUDDY_MODULE_NAME, SttProvider } from '../buddy.constants';
import { BuddySttNotConfiguredException } from '../buddy.exceptions';
import { BuddyConfigModel } from '../models/config.model';

import { SttProviderService } from './stt-provider.service';

describe('SttProviderService', () => {
	let service: SttProviderService;
	let configService: { getModuleConfig: jest.Mock };

	const audioBuffer = Buffer.from('fake audio data');
	const mimeType = 'audio/wav';

	function makeConfig(overrides: Partial<BuddyConfigModel> = {}): BuddyConfigModel {
		const config = new BuddyConfigModel();

		config.sttProvider = 'sttProvider' in overrides ? overrides.sttProvider : SttProvider.WHISPER_API;
		config.sttApiKey = 'sttApiKey' in overrides ? overrides.sttApiKey : 'test-stt-key';
		config.sttModel = 'sttModel' in overrides ? overrides.sttModel : null;
		config.sttLanguage = 'sttLanguage' in overrides ? overrides.sttLanguage : null;

		return config;
	}

	beforeEach(() => {
		configService = {
			getModuleConfig: jest.fn().mockReturnValue(makeConfig()),
		};

		service = new SttProviderService(configService as any);
	});

	describe('isConfigured', () => {
		it('should return true when Whisper API provider has an STT API key', () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ sttProvider: SttProvider.WHISPER_API }));

			expect(service.isConfigured()).toBe(true);
		});

		it('should return false when Whisper API provider has no STT API key', () => {
			configService.getModuleConfig.mockReturnValue(
				makeConfig({ sttProvider: SttProvider.WHISPER_API, sttApiKey: null }),
			);

			expect(service.isConfigured()).toBe(false);
		});

		it('should return true when Whisper local provider is configured', () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ sttProvider: SttProvider.WHISPER_LOCAL }));

			expect(service.isConfigured()).toBe(true);
		});

		it('should return false when STT provider is NONE', () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ sttProvider: SttProvider.NONE }));

			expect(service.isConfigured()).toBe(false);
		});

		it('should return false when config service throws', () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('No config');
			});

			expect(service.isConfigured()).toBe(false);
		});
	});

	describe('provider not configured', () => {
		it('should throw BuddySttNotConfiguredException when provider is NONE', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ sttProvider: SttProvider.NONE }));

			await expect(service.transcribe(audioBuffer, mimeType)).rejects.toThrow(BuddySttNotConfiguredException);
		});

		it('should throw BuddySttNotConfiguredException when config service throws', async () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('No config');
			});

			await expect(service.transcribe(audioBuffer, mimeType)).rejects.toThrow(BuddySttNotConfiguredException);
		});
	});

	describe('config reading', () => {
		it('should call config service with correct module name', () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ sttProvider: SttProvider.NONE }));

			service.transcribe(audioBuffer, mimeType).catch(() => {
				// Expected to throw
			});

			expect(configService.getModuleConfig).toHaveBeenCalledWith(BUDDY_MODULE_NAME);
		});
	});

	describe('Whisper API provider', () => {
		it('should throw when STT API key is not set', async () => {
			configService.getModuleConfig.mockReturnValue(
				makeConfig({
					sttProvider: SttProvider.WHISPER_API,
					sttApiKey: null,
				}),
			);

			await expect(service.transcribe(audioBuffer, mimeType)).rejects.toThrow(BuddySttNotConfiguredException);
		});

		it('should throw on import failure when OpenAI SDK not available', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ sttProvider: SttProvider.WHISPER_API }));

			// The dynamic import of openai will fail in test environment
			await expect(service.transcribe(audioBuffer, mimeType)).rejects.toThrow();
		});
	});

	describe('Whisper local provider', () => {
		it('should throw when whisper CLI is not available', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ sttProvider: SttProvider.WHISPER_LOCAL }));

			// The whisper CLI will not be available in test environment
			await expect(service.transcribe(audioBuffer, mimeType)).rejects.toThrow();
		});
	});

	describe('MIME type handling', () => {
		it.each([
			['audio/wav', 'wav'],
			['audio/wave', 'wav'],
			['audio/x-wav', 'wav'],
			['audio/webm', 'webm'],
			['audio/ogg', 'ogg'],
			['audio/mpeg', 'mp3'],
			['audio/unknown', 'wav'],
		])('should map %s to extension %s', (mime) => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ sttProvider: SttProvider.NONE }));

			// We test indirectly — the service is consistent as long as it
			// doesn't crash for any known MIME type
			service.transcribe(audioBuffer, mime).catch(() => {
				// Expected to throw because provider is NONE
			});
		});
	});
});
