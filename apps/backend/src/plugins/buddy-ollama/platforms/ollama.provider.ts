import { Injectable } from '@nestjs/common';

import { MessageRole } from '../../../modules/buddy/buddy.constants';
import {
	ChatMessage,
	ILlmProvider,
	LlmOptions,
	LlmResponse,
} from '../../../modules/buddy/platforms/llm-provider.platform';
import { LlmToolCall, ToolDefinition } from '../../../modules/tools/platforms/tool-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
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

	async sendMessage(
		systemPrompt: string,
		messages: ChatMessage[],
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
			const requestPayload: Record<string, unknown> = {
				model: resolvedModel,
				stream: false,
				messages: [
					{ role: 'system', content: systemPrompt },
					...messages.map((m) => ({
						role: m.role === MessageRole.USER ? 'user' : 'assistant',
						content: m.content,
					})),
				],
			};

			if (options?.tools && options.tools.length > 0) {
				requestPayload.tools = this.formatTools(options.tools);
			}

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
						name: tc.function!.name!,
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

	private formatTools(tools: ToolDefinition[]): unknown[] {
		return tools.map((t) => ({
			type: 'function',
			function: {
				name: t.name,
				description: t.description,
				parameters: t.parameters,
			},
		}));
	}

	private getPluginConfig(): BuddyOllamaConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyOllamaConfigModel>(BUDDY_OLLAMA_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
