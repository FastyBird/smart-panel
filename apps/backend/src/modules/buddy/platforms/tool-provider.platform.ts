import { LlmToolCall, ToolDefinition } from './llm-provider.platform';

/**
 * Result of a tool execution, containing success status and a human-readable description.
 */
export interface ToolExecutionResult {
	success: boolean;
	message: string;
}

/**
 * Interface for tool provider implementations.
 * Each tool provider can register a set of tools that the LLM can call.
 * This allows modules and plugins to extend Buddy with new capabilities.
 */
export interface IToolProvider {
	/**
	 * Returns the provider type identifier (e.g., 'buddy-core-tools')
	 */
	getType(): string;

	/**
	 * Returns the tool definitions this provider offers.
	 * These are provider-agnostic; the LLM provider adapter converts them
	 * to the provider-specific format (Claude tools, OpenAI functions, etc.).
	 */
	getToolDefinitions(): ToolDefinition[];

	/**
	 * Execute a tool call and return the result.
	 * @param toolCall The tool call from the LLM
	 * @returns The result of the tool execution, or null if this provider doesn't handle the tool
	 */
	executeTool(toolCall: LlmToolCall): Promise<ToolExecutionResult | null>;
}
