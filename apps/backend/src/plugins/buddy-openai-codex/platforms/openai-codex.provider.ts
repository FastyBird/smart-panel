import { Injectable } from '@nestjs/common';

import { MessageRole } from '../../../modules/buddy/buddy.constants';
import {
	ChatMessage,
	ILlmProvider,
	LlmOptions,
	LlmResponse,
} from '../../../modules/buddy/platforms/llm-provider.platform';
import { OAuthTokenManager } from '../../../modules/buddy/platforms/oauth-token-manager';
import { ConfigService } from '../../../modules/config/services/config.service';
import { LlmToolCall, ToolDefinition } from '../../../modules/tools/platforms/tool-provider.platform';
import {
	BUDDY_OPENAI_CODEX_BASE_URL,
	BUDDY_OPENAI_CODEX_DEFAULT_MODEL,
	BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_OPENAI_CODEX_PLUGIN_NAME,
	BUDDY_OPENAI_CODEX_TOKEN_URL,
} from '../buddy-openai-codex.constants';
import { BuddyOpenaiCodexConfigModel } from '../models/config.model';

@Injectable()
export class OpenAiCodexProvider implements ILlmProvider {
	private readonly tokenManager = new OAuthTokenManager({
		tokenUrl: BUDDY_OPENAI_CODEX_TOKEN_URL,
		providerLabel: 'OpenAiCodex',
	});

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_OPENAI_CODEX_PLUGIN_NAME;
	}

	getName(): string {
		return 'OpenAI Codex';
	}

	getDescription(): string {
		return BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_DESCRIPTION;
	}

	getDefaultModel(): string {
		return BUDDY_OPENAI_CODEX_DEFAULT_MODEL;
	}

	isConfigured(pluginConfig: Record<string, unknown>): boolean {
		const accessToken = pluginConfig.accessToken;
		const clientId = pluginConfig.clientId;
		const refreshToken = pluginConfig.refreshToken;

		const hasAccessToken = typeof accessToken === 'string' && accessToken.length > 0;
		const hasOAuthCredentials =
			typeof clientId === 'string' &&
			clientId.length > 0 &&
			typeof refreshToken === 'string' &&
			refreshToken.length > 0;

		return hasAccessToken || hasOAuthCredentials;
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
		const accessToken = await this.tokenManager.resolveAccessToken(config);
		const resolvedModel = config?.model ?? model;
		const timeout = options?.timeout ?? 30_000;

		// Build input array matching the Codex Responses API format
		const input = messages.map((m) => ({
			role: m.role === MessageRole.USER ? 'user' : 'assistant',
			content: m.content,
			type: 'message',
		}));

		// Build tools in Responses API format
		const tools = this.formatTools(options?.tools);

		// ChatGPT backend requires streaming. We collect SSE chunks and assemble the response.
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		const start = Date.now();

		try {
			const response = await fetch(`${BUDDY_OPENAI_CODEX_BASE_URL}/responses`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: resolvedModel,
					instructions: systemPrompt,
					input,
					stream: true,
					store: false,
					tools,
					tool_choice: 'auto',
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorBody = await response.text().catch(() => '');

				throw new Error(`${response.status} ${errorBody || response.statusText}`);
			}

			const { content, toolCalls } = await this.collectStreamResponse(response);
			const durationMs = Date.now() - start;

			return {
				content,
				toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
				meta: {
					provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
					model: resolvedModel,
					inputTokens: null,
					outputTokens: null,
					finishReason: null,
					durationMs,
					cacheReadTokens: null,
					cacheWriteTokens: null,
				},
			};
		} finally {
			clearTimeout(timeoutId);
		}
	}

	private formatTools(tools?: ToolDefinition[]): unknown[] {
		if (!tools || tools.length === 0) {
			return [];
		}

		return tools.map((t) => ({
			type: 'function',
			name: t.name,
			description: t.description,
			parameters: t.parameters,
		}));
	}

	private async collectStreamResponse(response: Response): Promise<{ content: string; toolCalls: LlmToolCall[] }> {
		const body = response.body;

		if (!body) {
			return { content: '', toolCalls: [] };
		}

		const reader = body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		let content = '';

		// Track tool calls: Responses API emits function_call_arguments.delta events
		// with a call_id, and we accumulate the JSON argument strings per call
		const toolCallMap = new Map<string, { id: string; name: string; args: string }>();

		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				break;
			}

			buffer += decoder.decode(value, { stream: true });

			const lines = buffer.split('\n');

			// Keep the last incomplete line in the buffer
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				if (!line.startsWith('data: ') || line === 'data: [DONE]') {
					continue;
				}

				try {
					const event = JSON.parse(line.slice(6)) as {
						type?: string;
						delta?: string;
						call_id?: string;
						name?: string;
						item_id?: string;
					};

					if (event.type === 'response.output_text.delta' && event.delta) {
						content += event.delta;
					} else if (event.type === 'response.function_call_arguments.delta' && event.call_id && event.delta) {
						const existing = toolCallMap.get(event.call_id);

						if (existing) {
							existing.args += event.delta;
						}
					} else if (event.type === 'response.output_item.added') {
						// A new function call output item — initialize the accumulator
						const rawEvent = JSON.parse(line.slice(6)) as {
							type?: string;
							item?: { type?: string; call_id?: string; name?: string };
						};

						if (rawEvent.item?.type === 'function_call' && rawEvent.item.call_id) {
							toolCallMap.set(rawEvent.item.call_id, {
								id: rawEvent.item.call_id,
								name: rawEvent.item.name ?? '',
								args: '',
							});
						}
					}
				} catch {
					// Skip malformed JSON lines
				}
			}
		}

		const toolCalls: LlmToolCall[] = [];

		for (const tc of toolCallMap.values()) {
			try {
				toolCalls.push({
					id: tc.id,
					name: tc.name,
					arguments: JSON.parse(tc.args || '{}') as Record<string, unknown>,
				});
			} catch {
				// Skip tool calls with malformed arguments
			}
		}

		return { content, toolCalls };
	}

	private getPluginConfig(): BuddyOpenaiCodexConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyOpenaiCodexConfigModel>(BUDDY_OPENAI_CODEX_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
