import { LlmToolCall, ToolDefinition } from '../../tools/platforms/tool-provider.platform';
import { MessageRole } from '../buddy.constants';

export type { LlmToolCall, ToolDefinition } from '../../tools/platforms/tool-provider.platform';

export interface ChatMessage {
	role: MessageRole.USER | MessageRole.ASSISTANT;
	content: string;
}

export type LlmToolResultStatus =
	| 'completed'
	| 'partial'
	| 'failed'
	| 'timed_out'
	| 'denied'
	| 'indeterminate'
	| 'malformed';

export interface LlmConversationToolCall {
	/** Stable provider-neutral ID for this active transcript. */
	callId: string;
	/** Provider-issued correlation ID, or null when the native protocol has none. */
	providerCallId: string | null;
	name: string;
	arguments: Record<string, unknown>;
	/** Exact provider argument text when the native protocol uses encoded JSON. */
	rawArguments?: string;
}

export interface LlmConversationToolResult {
	callId: string;
	providerCallId: string | null;
	toolName: string;
	status: LlmToolResultStatus;
	message: string;
	data?: Record<string, unknown>;
	errorCode?: string;
	truncated: boolean;
}

export interface LlmConversationReasoningSummaryPart {
	type: 'summary_text';
	text: string;
}

export interface LlmConversationReasoningContentPart {
	type: 'reasoning_text';
	text: string;
}

export interface LlmConversationReasoningItem {
	type: 'reasoning';
	id: string;
	summary: LlmConversationReasoningSummaryPart[];
	content?: LlmConversationReasoningContentPart[];
	encrypted_content: string;
	status?: 'in_progress' | 'completed' | 'incomplete';
}

export interface LlmConversationAssistantTextPart {
	type: 'output_text';
	text: string;
	annotations: [];
}

export interface LlmConversationAssistantMessageItem {
	type: 'message';
	id: string;
	role: 'assistant';
	content: LlmConversationAssistantTextPart[];
	phase?: 'commentary' | 'final_answer';
	status?: 'in_progress' | 'completed' | 'incomplete';
}

export interface LlmConversationFunctionCallItem {
	type: 'function_call';
	id?: string;
	call_id: string;
	name: string;
	arguments: string;
	status?: 'in_progress' | 'completed' | 'incomplete';
}

export type LlmConversationProviderOutputItem =
	| LlmConversationReasoningItem
	| LlmConversationAssistantMessageItem
	| LlmConversationFunctionCallItem;

/**
 * Provider-owned active-turn state that must be replayed to continue a native
 * tool exchange. It is never persisted as ordinary conversation history.
 */
export interface LlmConversationProviderItem {
	provider: string;
	/** Exact position in the provider's response output array. */
	outputIndex: number;
	/** Validated active-turn output returned by the provider. */
	item: LlmConversationProviderOutputItem;
}

export interface LlmAssistantToolCallsItem {
	type: 'assistant_tool_calls';
	content: string;
	calls: LlmConversationToolCall[];
	providerItems?: LlmConversationProviderItem[];
}

export interface LlmToolResultsItem {
	type: 'tool_results';
	results: LlmConversationToolResult[];
}

/**
 * Additive provider-neutral active-turn transcript. Existing text-only callers can
 * keep passing ChatMessage objects unchanged.
 */
export type LlmConversationItem = ChatMessage | LlmAssistantToolCallsItem | LlmToolResultsItem;

export interface LlmOptions {
	timeout?: number;
	model?: string;
	maxTokens?: number;
	tools?: ToolDefinition[];
	signal?: AbortSignal;
}

/**
 * Metadata collected from an LLM API response.
 * Stored on assistant messages for cost monitoring and performance debugging.
 */
export interface LlmResponseMeta {
	provider: string;
	model: string | null;
	inputTokens: number | null;
	outputTokens: number | null;
	finishReason: string | null;
	durationMs: number | null;
	cacheReadTokens: number | null;
	cacheWriteTokens: number | null;
}

/**
 * Structured response from an LLM provider, containing the message content and metadata.
 * When the LLM decides to call tools, `toolCalls` will be populated and `content` may be empty.
 */
export interface LlmToolError {
	toolCallId: string;
	toolName: string;
	error: string;
}

export interface LlmResponse {
	content: string;
	toolCalls?: LlmToolCall[];
	toolErrors?: LlmToolError[];
	/** Provider-owned continuation state for the active tool turn only. */
	providerItems?: LlmConversationProviderItem[];
	meta: LlmResponseMeta;
}

/**
 * Interface for LLM provider implementations.
 * Each LLM provider plugin must implement this interface.
 */
export interface ILlmProvider {
	/**
	 * Returns the provider type identifier (e.g., 'buddy-openai')
	 */
	getType(): string;

	/**
	 * Returns the human-readable name of the provider
	 */
	getName(): string;

	/**
	 * Returns a description of the provider
	 */
	getDescription(): string;

	/**
	 * Returns the default model name for this provider
	 */
	getDefaultModel(): string;

	/**
	 * Checks whether the provider has the required credentials configured.
	 * @param pluginConfig The plugin configuration record
	 * @returns True if the provider has enough configuration to function
	 */
	isConfigured(pluginConfig: Record<string, unknown>): boolean;

	/**
	 * Sends a message to the LLM provider and returns the response with metadata.
	 * Each provider reads its own credentials from plugin config.
	 * @param systemPrompt The system prompt for the conversation
	 * @param messages The conversation history
	 * @param model The model to use
	 * @param options Additional options (timeout, tools, etc.)
	 * @returns The assistant's response content and metadata
	 */
	sendMessage(
		systemPrompt: string,
		messages: LlmConversationItem[],
		model: string,
		options?: LlmOptions,
	): Promise<LlmResponse>;

	/**
	 * Whether this provider supports tool use (function calling).
	 * Providers that don't support tools will gracefully degrade to text-only responses.
	 */
	supportsTools?(): boolean;

	/** Whether this provider can receive native correlated tool-result transcript items. */
	supportsNativeToolResults?(): boolean;
}
