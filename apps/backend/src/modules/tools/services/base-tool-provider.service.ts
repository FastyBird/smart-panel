import { ExtensionLoggerService } from '../../../common/logger';

import { IToolProvider, LlmToolCall, ToolDefinition, ToolExecutionResult } from '../platforms/tool-provider.platform';

const DEFAULT_TOOL_EXECUTION_TIMEOUT_MS = 5_000;

/**
 * Abstract base class for tool providers that handles common boilerplate:
 * logging, error wrapping, and timeout enforcement via Promise.race.
 *
 * Subclasses implement `getType()`, `getToolDefinitions()`, and the
 * domain-specific `handleToolCall()` method.
 */
export abstract class BaseToolProviderService implements IToolProvider {
	protected abstract readonly logger: ExtensionLoggerService;

	protected readonly toolExecutionTimeoutMs: number = DEFAULT_TOOL_EXECUTION_TIMEOUT_MS;

	abstract getType(): string;

	abstract getToolDefinitions(): ToolDefinition[];

	/**
	 * Execute the domain-specific logic for a tool call.
	 * Return null if this provider does not handle the given tool name.
	 */
	protected abstract handleToolCall(toolCall: LlmToolCall): Promise<ToolExecutionResult | null>;

	async executeTool(toolCall: LlmToolCall): Promise<ToolExecutionResult | null> {
		// Quick check: let subclass signal it doesn't own this tool name
		if (!this.getToolDefinitions().some((t) => t.name === toolCall.name)) {
			return null;
		}

		this.logger.debug(`Executing tool: ${toolCall.name} (id=${toolCall.id})`);

		try {
			const result = await this.executeWithTimeout(toolCall);

			this.logger.debug(`Tool ${toolCall.name} completed: ${result?.success ? 'success' : 'failure'}`);

			return result;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Tool ${toolCall.name} failed: ${err.message}`);

			return {
				success: false,
				message: `Failed to execute ${toolCall.name}: ${err.message}`,
			};
		}
	}

	private async executeWithTimeout(toolCall: LlmToolCall): Promise<ToolExecutionResult | null> {
		let timer: ReturnType<typeof setTimeout> | undefined;

		const timeoutPromise = new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error('Tool execution timed out')), this.toolExecutionTimeoutMs);
		});

		try {
			return await Promise.race([this.handleToolCall(toolCall), timeoutPromise]);
		} finally {
			clearTimeout(timer);
		}
	}
}
