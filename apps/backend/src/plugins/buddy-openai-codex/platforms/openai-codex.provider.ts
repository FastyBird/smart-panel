import { Injectable, Logger } from '@nestjs/common';

import { ChatMessage, ILlmProvider, LlmOptions } from '../../../modules/buddy/platforms/llm-provider.platform';
import { OAuthTokenManager } from '../../../modules/buddy/platforms/oauth-token-manager';
import { sendOpenAiMessage } from '../../../modules/buddy/platforms/openai-sdk.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	BUDDY_OPENAI_CODEX_DEFAULT_MODEL,
	BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_NAME,
	BUDDY_OPENAI_CODEX_PLUGIN_NAME,
	BUDDY_OPENAI_CODEX_TOKEN_URL,
} from '../buddy-openai-codex.constants';
import { BuddyOpenaiCodexConfigModel } from '../models/config.model';

@Injectable()
export class OpenAiCodexProvider implements ILlmProvider {
	private readonly logger = new Logger(OpenAiCodexProvider.name);
	private readonly tokenManager = new OAuthTokenManager({
		tokenUrl: BUDDY_OPENAI_CODEX_TOKEN_URL,
		providerLabel: 'OpenAiCodex',
	});

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_OPENAI_CODEX_PLUGIN_NAME;
	}

	getName(): string {
		return BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_NAME;
	}

	getDescription(): string {
		return BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_DESCRIPTION;
	}

	getDefaultModel(): string {
		return BUDDY_OPENAI_CODEX_DEFAULT_MODEL;
	}

	async sendMessage(
		systemPrompt: string,
		messages: ChatMessage[],
		model: string,
		options?: LlmOptions,
	): Promise<string> {
		const config = this.getPluginConfig();
		const accessToken = await this.tokenManager.resolveAccessToken(config);
		const resolvedModel = config?.model ?? model;
		const timeout = options?.timeout ?? 30_000;

		return sendOpenAiMessage(accessToken, resolvedModel, systemPrompt, messages, timeout);
	}

	private getPluginConfig(): BuddyOpenaiCodexConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyOpenaiCodexConfigModel>(BUDDY_OPENAI_CODEX_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
