import { MessageRole } from '../buddy.constants';

export interface ChatMessage {
	role: MessageRole.USER | MessageRole.ASSISTANT;
	content: string;
}

export interface LlmOptions {
	timeout?: number;
	model?: string;
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
	 * Sends a message to the LLM provider and returns the response
	 * @param systemPrompt The system prompt for the conversation
	 * @param messages The conversation history
	 * @param apiKey The API key (from plugin config)
	 * @param model The model to use
	 * @param options Additional options (timeout, etc.)
	 * @returns The assistant's response text
	 */
	sendMessage(
		systemPrompt: string,
		messages: ChatMessage[],
		apiKey: string,
		model: string,
		options?: LlmOptions,
	): Promise<string>;
}
