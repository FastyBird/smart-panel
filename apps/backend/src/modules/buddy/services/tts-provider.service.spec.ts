import { BUDDY_MODULE_NAME, TTS_AUDIO_CACHE_TTL_MS, TtsProvider } from '../buddy.constants';
import { BuddyTtsNotConfiguredException } from '../buddy.exceptions';
import { BuddyConfigModel } from '../models/config.model';

import { TtsProviderService } from './tts-provider.service';

describe('TtsProviderService', () => {
	let service: TtsProviderService;
	let configService: { getModuleConfig: jest.Mock };

	function makeConfig(overrides: Partial<BuddyConfigModel> = {}): BuddyConfigModel {
		const config = new BuddyConfigModel();

		config.ttsProvider = 'ttsProvider' in overrides ? overrides.ttsProvider : TtsProvider.OPENAI_TTS;
		config.ttsApiKey = 'ttsApiKey' in overrides ? overrides.ttsApiKey : 'test-tts-key';
		config.ttsVoice = 'ttsVoice' in overrides ? overrides.ttsVoice : undefined;
		config.ttsSpeed = 'ttsSpeed' in overrides ? overrides.ttsSpeed : 1.0;

		return config;
	}

	beforeEach(() => {
		configService = {
			getModuleConfig: jest.fn().mockReturnValue(makeConfig()),
		};

		service = new TtsProviderService(configService as any);
	});

	describe('isConfigured', () => {
		it('should return true when OpenAI TTS provider has an API key', () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ ttsProvider: TtsProvider.OPENAI_TTS }));

			expect(service.isConfigured()).toBe(true);
		});

		it('should return false when OpenAI TTS provider has no API key', () => {
			configService.getModuleConfig.mockReturnValue(
				makeConfig({ ttsProvider: TtsProvider.OPENAI_TTS, ttsApiKey: undefined }),
			);

			expect(service.isConfigured()).toBe(false);
		});

		it('should return true when ElevenLabs provider has an API key', () => {
			configService.getModuleConfig.mockReturnValue(
				makeConfig({ ttsProvider: TtsProvider.ELEVENLABS, ttsApiKey: 'eleven-key' }),
			);

			expect(service.isConfigured()).toBe(true);
		});

		it('should return false when ElevenLabs provider has no API key', () => {
			configService.getModuleConfig.mockReturnValue(
				makeConfig({ ttsProvider: TtsProvider.ELEVENLABS, ttsApiKey: undefined }),
			);

			expect(service.isConfigured()).toBe(false);
		});

		it('should return true when system provider is configured', () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ ttsProvider: TtsProvider.SYSTEM }));

			expect(service.isConfigured()).toBe(true);
		});

		it('should return false when TTS provider is NONE', () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ ttsProvider: TtsProvider.NONE }));

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
		it('should throw BuddyTtsNotConfiguredException when provider is NONE', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ ttsProvider: TtsProvider.NONE }));

			await expect(service.synthesize('Hello world', 'msg-1')).rejects.toThrow(BuddyTtsNotConfiguredException);
		});

		it('should throw BuddyTtsNotConfiguredException when config service throws', async () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('No config');
			});

			await expect(service.synthesize('Hello world', 'msg-1')).rejects.toThrow(BuddyTtsNotConfiguredException);
		});
	});

	describe('config reading', () => {
		it('should call config service with correct module name', () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ ttsProvider: TtsProvider.NONE }));

			service.synthesize('Hello', 'msg-1').catch(() => {
				// Expected to throw
			});

			expect(configService.getModuleConfig).toHaveBeenCalledWith(BUDDY_MODULE_NAME);
		});
	});

	describe('OpenAI TTS provider', () => {
		it('should throw when TTS API key is not set', async () => {
			configService.getModuleConfig.mockReturnValue(
				makeConfig({
					ttsProvider: TtsProvider.OPENAI_TTS,
					ttsApiKey: undefined,
				}),
			);

			await expect(service.synthesize('Hello', 'msg-1')).rejects.toThrow(BuddyTtsNotConfiguredException);
		});

		it('should throw on import failure when OpenAI SDK not available', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ ttsProvider: TtsProvider.OPENAI_TTS }));

			// The dynamic import of openai will fail in test environment
			await expect(service.synthesize('Hello world', 'msg-1')).rejects.toThrow();
		});
	});

	describe('ElevenLabs provider', () => {
		it('should throw when TTS API key is not set', async () => {
			configService.getModuleConfig.mockReturnValue(
				makeConfig({
					ttsProvider: TtsProvider.ELEVENLABS,
					ttsApiKey: undefined,
				}),
			);

			await expect(service.synthesize('Hello', 'msg-1')).rejects.toThrow(BuddyTtsNotConfiguredException);
		});
	});

	describe('system provider', () => {
		it('should throw when espeak/piper CLI is not available', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ ttsProvider: TtsProvider.SYSTEM }));

			// The espeak CLI will not be available in test environment
			await expect(service.synthesize('Hello world', 'msg-1')).rejects.toThrow();
		});
	});

	describe('caching', () => {
		const fakeAudio = { buffer: Buffer.from('fake-audio-data'), contentType: 'audio/mpeg' };

		beforeEach(() => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ ttsProvider: TtsProvider.OPENAI_TTS }));
		});

		function mockSynthesizeOpenAi(svc: TtsProviderService, impl?: () => Promise<typeof fakeAudio>): jest.Mock {
			const mock = jest.fn().mockImplementation(impl ?? (() => Promise.resolve({ ...fakeAudio })));

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			(svc as any).synthesizeOpenAi = mock;

			return mock;
		}

		it('should return cached audio for the same message ID', async () => {
			const mock = mockSynthesizeOpenAi(service);

			const first = await service.synthesize('Hello', 'msg-1');
			const second = await service.synthesize('Hello', 'msg-1');

			expect(mock).toHaveBeenCalledTimes(1);
			expect(first.buffer).toEqual(fakeAudio.buffer);
			expect(second.buffer).toEqual(fakeAudio.buffer);
		});

		it('should treat different message IDs as separate cache entries', async () => {
			const mock = mockSynthesizeOpenAi(service);

			await service.synthesize('Hello', 'msg-1');
			await service.synthesize('Hello', 'msg-2');

			expect(mock).toHaveBeenCalledTimes(2);
		});

		it('should re-synthesize after TTL expires', async () => {
			jest.useFakeTimers();

			try {
				const mock = mockSynthesizeOpenAi(service);

				await service.synthesize('Hello', 'msg-1');

				// Advance time past TTL
				jest.setSystemTime(Date.now() + TTS_AUDIO_CACHE_TTL_MS + 1);

				await service.synthesize('Hello', 'msg-1');

				expect(mock).toHaveBeenCalledTimes(2);
			} finally {
				jest.useRealTimers();
			}
		});

		it('should use different cache keys when voice config changes', async () => {
			const mock = mockSynthesizeOpenAi(service);

			await service.synthesize('Hello', 'msg-1');

			configService.getModuleConfig.mockReturnValue(
				makeConfig({ ttsProvider: TtsProvider.OPENAI_TTS, ttsVoice: 'nova' }),
			);

			await service.synthesize('Hello', 'msg-1');

			expect(mock).toHaveBeenCalledTimes(2);
		});

		it('should deduplicate concurrent requests for the same message', async () => {
			let resolveCall!: (value: typeof fakeAudio) => void;

			const mock = mockSynthesizeOpenAi(service, () => new Promise((resolve) => (resolveCall = resolve)));

			const promise1 = service.synthesize('Hello', 'msg-1');
			const promise2 = service.synthesize('Hello', 'msg-1');

			resolveCall({ ...fakeAudio });

			const [result1, result2] = await Promise.all([promise1, promise2]);

			expect(mock).toHaveBeenCalledTimes(1);
			expect(result1.buffer).toEqual(fakeAudio.buffer);
			expect(result2.buffer).toEqual(fakeAudio.buffer);
		});
	});
});
