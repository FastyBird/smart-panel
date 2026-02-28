import { BUDDY_MODULE_NAME, LLM_PROVIDER_NONE, MessageRole } from '../buddy.constants';
import { BuddyProviderNotConfiguredException } from '../buddy.exceptions';
import { BuddyConfigModel } from '../models/config.model';
import { ChatMessage, ILlmProvider } from '../platforms/llm-provider.platform';

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

	function makeMockProvider(type: string, sendMessageMock: jest.Mock): ILlmProvider {
		return {
			getType: () => type,
			getName: () => type,
			getDescription: () => `Mock ${type}`,
			getDefaultModel: () => 'mock-model',
			sendMessage: sendMessageMock,
		};
	}

	beforeEach(() => {
		configService = {
			getModuleConfig: jest.fn().mockReturnValue(makeConfig()),
		};

		claudeSendMessage = jest.fn().mockResolvedValue('Hello from mock');
		openaiSendMessage = jest.fn().mockResolvedValue('Hello from mock');

		registry = new LlmProviderRegistryService();
		registry.register(makeMockProvider('buddy-claude-plugin', claudeSendMessage));
		registry.register(makeMockProvider('buddy-openai-plugin', openaiSendMessage));

		service = new LlmProviderService(configService as any, registry);
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

	describe('registered provider delegation', () => {
		it('should delegate to registered Claude provider', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ provider: 'buddy-claude-plugin' }));

			const result = await service.sendMessage(systemPrompt, messages);

			expect(result).toBe('Hello from mock');
		});

		it('should delegate to registered OpenAI provider', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ provider: 'buddy-openai-plugin' }));

			const result = await service.sendMessage(systemPrompt, messages);

			expect(result).toBe('Hello from mock');
		});

		it('should pass the default model from the provider when no model in config', async () => {
			configService.getModuleConfig.mockReturnValue(makeConfig({ provider: 'buddy-claude-plugin' }));

			await service.sendMessage(systemPrompt, messages);

			expect(claudeSendMessage).toHaveBeenCalledWith(
				systemPrompt,
				messages,
				'',
				'mock-model',
				expect.objectContaining({ timeout: 30_000 }),
			);
		});
	});
});
