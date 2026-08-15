import { Injectable } from '@nestjs/common';

import { MessageRole } from '../../../modules/buddy/buddy.constants';
import {
	isChatMessage,
	isLlmAssistantToolCallsItem,
	requireProviderCallId,
	serializeLlmConversationToolResult,
	validateLlmConversationItems,
} from '../../../modules/buddy/platforms/llm-conversation.utils';
import {
	ILlmProvider,
	LlmAssistantToolCallsItem,
	LlmConversationAssistantMessageItem,
	LlmConversationFunctionCallItem,
	LlmConversationItem,
	LlmConversationProviderItem,
	LlmConversationProviderOutputItem,
	LlmConversationReasoningItem,
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

interface OpenAiCodexOutputItem {
	type?: string;
	id?: string;
	call_id?: string;
	name?: string;
	arguments?: string;
	encrypted_content?: unknown;
	summary?: unknown;
	content?: unknown;
	status?: unknown;
	phase?: unknown;
	role?: unknown;
}

interface OpenAiCodexStreamEvent {
	type?: string;
	delta?: string;
	call_id?: string;
	output_index?: number;
	item?: OpenAiCodexOutputItem;
	response?: { output?: OpenAiCodexOutputItem[] };
}

/** Build the exact JSON payload sent to the OpenAI Codex Responses endpoint. */
export function buildOpenAiCodexRequestPayload(
	model: string,
	systemPrompt: string,
	messages: LlmConversationItem[],
	tools?: ToolDefinition[],
	maxTokens: number = 1024,
): Record<string, unknown> {
	validateLlmConversationItems(messages);

	const input = messages.flatMap<Record<string, unknown>>((message) => {
		if (isChatMessage(message)) {
			return [
				{
					role: message.role === MessageRole.USER ? 'user' : 'assistant',
					content: message.content,
					type: 'message',
				},
			];
		}

		if (isLlmAssistantToolCallsItem(message)) {
			const providerItems = message.providerItems ?? [];

			if (providerItems.length > 0) {
				return serializeOpenAiCodexProviderItems(message.content, message.calls, providerItems);
			}

			return [
				...(message.content.length === 0 ? [] : [{ role: 'assistant', content: message.content, type: 'message' }]),
				...message.calls.map((call) => ({
					type: 'function_call',
					call_id: requireProviderCallId('OpenAI Codex', call.providerCallId),
					name: call.name,
					arguments: call.rawArguments ?? JSON.stringify(call.arguments),
				})),
			];
		}

		return message.results.map((result) => ({
			type: 'function_call_output',
			call_id: requireProviderCallId('OpenAI Codex', result.providerCallId),
			output: serializeLlmConversationToolResult(result),
		}));
	});

	return {
		model,
		instructions: systemPrompt,
		input,
		stream: true,
		store: false,
		include: ['reasoning.encrypted_content'],
		max_output_tokens: maxTokens,
		tools:
			tools?.map((tool) => ({
				type: 'function',
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters,
			})) ?? [],
		tool_choice: 'auto',
	};
}

function serializeOpenAiCodexProviderItems(
	content: string,
	calls: LlmAssistantToolCallsItem['calls'],
	providerItems: LlmConversationProviderItem[],
): Record<string, unknown>[] {
	const orderedProviderItems = [...providerItems].sort((left, right) => left.outputIndex - right.outputIndex);
	const nativeItems = orderedProviderItems.map(toOpenAiCodexProviderItem);
	const providerMessages = nativeItems.filter(
		(item): item is LlmConversationAssistantMessageItem => item.type === 'message',
	);
	const providerCalls = nativeItems.filter(
		(item): item is LlmConversationFunctionCallItem => item.type === 'function_call',
	);
	const providerContent = providerMessages
		.flatMap((message) => message.content)
		.map((part) => part.text)
		.join('');

	if (providerContent !== content) {
		throw new TypeError('OpenAI Codex provider message state does not match canonical assistant content');
	}

	if (providerCalls.length !== calls.length) {
		throw new TypeError('OpenAI Codex provider state must contain exactly one native item per function call');
	}

	for (const [callIndex, call] of calls.entries()) {
		const providerCall = providerCalls[callIndex];
		const providerCallId = requireProviderCallId('OpenAI Codex', call.providerCallId);
		let providerArguments: unknown;

		try {
			providerArguments = JSON.parse(providerCall.arguments);
		} catch {
			throw new TypeError('OpenAI Codex provider function call contains invalid arguments');
		}

		if (
			providerCall.call_id !== providerCallId ||
			providerCall.name !== call.name ||
			JSON.stringify(providerArguments) !== JSON.stringify(call.arguments)
		) {
			throw new TypeError(`OpenAI Codex provider function call at index ${callIndex} is ambiguous`);
		}
	}

	return nativeItems.map((item) => ({ ...item }));
}

function toOpenAiCodexProviderItem(providerItem: LlmConversationProviderItem): LlmConversationProviderOutputItem {
	if (providerItem.provider !== BUDDY_OPENAI_CODEX_PLUGIN_NAME) {
		throw new TypeError(`OpenAI Codex cannot replay provider item for "${providerItem.provider}"`);
	}

	return parseOpenAiCodexProviderOutputItem(providerItem.item);
}

function parseOpenAiCodexProviderOutputItem(item: OpenAiCodexOutputItem): LlmConversationProviderOutputItem {
	if (item.type === 'reasoning') {
		return parseOpenAiCodexReasoningItem(item);
	}

	if (item.type === 'message') {
		return parseOpenAiCodexAssistantMessageItem(item);
	}

	if (item.type === 'function_call') {
		return parseOpenAiCodexFunctionCallItem(item);
	}

	throw new TypeError('OpenAI Codex provider continuation contains an unsupported output item');
}

function parseOpenAiCodexReasoningItem(item: OpenAiCodexOutputItem): LlmConversationReasoningItem {
	if (
		item.type !== 'reasoning' ||
		typeof item.id !== 'string' ||
		item.id.length === 0 ||
		typeof item.encrypted_content !== 'string' ||
		item.encrypted_content.length === 0 ||
		!Array.isArray(item.summary)
	) {
		throw new TypeError('OpenAI Codex reasoning continuation requires complete encrypted content');
	}

	const summary = item.summary.map((part) => {
		if (!isRecord(part) || part.type !== 'summary_text' || typeof part.text !== 'string') {
			throw new TypeError('OpenAI Codex reasoning continuation has an invalid summary');
		}

		return { type: 'summary_text' as const, text: part.text };
	});

	let content: LlmConversationReasoningItem['content'];

	if (item.content !== undefined) {
		if (!Array.isArray(item.content)) {
			throw new TypeError('OpenAI Codex reasoning continuation has invalid content');
		}

		content = item.content.map((part) => {
			if (!isRecord(part) || part.type !== 'reasoning_text' || typeof part.text !== 'string') {
				throw new TypeError('OpenAI Codex reasoning continuation has invalid content');
			}

			return { type: 'reasoning_text' as const, text: part.text };
		});
	}

	const allowedStatuses = ['in_progress', 'completed', 'incomplete'] as const;
	const status = allowedStatuses.find((candidate) => candidate === item.status);

	if (item.status !== undefined && status === undefined) {
		throw new TypeError('OpenAI Codex reasoning continuation has an invalid status');
	}

	return {
		type: 'reasoning',
		id: item.id,
		summary,
		...(content === undefined ? {} : { content }),
		encrypted_content: item.encrypted_content,
		...(status === undefined ? {} : { status }),
	};
}

function parseOpenAiCodexAssistantMessageItem(item: OpenAiCodexOutputItem): LlmConversationAssistantMessageItem {
	if (
		item.type !== 'message' ||
		typeof item.id !== 'string' ||
		item.id.length === 0 ||
		item.role !== 'assistant' ||
		!Array.isArray(item.content)
	) {
		throw new TypeError('OpenAI Codex assistant message continuation is incomplete');
	}

	const content = item.content.map((part) => {
		if (
			!isRecord(part) ||
			part.type !== 'output_text' ||
			typeof part.text !== 'string' ||
			!Array.isArray(part.annotations) ||
			part.annotations.length !== 0
		) {
			throw new TypeError('OpenAI Codex assistant message continuation has invalid content');
		}

		return { type: 'output_text' as const, text: part.text, annotations: [] as [] };
	});
	const allowedPhases = ['commentary', 'final_answer'] as const;
	const phase = allowedPhases.find((candidate) => candidate === item.phase);

	if (item.phase !== undefined && phase === undefined) {
		throw new TypeError('OpenAI Codex assistant message continuation has an invalid phase');
	}
	const status = parseOpenAiCodexOutputStatus(item.status, 'assistant message');

	return {
		type: 'message',
		id: item.id,
		role: 'assistant',
		content,
		...(phase === undefined ? {} : { phase }),
		...(status === undefined ? {} : { status }),
	};
}

function parseOpenAiCodexFunctionCallItem(item: OpenAiCodexOutputItem): LlmConversationFunctionCallItem {
	if (
		item.type !== 'function_call' ||
		typeof item.call_id !== 'string' ||
		item.call_id.length === 0 ||
		typeof item.name !== 'string' ||
		item.name.length === 0 ||
		typeof item.arguments !== 'string'
	) {
		throw new TypeError('OpenAI Codex function call continuation is incomplete');
	}

	if (item.id !== undefined && (typeof item.id !== 'string' || item.id.length === 0)) {
		throw new TypeError('OpenAI Codex function call continuation has an invalid ID');
	}

	const status = parseOpenAiCodexOutputStatus(item.status, 'function call');

	return {
		type: 'function_call',
		...(item.id === undefined ? {} : { id: item.id }),
		call_id: item.call_id,
		name: item.name,
		arguments: item.arguments,
		...(status === undefined ? {} : { status }),
	};
}

function parseOpenAiCodexOutputStatus(
	value: unknown,
	label: string,
): 'in_progress' | 'completed' | 'incomplete' | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (value === 'in_progress' || value === 'completed' || value === 'incomplete') {
		return value;
	}

	throw new TypeError(`OpenAI Codex ${label} continuation has an invalid status`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
		const accessToken = await this.tokenManager.resolveAccessToken(config);
		const resolvedModel = config?.model ?? model;
		const timeout = options?.timeout ?? 30_000;

		const requestPayload = buildOpenAiCodexRequestPayload(
			resolvedModel,
			systemPrompt,
			messages,
			options?.tools,
			options?.maxTokens ?? 1024,
		);

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
				body: JSON.stringify(requestPayload),
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorBody = await response.text().catch(() => '');

				throw new Error(`${response.status} ${errorBody || response.statusText}`);
			}

			const { content, toolCalls, providerItems } = await this.collectStreamResponse(response);
			const durationMs = Date.now() - start;

			return {
				content,
				toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
				providerItems: providerItems.length > 0 ? providerItems : undefined,
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

	private async collectStreamResponse(
		response: Response,
	): Promise<{ content: string; toolCalls: LlmToolCall[]; providerItems: LlmConversationProviderItem[] }> {
		const body = response.body;

		if (!body) {
			return { content: '', toolCalls: [], providerItems: [] };
		}

		const reader = body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		let content = '';

		// Track tool calls: Responses API emits function_call_arguments.delta events
		// with a call_id, and we accumulate the JSON argument strings per call
		const toolCallMap = new Map<string, { id: string; name: string; args: string; outputIndex: number }>();
		const providerItemMap = new Map<number, LlmConversationProviderOutputItem>();

		const captureOutputItem = (item: OpenAiCodexOutputItem, outputIndex: number, complete: boolean): void => {
			if (complete) {
				providerItemMap.set(outputIndex, parseOpenAiCodexProviderOutputItem(item));
			}

			if (item.type !== 'function_call' || typeof item.call_id !== 'string' || item.call_id.length === 0) {
				return;
			}

			const existing = toolCallMap.get(item.call_id);
			const itemArguments = typeof item.arguments === 'string' ? item.arguments : undefined;

			toolCallMap.set(item.call_id, {
				id: item.call_id,
				name: typeof item.name === 'string' ? item.name : (existing?.name ?? ''),
				args: itemArguments ?? existing?.args ?? '',
				outputIndex,
			});
		};

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

				let event: OpenAiCodexStreamEvent;

				try {
					event = JSON.parse(line.slice(6)) as OpenAiCodexStreamEvent;
				} catch {
					// Skip malformed JSON lines
					continue;
				}

				if (event.type === 'response.output_text.delta' && event.delta) {
					content += event.delta;
				} else if (event.type === 'response.function_call_arguments.delta' && event.call_id && event.delta) {
					const existing = toolCallMap.get(event.call_id);

					if (existing) {
						existing.args += event.delta;
					}
				} else if (
					event.type === 'response.output_item.added' &&
					event.item &&
					isValidOutputIndex(event.output_index)
				) {
					captureOutputItem(event.item, event.output_index, false);
				} else if (event.type === 'response.output_item.done' && event.item && isValidOutputIndex(event.output_index)) {
					captureOutputItem(event.item, event.output_index, true);
				} else if (event.type === 'response.completed' && event.response?.output) {
					for (const [outputIndex, item] of event.response.output.entries()) {
						captureOutputItem(item, outputIndex, true);
					}
				}
			}
		}

		const toolCalls: LlmToolCall[] = [];

		const orderedToolCalls = [...toolCallMap.values()].sort((left, right) => left.outputIndex - right.outputIndex);

		for (const tc of orderedToolCalls) {
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

		const providerItems = [...providerItemMap.entries()]
			.sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
			.map(
				([outputIndex, item]): LlmConversationProviderItem => ({
					provider: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
					outputIndex,
					item,
				}),
			);
		const providerContent = [...providerItemMap.entries()]
			.sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
			.flatMap(([, item]) => (item.type === 'message' ? item.content : []))
			.map((part) => part.text)
			.join('');

		if (providerContent.length > 0) {
			if (content.length > 0 && content !== providerContent) {
				throw new TypeError('OpenAI Codex streamed text does not match its completed message output');
			}
			content = providerContent;
		}

		return { content, toolCalls, providerItems };
	}

	private getPluginConfig(): BuddyOpenaiCodexConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddyOpenaiCodexConfigModel>(BUDDY_OPENAI_CODEX_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}

function isValidOutputIndex(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
