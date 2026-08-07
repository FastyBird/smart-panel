import { ExtensionLoggerService } from '../../../common/logger';
import {
	IToolProvider,
	LlmToolCall,
	ToolDefinition,
	ToolExecutionContext,
	ToolExecutionResult,
	ToolExecutionStatus,
	createToolExecutionContext,
} from '../platforms/tool-provider.platform';

const DEFAULT_TOOL_EXECUTION_TIMEOUT_MS = 5_000;

class ToolExecutionTimeoutError extends Error {}

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
	protected abstract handleToolCall(
		toolCall: LlmToolCall,
		context: ToolExecutionContext,
	): Promise<ToolExecutionResult | null>;

	async executeTool(
		toolCall: LlmToolCall,
		providedContext?: Partial<ToolExecutionContext>,
	): Promise<ToolExecutionResult | null> {
		// Quick check: let subclass signal it doesn't own this tool name
		const definition = this.getToolDefinitions().find((tool) => tool.name === toolCall.name);

		if (!definition) {
			return null;
		}

		const context = createToolExecutionContext(toolCall, providedContext);

		if (!definition.audiences.includes(context.audience)) {
			return {
				success: false,
				status: ToolExecutionStatus.DENIED,
				message: `Tool "${toolCall.name}" is not available to ${context.audience}`,
				errorCode: 'TOOL_AUDIENCE_DENIED',
			};
		}

		if (context.allowedAccessKinds && !context.allowedAccessKinds.includes(definition.access)) {
			return {
				success: false,
				status: ToolExecutionStatus.DENIED,
				message: `Tool "${toolCall.name}" requires ${definition.access} access`,
				errorCode: 'TOOL_ACCESS_DENIED',
			};
		}

		this.logger.debug(
			`Executing tool: ${toolCall.name} (id=${toolCall.id}, source=${context.source}, audience=${context.audience})`,
		);

		try {
			const result = await this.executeWithTimeout(toolCall, context);

			this.logger.debug(`Tool ${toolCall.name} completed: ${result?.status ?? ToolExecutionStatus.FAILED}`);

			return result;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Tool ${toolCall.name} failed: ${err.message}`, err.stack);

			if (err instanceof ToolExecutionTimeoutError) {
				return {
					success: false,
					status: ToolExecutionStatus.TIMED_OUT,
					message: `Tool "${toolCall.name}" timed out`,
					errorCode: 'TOOL_EXECUTION_TIMEOUT',
				};
			}

			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: `Failed to execute tool "${toolCall.name}"`,
				errorCode: 'TOOL_EXECUTION_FAILED',
			};
		}
	}

	private async executeWithTimeout(
		toolCall: LlmToolCall,
		context: ToolExecutionContext,
	): Promise<ToolExecutionResult | null> {
		let timer: ReturnType<typeof setTimeout> | undefined;

		const timeoutPromise = new Promise<never>((_, reject) => {
			timer = setTimeout(
				() => reject(new ToolExecutionTimeoutError('Tool execution timed out')),
				this.toolExecutionTimeoutMs,
			);
		});

		try {
			return await Promise.race([this.handleToolCall(toolCall, context), timeoutPromise]);
		} finally {
			clearTimeout(timer);
		}
	}
}
