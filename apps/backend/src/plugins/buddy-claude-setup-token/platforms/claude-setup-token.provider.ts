import { Injectable } from '@nestjs/common';

import { sendAnthropicMessage } from '../../../modules/buddy/platforms/anthropic-sdk.utils';
import {
	ChatMessage,
	ILlmProvider,
	LlmOptions,
	LlmResponse,
} from '../../../modules/buddy/platforms/llm-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	BUDDY_CLAUDE_SETUP_TOKEN_DEFAULT_MODEL,
	BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME,
} from '../buddy-claude-setup-token.constants';
import { BuddyClaudeSetupTokenConfigModel } from '../models/config.model';

@Injectable()
export class ClaudeSetupTokenProvider implements ILlmProvider {
	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME;
	}

	getName(): string {
		return 'Claude Setup Token';
	}

	getDescription(): string {
		return BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_API_TAG_DESCRIPTION;
	}

	getDefaultModel(): string {
		return BUDDY_CLAUDE_SETUP_TOKEN_DEFAULT_MODEL;
	}

	isConfigured(pluginConfig: Record<string, unknown>): boolean {
		const accessToken = pluginConfig.accessToken;

		return typeof accessToken === 'string' && accessToken.length > 0;
	}

	async sendMessage(
		systemPrompt: string,
		messages: ChatMessage[],
		model: string,
		options?: LlmOptions,
	): Promise<LlmResponse> {
		const config = this.getPluginConfig();
		const accessToken = config?.accessToken?.replace(/\s+/g, '');

		if (!accessToken) {
			throw new Error('Claude setup-token is not configured');
		}

		const resolvedModel = config?.model ?? model;
		const timeout = options?.timeout ?? 30_000;
		const maxTokens = options?.maxTokens ?? 1024;

		const start = Date.now();
		const result = await sendAnthropicMessage(
			{ authToken: accessToken },
			resolvedModel,
			systemPrompt,
			messages,
			timeout,
			maxTokens,
		);
		const durationMs = Date.now() - start;

		return {
			content: result.content,
			meta: {
				provider: BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME,
				model: result.model,
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens,
				finishReason: result.finishReason,
				durationMs,
				cacheReadTokens: result.cacheReadTokens,
				cacheWriteTokens: result.cacheWriteTokens,
			},
		};
	}

	private getPluginConfig(): BuddyClaudeSetupTokenConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyClaudeSetupTokenConfigModel>(BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
