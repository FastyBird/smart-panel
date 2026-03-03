import { MessageRole } from '../buddy.constants';

export interface ChatMessage {
	role: MessageRole.USER | MessageRole.ASSISTANT;
	content: string;
}

export interface LlmOptions {
	timeout?: number;
	model?: string;
	maxTokens?: number;
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
 */
export interface LlmResponse {
	content: string;
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
	 * @param options Additional options (timeout, etc.)
	 * @returns The assistant's response content and metadata
	 */
	sendMessage(systemPrompt: string, messages: ChatMessage[], model: string, options?: LlmOptions): Promise<LlmResponse>;
}
