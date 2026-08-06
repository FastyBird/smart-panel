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
import { TOOLS_MODULE_NAME } from '../tools.constants';

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
		const registered = this.tools.get(toolCall.name);

		if (!registered) {
			this.logger.warn(`No provider found for tool: ${toolCall.name}`);

			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: `Unknown tool: ${toolCall.name}`,
				errorCode: 'UNKNOWN_TOOL',
			};
		}

		const context = createToolExecutionContext(toolCall, providedContext);

		if (!registered.definition.audiences.includes(context.audience)) {
			return {
				success: false,
				status: ToolExecutionStatus.DENIED,
				message: `Tool "${toolCall.name}" is not available to ${context.audience}`,
				errorCode: 'TOOL_AUDIENCE_DENIED',
			};
		}

		if (context.allowedAccessKinds && !context.allowedAccessKinds.includes(registered.definition.access)) {
			return {
				success: false,
				status: ToolExecutionStatus.DENIED,
				message: `Tool "${toolCall.name}" requires ${registered.definition.access} access`,
				errorCode: 'TOOL_ACCESS_DENIED',
			};
		}

		const result = await registered.provider.executeTool(toolCall, context);

		if (result !== null) {
			return result;
		}

		return {
			success: false,
			status: ToolExecutionStatus.FAILED,
			message: `Provider failed to handle registered tool: ${toolCall.name}`,
			errorCode: 'TOOL_PROVIDER_MISMATCH',
		};
	}

	/**
	 * List all registered provider types
	 */
	list(): string[] {
		return [...this.providers.keys()];
	}
}
