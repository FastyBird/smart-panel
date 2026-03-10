import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { BUDDY_MODULE_NAME } from '../buddy.constants';
import {
	BuddyProviderErrorException,
	BuddyProviderNotConfiguredException,
	BuddyProviderTimeoutException,
} from '../buddy.exceptions';
import { BuddyConfigModel } from '../models/config.model';
import { ChatMessage, LlmOptions, LlmResponse } from '../platforms/llm-provider.platform';

import { LlmProviderRegistryService } from './llm-provider-registry.service';

export { ChatMessage, LlmOptions, LlmResponse } from '../platforms/llm-provider.platform';

const DEFAULT_TIMEOUT = 30_000;

@Injectable()
export class LlmProviderService {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'LlmProviderService');

	constructor(
		private readonly configService: ConfigService,
		private readonly providerRegistry: LlmProviderRegistryService,
	) {}

	async sendMessage(systemPrompt: string, messages: ChatMessage[], options?: LlmOptions): Promise<LlmResponse> {
		const config = this.getConfig();
		const providerName = config.provider;

		if (!providerName || providerName === 'none') {
			throw new BuddyProviderNotConfiguredException();
		}

		const provider = this.providerRegistry.get(providerName);

		if (!provider) {
			this.logger.error(
				`LLM provider '${providerName}' is not registered. Available: ${this.providerRegistry.list().join(', ')}`,
			);

			throw new BuddyProviderNotConfiguredException();
		}

		const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
		const model = options?.model ?? provider.getDefaultModel();

		try {
			return await provider.sendMessage(systemPrompt, messages, model, { ...options, timeout });
		} catch (error) {
			return this.handleProviderError(provider.getName(), error, timeout);
		}
	}

	/**
	 * Check if the currently configured provider supports tool use.
	 * Returns false if no provider is configured or the provider doesn't support tools.
	 */
	supportsTools(): boolean {
		try {
			const config = this.getConfig();
			const providerName = config.provider;

			if (!providerName || providerName === 'none') {
				return false;
			}

			const provider = this.providerRegistry.get(providerName);

			return provider?.supportsTools?.() ?? false;
		} catch {
			return false;
		}
	}

	private getConfig(): BuddyConfigModel {
		try {
			return this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);
		} catch {
			return Object.assign(new BuddyConfigModel(), { provider: 'none' });
		}
	}

	private handleProviderError(providerName: string, error: unknown, timeout: number): never {
		const err = error as Error;
		const name = err.name ?? '';
		const message = err.message ?? '';

		const isTimeout =
			name === 'AbortError' ||
			name.includes('Timeout') ||
			message.includes('timeout') ||
			message.includes('timed out') ||
			message.includes('ETIMEDOUT') ||
			message.includes('ECONNABORTED');

		if (isTimeout) {
			this.logger.error(`${providerName} provider timeout after ${timeout}ms`);

			throw new BuddyProviderTimeoutException();
		}

		this.logger.error(`${providerName} provider error: ${message}`);

		throw new BuddyProviderErrorException(message);
	}
}
