import { Injectable, Logger } from '@nestjs/common';

import { IToolProvider, LlmToolCall, ToolDefinition, ToolExecutionResult } from '../platforms/tool-provider.platform';

@Injectable()
export class ToolProviderRegistryService {
	private readonly logger = new Logger(ToolProviderRegistryService.name);

	private readonly providers = new Map<string, IToolProvider>();

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

		this.providers.set(type, provider);

		this.logger.log(`Tool provider '${type}' added. Total providers: ${this.providers.size}`);

		return true;
	}

	/**
	 * Get all tool definitions from all registered providers
	 */
	getAllToolDefinitions(): ToolDefinition[] {
		const definitions: ToolDefinition[] = [];

		for (const provider of this.providers.values()) {
			definitions.push(...provider.getToolDefinitions());
		}

		return definitions;
	}

	/**
	 * Execute a tool call by routing it to the provider that handles it.
	 * Iterates through all registered providers until one handles the tool.
	 */
	async executeTool(toolCall: LlmToolCall): Promise<ToolExecutionResult> {
		for (const provider of this.providers.values()) {
			const result = await provider.executeTool(toolCall);

			if (result !== null) {
				return result;
			}
		}

		this.logger.warn(`No provider found for tool: ${toolCall.name}`);

		return {
			success: false,
			message: `Unknown tool: ${toolCall.name}`,
		};
	}

	/**
	 * List all registered provider types
	 */
	list(): string[] {
		return [...this.providers.keys()];
	}
}
