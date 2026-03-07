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
	BUDDY_CLAUDE_DEFAULT_MODEL,
	BUDDY_CLAUDE_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_CLAUDE_PLUGIN_NAME,
} from '../buddy-claude.constants';
import { BuddyClaudeConfigModel } from '../models/config.model';

@Injectable()
export class ClaudeProvider implements ILlmProvider {
	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_CLAUDE_PLUGIN_NAME;
	}

	getName(): string {
		return 'Claude';
	}

	getDescription(): string {
		return BUDDY_CLAUDE_PLUGIN_API_TAG_DESCRIPTION;
	}

	getDefaultModel(): string {
		return BUDDY_CLAUDE_DEFAULT_MODEL;
	}

	isConfigured(pluginConfig: Record<string, unknown>): boolean {
		const apiKey = pluginConfig.apiKey;

		return typeof apiKey === 'string' && apiKey.length > 0;
	}

	async sendMessage(
		systemPrompt: string,
		messages: ChatMessage[],
		model: string,
		options?: LlmOptions,
	): Promise<LlmResponse> {
		const config = this.getPluginConfig();
		const apiKey = config?.apiKey ?? '';
		const resolvedModel = config?.model ?? model;
		const timeout = options?.timeout ?? 30_000;

		const start = Date.now();
		const maxTokens = options?.maxTokens ?? 1024;
		const result = await sendAnthropicMessage({ apiKey }, resolvedModel, systemPrompt, messages, timeout, maxTokens);
		const durationMs = Date.now() - start;

		return {
			content: result.content,
			meta: {
				provider: BUDDY_CLAUDE_PLUGIN_NAME,
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

	private getPluginConfig(): BuddyClaudeConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyClaudeConfigModel>(BUDDY_CLAUDE_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
