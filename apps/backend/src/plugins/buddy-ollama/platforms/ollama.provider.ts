import { Injectable } from '@nestjs/common';

import { MessageRole } from '../../../modules/buddy/buddy.constants';
import {
	isChatMessage,
	isLlmAssistantToolCallsItem,
	serializeLlmConversationToolResult,
	validateLlmConversationItems,
} from '../../../modules/buddy/platforms/llm-conversation.utils';
import {
	ILlmProvider,
	LlmConversationItem,
	LlmOptions,
	LlmResponse,
} from '../../../modules/buddy/platforms/llm-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import { LlmToolCall, ToolDefinition } from '../../../modules/tools/platforms/tool-provider.platform';
import {
	BUDDY_OLLAMA_DEFAULT_MODEL,
	BUDDY_OLLAMA_DEFAULT_URL,
	BUDDY_OLLAMA_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_OLLAMA_PLUGIN_NAME,
} from '../buddy-ollama.constants';
import { BuddyOllamaConfigModel } from '../models/config.model';

interface OllamaToolCall {
	function?: { name?: string; arguments?: Record<string, unknown> };
}

interface OllamaResponse {
	message?: { content?: string; tool_calls?: OllamaToolCall[] };
	model?: string;
	prompt_eval_count?: number;
	eval_count?: number;
	done_reason?: string;
}

/** Build the exact JSON payload sent to Ollama's chat endpoint. */
export function buildOllamaRequestPayload(
	model: string,
	systemPrompt: string,
	messages: LlmConversationItem[],
	tools?: ToolDefinition[],
	maxTokens: number = 1024,
): Record<string, unknown> {
	validateLlmConversationItems(messages);

	const nativeMessages = messages.flatMap((message) => {
		if (isChatMessage(message)) {
			return [
				{
					role: message.role === MessageRole.USER ? 'user' : 'assistant',
					content: message.content,
				},
			];
		}

		if (isLlmAssistantToolCallsItem(message)) {
			return [
				{
					role: 'assistant',
					content: message.content,
					tool_calls: message.calls.map((call) => ({
						function: {
							name: call.name,
							arguments: call.arguments,
						},
					})),
				},
			];
		}

		return message.results.map((result) => ({
			role: 'tool',
			content: serializeLlmConversationToolResult(result),
			tool_name: result.toolName,
		}));
	});

	const requestPayload: Record<string, unknown> = {
		model,
		stream: false,
		messages: [{ role: 'system', content: systemPrompt }, ...nativeMessages],
		options: { num_predict: maxTokens },
	};

	if (tools && tools.length > 0) {
		requestPayload.tools = tools.map((tool) => ({
			type: 'function',
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters,
			},
		}));
	}

	return requestPayload;
}

@Injectable()
export class OllamaProvider implements ILlmProvider {
	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_OLLAMA_PLUGIN_NAME;
	}

	getName(): string {
		return 'Ollama';
	}

	getDescription(): string {
		return BUDDY_OLLAMA_PLUGIN_API_TAG_DESCRIPTION;
	}

	getDefaultModel(): string {
		return BUDDY_OLLAMA_DEFAULT_MODEL;
	}

	isConfigured(pluginConfig: Record<string, unknown>): boolean {
		const baseUrl = pluginConfig.baseUrl;

		return typeof baseUrl === 'string' && baseUrl.length > 0;
	}

	supportsTools(): boolean {
		return true;
	}

	supportsNativeToolResults(): boolean {
		return true;
	}

	async sendMessage(
		systemPrompt: string,
		messages: LlmConversationItem[],
		model: string,
		options?: LlmOptions,
	): Promise<LlmResponse> {
		const config = this.getPluginConfig();
		const baseUrl = config?.baseUrl ?? BUDDY_OLLAMA_DEFAULT_URL;
		const resolvedModel = config?.model ?? model;
		const timeout = options?.timeout ?? 30_000;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		const start = Date.now();

		try {
			const requestPayload = buildOllamaRequestPayload(
				resolvedModel,
				systemPrompt,
				messages,
				options?.tools,
				options?.maxTokens ?? 1024,
			);

			const response = await fetch(`${baseUrl}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestPayload),
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`Ollama responded with status ${response.status}`);
			}

			const data = (await response.json()) as OllamaResponse;
			const durationMs = Date.now() - start;

			// Extract tool calls if present
			let toolCalls: LlmToolCall[] | undefined;

			if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
				toolCalls = data.message.tool_calls
					.filter((tc) => tc.function?.name)
					.map((tc, index) => ({
						id: `ollama-${index}`,
						name: tc.function?.name ?? '',
						arguments: tc.function?.arguments ?? {},
					}));
			}

			return {
				content: data.message?.content ?? '',
				toolCalls,
				meta: {
					provider: BUDDY_OLLAMA_PLUGIN_NAME,
					model: data.model ?? null,
					inputTokens: data.prompt_eval_count ?? null,
					outputTokens: data.eval_count ?? null,
					finishReason: data.done_reason ?? null,
					durationMs,
					cacheReadTokens: null,
					cacheWriteTokens: null,
				},
			};
		} finally {
			clearTimeout(timeoutId);
		}
	}

	private getPluginConfig(): BuddyOllamaConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyOllamaConfigModel>(BUDDY_OLLAMA_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
