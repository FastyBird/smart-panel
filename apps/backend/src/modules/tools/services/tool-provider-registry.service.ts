import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import {
	IToolProvider,
	LlmToolCall,
	ToolAudience,
	ToolDefinition,
	ToolExecutionContext,
	ToolExecutionResult,
	ToolExecutionStatus,
	ToolListingOptions,
	createToolExecutionContext,
} from '../platforms/tool-provider.platform';
import {
	TOOLS_MODULE_NAME,
	TOOL_RESULT_MAX_ERROR_CODE_UTF8_BYTES,
	TOOL_RESULT_MAX_JSON_BYTES,
	TOOL_RESULT_MAX_MESSAGE_UTF8_BYTES,
} from '../tools.constants';

export {
	TOOL_RESULT_MAX_ERROR_CODE_UTF8_BYTES,
	TOOL_RESULT_MAX_JSON_BYTES,
	TOOL_RESULT_MAX_MESSAGE_UTF8_BYTES,
} from '../tools.constants';

@Injectable()
export class ToolProviderRegistryService {
	private readonly logger = createExtensionLogger(TOOLS_MODULE_NAME, 'ToolProviderRegistryService');

	private readonly providers = new Map<string, IToolProvider>();
	private readonly tools = new Map<string, { definition: ToolDefinition; provider: IToolProvider }>();

	/**
	 * Register a tool provider implementation
	 * @param provider The tool provider to register
	 * @returns true if registration succeeded, false if provider type already exists
	 */
	register(provider: IToolProvider): boolean {
		const type = provider.getType();

		if (this.providers.has(type)) {
			this.logger.warn(`Tool provider '${type}' is already registered, skipping`);

			return false;
		}

		const definitions = provider.getToolDefinitions();
		const providerToolNames = new Set<string>();

		for (const definition of definitions) {
			if (providerToolNames.has(definition.name)) {
				throw new Error(`Tool provider '${type}' declares duplicate tool name '${definition.name}'`);
			}

			providerToolNames.add(definition.name);

			const registered = this.tools.get(definition.name);

			if (registered) {
				throw new Error(
					`Tool name '${definition.name}' from provider '${type}' conflicts with provider '${registered.provider.getType()}'`,
				);
			}
		}

		this.providers.set(type, provider);

		for (const definition of definitions) {
			this.tools.set(definition.name, { definition, provider });
		}

		this.logger.log(`Tool provider '${type}' added. Total providers: ${this.providers.size}`);

		return true;
	}

	/**
	 * Get all tool definitions from all registered providers
	 */
	getAllToolDefinitions(options: ToolListingOptions = {}): ToolDefinition[] {
		const audience = options.audience ?? ToolAudience.BUDDY;

		return [...this.tools.values()]
			.map(({ definition }) => definition)
			.filter(
				(definition) =>
					definition.audiences.includes(audience) &&
					(options.accessKinds === undefined || options.accessKinds.includes(definition.access)),
			);
	}

	/**
	 * Execute a tool call by routing it to the provider that handles it.
	 * Iterates through all registered providers until one handles the tool.
	 */
	async executeTool(
		toolCall: LlmToolCall,
		providedContext?: Partial<ToolExecutionContext>,
	): Promise<ToolExecutionResult> {
		const context = createToolExecutionContext(toolCall, providedContext);
		const registered = this.tools.get(toolCall.name);

		if (!registered) {
			this.logger.warn(`No provider found for tool: ${toolCall.name}`);

			return this.finishToolResult(context, {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: `Unknown tool: ${toolCall.name}`,
				errorCode: 'UNKNOWN_TOOL',
			});
		}

		if (!registered.definition.audiences.includes(context.audience)) {
			return this.finishToolResult(context, {
				success: false,
				status: ToolExecutionStatus.DENIED,
				message: `Tool "${toolCall.name}" is not available to ${context.audience}`,
				errorCode: 'TOOL_AUDIENCE_DENIED',
			});
		}

		if (context.allowedAccessKinds && !context.allowedAccessKinds.includes(registered.definition.access)) {
			return this.finishToolResult(context, {
				success: false,
				status: ToolExecutionStatus.DENIED,
				message: `Tool "${toolCall.name}" requires ${registered.definition.access} access`,
				errorCode: 'TOOL_ACCESS_DENIED',
			});
		}

		const result = await registered.provider.executeTool(toolCall, context);

		if (result !== null) {
			return this.finishToolResult(context, result, registered.definition);
		}

		return this.finishToolResult(context, {
			success: false,
			status: ToolExecutionStatus.FAILED,
			message: `Provider failed to handle registered tool: ${toolCall.name}`,
			errorCode: 'TOOL_PROVIDER_MISMATCH',
		});
	}

	private finishToolResult(
		context: ToolExecutionContext,
		result: ToolExecutionResult,
		definition?: ToolDefinition,
	): ToolExecutionResult {
		return this.boundToolResult(definition, result, context.audience === ToolAudience.BUDDY);
	}

	private boundToolResult(
		definition: ToolDefinition | undefined,
		result: ToolExecutionResult,
		boundBuddyStrings: boolean,
	): ToolExecutionResult {
		const hadData = result.data !== undefined;
		const message = boundBuddyStrings
			? boundUtf8String(result.message, TOOL_RESULT_MAX_MESSAGE_UTF8_BYTES)
			: { value: result.message, truncated: false };
		const boundedErrorCode =
			result.errorCode === undefined
				? undefined
				: boundBuddyStrings
					? boundUtf8String(result.errorCode, TOOL_RESULT_MAX_ERROR_CODE_UTF8_BYTES)
					: { value: result.errorCode, truncated: false };
		let data = result.data;
		let errorCode = boundedErrorCode?.value;
		let truncated = result.truncated === true || message.truncated || boundedErrorCode?.truncated === true;

		if (data !== undefined && definition !== undefined) {
			try {
				const parsed = definition.outputSchema.safeParse(data);

				if (!parsed.success || typeof parsed.data !== 'object' || parsed.data === null || Array.isArray(parsed.data)) {
					throw new TypeError('Invalid tool result data');
				}

				data = parsed.data as Record<string, unknown>;
				const serialized = JSON.stringify(data);

				if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > TOOL_RESULT_MAX_JSON_BYTES) {
					data = undefined;
					truncated = true;
				}
			} catch {
				data = undefined;
				errorCode ??= 'INVALID_TOOL_RESULT_DATA';
				truncated = true;
			}
		}

		const bounded: ToolExecutionResult = {
			...result,
			message: message.value,
			...(hadData ? { data } : {}),
			...(errorCode === undefined ? {} : { errorCode }),
			...(truncated || result.truncated !== undefined ? { truncated } : {}),
		};

		if (errorCode === undefined) {
			delete bounded.errorCode;
		}

		return bounded;
	}

	/**
	 * List all registered provider types
	 */
	list(): string[] {
		return [...this.providers.keys()];
	}
}

function boundUtf8String(value: string, maxBytes: number): { value: string; truncated: boolean } {
	if (Buffer.byteLength(value, 'utf8') <= maxBytes) {
		return { value, truncated: false };
	}

	let bounded = '';
	let bytes = 0;

	for (const character of value) {
		const characterBytes = Buffer.byteLength(character, 'utf8');

		if (bytes + characterBytes > maxBytes) {
			break;
		}

		bounded += character;
		bytes += characterBytes;
	}

	return { value: bounded, truncated: true };
}
