import { z } from 'zod';

export enum ToolAudience {
	BUDDY = 'buddy',
	MCP = 'mcp',
}

export enum ToolAccessKind {
	READ = 'read',
	WRITE = 'write',
	TRIGGER = 'trigger',
}

export enum ToolExecutionStatus {
	COMPLETED = 'completed',
	PARTIAL = 'partial',
	FAILED = 'failed',
	TIMED_OUT = 'timed_out',
	DENIED = 'denied',
}

/**
 * Tool definition for LLM providers (provider-agnostic format).
 */
export interface ToolDefinition {
	name: string;
	description: string;
	audiences: ToolAudience[];
	access: ToolAccessKind;
	inputSchema: z.ZodType;
	outputSchema: z.ZodType;
	parameters: Record<string, unknown>;
}

export interface CreateToolDefinitionOptions {
	name: string;
	description: string;
	audiences: ToolAudience[];
	access: ToolAccessKind;
	inputSchema: z.ZodType;
	outputSchema: z.ZodType;
}

export const createToolDefinition = (options: CreateToolDefinitionOptions): ToolDefinition => {
	const parameters = { ...z.toJSONSchema(options.inputSchema, { target: 'draft-7' }) };

	delete parameters.$schema;

	return {
		...options,
		parameters,
	};
};

export interface LlmToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

/**
 * Result of a tool execution, containing success status and a human-readable description.
 */
export interface ToolExecutionResult {
	success: boolean;
	status: ToolExecutionStatus;
	message: string;
	data?: Record<string, unknown>;
	errorCode?: string;
	/** True when structured data was omitted because it was invalid or exceeded the transport bound. */
	truncated?: boolean;
}

export interface ToolExecutionContext {
	audience: ToolAudience;
	source: string;
	actorId?: string;
	requestId?: string;
	allowedAccessKinds?: ToolAccessKind[];
}

export interface ToolListingOptions {
	audience?: ToolAudience;
	accessKinds?: ToolAccessKind[];
}

export const createToolExecutionContext = (
	toolCall: LlmToolCall,
	context?: Partial<ToolExecutionContext>,
): ToolExecutionContext => ({
	audience: context?.audience ?? ToolAudience.BUDDY,
	source: context?.source ?? ToolAudience.BUDDY,
	actorId: context?.actorId,
	requestId: context?.requestId ?? toolCall.id,
	allowedAccessKinds: context?.allowedAccessKinds,
});

/**
 * Interface for tool provider implementations.
 * Each tool provider can register a set of tools that the LLM can call.
 * This allows modules and plugins to extend Buddy with new capabilities.
 */
export interface IToolProvider {
	/**
	 * Returns the provider type identifier (e.g., 'devices-tools')
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
	executeTool(toolCall: LlmToolCall, context?: Partial<ToolExecutionContext>): Promise<ToolExecutionResult | null>;
}
