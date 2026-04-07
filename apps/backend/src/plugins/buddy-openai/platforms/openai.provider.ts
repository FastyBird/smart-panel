import { Injectable } from '@nestjs/common';

import {
	ChatMessage,
	ILlmProvider,
	LlmOptions,
	LlmResponse,
} from '../../../modules/buddy/platforms/llm-provider.platform';
import { sendOpenAiMessage } from '../../../modules/buddy/platforms/openai-sdk.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	BUDDY_OPENAI_DEFAULT_MODEL,
	BUDDY_OPENAI_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_OPENAI_PLUGIN_NAME,
} from '../buddy-openai.constants';
import { BuddyOpenaiConfigModel } from '../models/config.model';

@Injectable()
export class OpenAiProvider implements ILlmProvider {
	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_OPENAI_PLUGIN_NAME;
	}

	getName(): string {
		return 'OpenAI';
	}

	getDescription(): string {
		return BUDDY_OPENAI_PLUGIN_API_TAG_DESCRIPTION;
	}

	getDefaultModel(): string {
		return BUDDY_OPENAI_DEFAULT_MODEL;
	}

	isConfigured(pluginConfig: Record<string, unknown>): boolean {
		const apiKey = pluginConfig.apiKey;

		return typeof apiKey === 'string' && apiKey.length > 0;
	}

	supportsTools(): boolean {
		return true;
	}

	async sendMessage(
		systemPrompt: string,
		messages: ChatMessage[],
		model: string,
		options?: LlmOptions,
	): Promise<LlmResponse> {
		const config = this.getPluginConfig();
		const apiKey = config?.apiKey;

		if (!apiKey) {
			throw new Error('OpenAI API key is not configured');
		}

		const resolvedModel = config?.model ?? model;
		const timeout = options?.timeout ?? 30_000;

		const maxTokens = options?.maxTokens ?? 1024;

		const start = Date.now();
		const result = await sendOpenAiMessage(
			apiKey,
			resolvedModel,
			systemPrompt,
			messages,
			timeout,
			maxTokens,
			options?.tools,
		);
		const durationMs = Date.now() - start;

		return {
			content: result.content,
			toolCalls: result.toolCalls,
			toolErrors: result.toolErrors?.map((e) => ({
				toolCallId: e.toolCallId,
				toolName: e.toolName,
				error: e.error,
			})),
			meta: {
				provider: BUDDY_OPENAI_PLUGIN_NAME,
				model: result.model,
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens,
				finishReason: result.finishReason,
				durationMs,
				cacheReadTokens: null,
				cacheWriteTokens: null,
			},
		};
	}

	private getPluginConfig(): BuddyOpenaiConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyOpenaiConfigModel>(BUDDY_OPENAI_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
