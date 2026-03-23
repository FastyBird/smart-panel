import { ConfigService } from '../../config/services/config.service';
import { BUDDY_MODULE_NAME, LLM_PROVIDER_NONE, MessageRole } from '../buddy.constants';
import {
	BuddyProviderErrorException,
	BuddyProviderNotConfiguredException,
	BuddyProviderTimeoutException,
} from '../buddy.exceptions';
import { BuddyConfigModel } from '../models/config.model';
import { ChatMessage, ILlmProvider, LlmResponse } from '../platforms/llm-provider.platform';

import { LlmProviderRegistryService } from './llm-provider-registry.service';
import { LlmProviderService } from './llm-provider.service';

describe('LlmProviderService', () => {
	let service: LlmProviderService;
	let configService: { getModuleConfig: jest.Mock };
	let registry: LlmProviderRegistryService;

	const systemPrompt = 'You are a helpful assistant';
	const messages: ChatMessage[] = [{ role: MessageRole.USER, content: 'Hello' }];

	function makeConfig(overrides: Partial<BuddyConfigModel> = {}): BuddyConfigModel {
		const config = new BuddyConfigModel();

		config.provider = overrides.provider ?? 'buddy-claude-plugin';

		return config;
	}

	let claudeSendMessage: jest.Mock;
	let openaiSendMessage: jest.Mock;

	function mockLlmResponse(content: string, provider: string = 'mock-provider'): LlmResponse {
		return {
			content,
			meta: {
				provider,
				model: 'mock-model',
				inputTokens: 10,
				outputTokens: 5,
				finishReason: 'end_turn',
				durationMs: 100,
				cacheReadTokens: null,
				cacheWriteTokens: null,
			},
		};
	}

	function makeMockProvider(type: string, sendMessageMock: jest.Mock): ILlmProvider {
		return {
			getType: () => type,
			getName: () => type,
			getDescription: () => `Mock ${type}`,
			getDefaultModel: () => 'mock-model',
			isConfigured: () => true,
			sendMessage: sendMessageMock,
		};
	}

	beforeEach(() => {
		configService = {
			getModuleConfig: jest.fn().mockReturnValue(makeConfig()),
		};

		claudeSendMessage = jest.fn().mockResolvedValue(mockLlmResponse('Hello from mock', 'buddy-claude-plugin'));
		openaiSendMessage = jest.fn().mockResolvedValue(mockLlmResponse('Hello from mock', 'buddy-openai-plugin'));

		registry = new LlmProviderRegistryService();
		registry.register(makeMockProvider('buddy-claude-plugin', claudeSendMessage));
		registry.register(makeMockProvider('buddy-openai-plugin', openaiSendMessage));

		service = new LlmProviderService(configService as unknown as ConfigService, registry);
	});

	describe('provider not configured', () => {
		it('should throw BuddyProviderNotConfiguredException when provider is none', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ provider: LLM_PROVIDER_NONE }));

			await expect(service.sendMessage(systemPrompt, messages)).rejects.toThrow(BuddyProviderNotConfiguredException);
		});

		it('should throw BuddyProviderNotConfiguredException when config service throws', async () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('No config');
			});

			// When config throws, it falls back to 'none' provider
			await expect(service.sendMessage(systemPrompt, messages)).rejects.toThrow(BuddyProviderNotConfiguredException);
		});

		it('should throw BuddyProviderNotConfiguredException when provider not registered', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ provider: 'unknown-plugin' }));

			await expect(service.sendMessage(systemPrompt, messages)).rejects.toThrow(BuddyProviderNotConfiguredException);
		});
	});

	describe('provider selection', () => {
		it('should call the correct config key', () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ provider: LLM_PROVIDER_NONE }));

			service.sendMessage(systemPrompt, messages).catch(() => {
				// Expected to throw
			});

			expect(configService.getModuleConfig).toHaveBeenCalledWith(BUDDY_MODULE_NAME);
		});
	});

	describe('timeout enforcement', () => {
		it('should throw BuddyProviderTimeoutException when provider exceeds timeout', async () => {
			jest.useFakeTimers();

			try {
				const config = makeConfig();
				config.llmTimeoutMs = 5_000;
				configService.getModuleConfig.mockReturnValue(config);

				claudeSendMessage.mockImplementation(
					() => new Promise((resolve) => setTimeout(() => resolve(mockLlmResponse('late')), 30_000)),
				);

				const promise = service.sendMessage(systemPrompt, messages);

				jest.advanceTimersByTime(5_000);

				await expect(promise).rejects.toThrow(BuddyProviderTimeoutException);
			} finally {
				jest.useRealTimers();
			}
		});

		it('should return normally when provider responds within timeout', async () => {
			const result = await service.sendMessage(systemPrompt, messages);

			expect(result.content).toBe('Hello from mock');
		});

		it('should throw BuddyProviderErrorException for non-timeout provider errors', async () => {
			claudeSendMessage.mockRejectedValue(new Error('Connection refused'));

			await expect(service.sendMessage(systemPrompt, messages)).rejects.toThrow(BuddyProviderErrorException);
		});
	});

	describe('registered provider delegation', () => {
		it('should delegate to registered Claude provider', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ provider: 'buddy-claude-plugin' }));

			const result = await service.sendMessage(systemPrompt, messages);

			expect(result.content).toBe('Hello from mock');
			expect(result.meta.provider).toBe('buddy-claude-plugin');
		});

		it('should delegate to registered OpenAI provider', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ provider: 'buddy-openai-plugin' }));

			const result = await service.sendMessage(systemPrompt, messages);

			expect(result.content).toBe('Hello from mock');
			expect(result.meta.provider).toBe('buddy-openai-plugin');
		});

		it('should pass the default model from the provider when no model in config', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ provider: 'buddy-claude-plugin' }));

			await service.sendMessage(systemPrompt, messages);

			expect(claudeSendMessage).toHaveBeenCalledWith(
				systemPrompt,
				messages,
				'mock-model',
				expect.objectContaining({ timeout: 60_000 }),
			);
		});
	});
});
