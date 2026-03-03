/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '../../config/services/config.service';
import { BUDDY_MODULE_NAME, LLM_PROVIDER_NONE } from '../buddy.constants';
import { BuddyConfigModel } from '../models/config.model';
import { ProviderStatusDataModel } from '../models/provider-status.model';
import { ILlmProvider } from '../platforms/llm-provider.platform';

import { BuddyProviderStatusService } from './buddy-provider-status.service';
import { LlmProviderRegistryService } from './llm-provider-registry.service';

describe('BuddyProviderStatusService', () => {
	let service: BuddyProviderStatusService;
	let registry: LlmProviderRegistryService;
	let configService: { getModuleConfig: jest.Mock; getPluginConfig: jest.Mock };

	function makeModuleConfig(overrides: Partial<BuddyConfigModel> = {}): BuddyConfigModel {
		const config = new BuddyConfigModel();

		config.provider = overrides.provider ?? LLM_PROVIDER_NONE;

		return config;
	}

	function makeMockProvider(overrides: Partial<Record<string, unknown>> = {}): ILlmProvider {
		return {
			getType: jest.fn().mockReturnValue(overrides.type ?? 'buddy-test-plugin'),
			getName: jest.fn().mockReturnValue(overrides.name ?? 'Test Provider'),
			getDescription: jest.fn().mockReturnValue(overrides.description ?? 'A test LLM provider'),
			getDefaultModel: jest.fn().mockReturnValue(overrides.defaultModel ?? 'test-model-v1'),
			isConfigured: jest.fn().mockReturnValue(overrides.isConfigured ?? false),
			sendMessage: jest.fn(),
		};
	}

	beforeEach(() => {
		configService = {
			getModuleConfig: jest.fn().mockReturnValue(makeModuleConfig()),
			getPluginConfig: jest.fn(),
		};

		registry = new LlmProviderRegistryService();

		service = new BuddyProviderStatusService(registry, configService as unknown as ConfigService);
	});

	it('should return an empty array when no providers are registered', () => {
		const result = service.getProviderStatuses();

		expect(result).toEqual([]);
	});

	it('should return provider with correct type, name, description, and defaultModel', () => {
		const provider = makeMockProvider({
			type: 'buddy-openai-plugin',
			name: 'OpenAI',
			description: 'OpenAI GPT provider',
			defaultModel: 'gpt-4o',
		});

		registry.register(provider);

		configService.getPluginConfig.mockReturnValue({ enabled: true });

		const result = service.getProviderStatuses();

		expect(result).toHaveLength(1);
		expect(result[0].type).toBe('buddy-openai-plugin');
		expect(result[0].name).toBe('OpenAI');
		expect(result[0].description).toBe('OpenAI GPT provider');
		expect(result[0].defaultModel).toBe('gpt-4o');
	});

	it('should mark the selected provider based on module config', () => {
		const provider = makeMockProvider({ type: 'buddy-claude-plugin' });

		registry.register(provider);

		configService.getModuleConfig.mockReturnValue(makeModuleConfig({ provider: 'buddy-claude-plugin' }));
		configService.getPluginConfig.mockReturnValue({ enabled: true });

		const result = service.getProviderStatuses();

		expect(result).toHaveLength(1);
		expect(result[0].selected).toBe(true);
	});

	it('should not mark a provider as selected when it is not the configured provider', () => {
		const provider = makeMockProvider({ type: 'buddy-openai-plugin' });

		registry.register(provider);

		configService.getModuleConfig.mockReturnValue(makeModuleConfig({ provider: 'buddy-claude-plugin' }));
		configService.getPluginConfig.mockReturnValue({ enabled: true });

		const result = service.getProviderStatuses();

		expect(result).toHaveLength(1);
		expect(result[0].selected).toBe(false);
	});

	it('should set enabled from plugin config', () => {
		const provider = makeMockProvider({ type: 'buddy-openai-plugin' });

		registry.register(provider);

		configService.getPluginConfig.mockReturnValue({ enabled: true });

		const result = service.getProviderStatuses();

		expect(result).toHaveLength(1);
		expect(result[0].enabled).toBe(true);
	});

	it('should set enabled to false when plugin config has enabled=false', () => {
		const provider = makeMockProvider({ type: 'buddy-openai-plugin' });

		registry.register(provider);

		configService.getPluginConfig.mockReturnValue({ enabled: false });

		const result = service.getProviderStatuses();

		expect(result).toHaveLength(1);
		expect(result[0].enabled).toBe(false);
	});

	it('should call provider.isConfigured(pluginConfig) to set configured status', () => {
		const provider = makeMockProvider({ type: 'buddy-openai-plugin', isConfigured: true });

		registry.register(provider);

		const pluginConfig = { enabled: true, apiKey: 'sk-test-123' };

		configService.getPluginConfig.mockReturnValue(pluginConfig);

		const result = service.getProviderStatuses();

		expect(provider.isConfigured).toHaveBeenCalledWith(pluginConfig);
		expect(result[0].configured).toBe(true);
	});

	it('should handle missing module config gracefully and default provider to none', () => {
		const provider = makeMockProvider({ type: 'buddy-openai-plugin' });

		registry.register(provider);

		configService.getModuleConfig.mockImplementation(() => {
			throw new Error('Config not found');
		});
		configService.getPluginConfig.mockReturnValue({ enabled: true });

		const result = service.getProviderStatuses();

		expect(result).toHaveLength(1);
		expect(result[0].selected).toBe(false);
	});

	it('should handle missing plugin config gracefully with enabled=false and configured=false', () => {
		const provider = makeMockProvider({ type: 'buddy-openai-plugin' });

		registry.register(provider);

		configService.getPluginConfig.mockImplementation(() => {
			throw new Error('Plugin config not found');
		});

		const result = service.getProviderStatuses();

		expect(result).toHaveLength(1);
		expect(result[0].enabled).toBe(false);
		expect(result[0].configured).toBe(false);
	});

	it('should handle multiple providers', () => {
		const openai = makeMockProvider({
			type: 'buddy-openai-plugin',
			name: 'OpenAI',
			defaultModel: 'gpt-4o',
		});
		const claude = makeMockProvider({
			type: 'buddy-claude-plugin',
			name: 'Claude',
			defaultModel: 'claude-sonnet-4-20250514',
		});

		registry.register(openai);
		registry.register(claude);

		configService.getModuleConfig.mockReturnValue(makeModuleConfig({ provider: 'buddy-claude-plugin' }));
		configService.getPluginConfig.mockImplementation((type: string) => {
			if (type === 'buddy-openai-plugin') {
				return { enabled: true };
			}

			if (type === 'buddy-claude-plugin') {
				return { enabled: true };
			}

			throw new Error('Unknown plugin');
		});

		const result = service.getProviderStatuses();

		expect(result).toHaveLength(2);

		const openaiStatus = result.find((s) => s.type === 'buddy-openai-plugin');
		const claudeStatus = result.find((s) => s.type === 'buddy-claude-plugin');

		expect(openaiStatus).toBeDefined();
		expect(openaiStatus!.selected).toBe(false);
		expect(openaiStatus!.name).toBe('OpenAI');

		expect(claudeStatus).toBeDefined();
		expect(claudeStatus!.selected).toBe(true);
		expect(claudeStatus!.name).toBe('Claude');
	});

	it('should show enabled=false and configured=false when provider has no config', () => {
		const provider = makeMockProvider({ type: 'buddy-ollama-plugin' });

		registry.register(provider);

		configService.getPluginConfig.mockImplementation(() => {
			throw new Error('No config');
		});

		const result = service.getProviderStatuses();

		expect(result).toHaveLength(1);
		expect(result[0].enabled).toBe(false);
		expect(result[0].configured).toBe(false);
		expect(provider.isConfigured).not.toHaveBeenCalled();
	});

	it('should default provider to none when config throws', () => {
		const provider = makeMockProvider({ type: LLM_PROVIDER_NONE });

		registry.register(provider);

		configService.getModuleConfig.mockImplementation(() => {
			throw new Error('Config corrupted');
		});
		configService.getPluginConfig.mockReturnValue({ enabled: false });

		const result = service.getProviderStatuses();

		expect(result).toHaveLength(1);
		expect(result[0].type).toBe(LLM_PROVIDER_NONE);
		expect(result[0].selected).toBe(true);
	});

	it('should call getModuleConfig with BUDDY_MODULE_NAME', () => {
		service.getProviderStatuses();

		expect(configService.getModuleConfig).toHaveBeenCalledWith(BUDDY_MODULE_NAME);
	});

	it('should call getPluginConfig with the provider type', () => {
		const provider = makeMockProvider({ type: 'buddy-openai-plugin' });

		registry.register(provider);

		configService.getPluginConfig.mockReturnValue({ enabled: false });

		service.getProviderStatuses();

		expect(configService.getPluginConfig).toHaveBeenCalledWith('buddy-openai-plugin');
	});

	it('should return ProviderStatusDataModel instances', () => {
		const provider = makeMockProvider({ type: 'buddy-openai-plugin' });

		registry.register(provider);

		configService.getPluginConfig.mockReturnValue({ enabled: true });

		const result = service.getProviderStatuses();

		expect(result).toHaveLength(1);
		expect(result[0]).toBeInstanceOf(ProviderStatusDataModel);
	});
});
