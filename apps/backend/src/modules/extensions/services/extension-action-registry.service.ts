import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EXTENSIONS_MODULE_NAME } from '../extensions.constants';

import type { IActionResult, IExtensionAction } from './extension-action.interface';

/**
 * Serialized action descriptor with resolved options (safe for API responses).
 */
export interface SerializedAction {
	id: string;
	label: string;
	description?: string;
	icon?: string;
	category?: string;
	mode: string;
	dangerous?: boolean;
	parameters?: SerializedActionParameter[];
}

export interface SerializedActionParameter {
	name: string;
	label: string;
	description?: string;
	type: string;
	required?: boolean;
	default?: string | number | boolean;
	options?: { label: string; value: string | number | boolean }[];
	validation?: {
		min?: number;
		max?: number;
		pattern?: string;
		min_length?: number;
		max_length?: number;
	};
}

/**
 * Central registry where extensions register their available actions.
 *
 * Actions are registered during onModuleInit and can be listed/executed via the REST API.
 * Dynamic parameter options (resolveOptions) are resolved at fetch time, not registration time.
 */
@Injectable()
export class ExtensionActionRegistryService {
	private readonly logger = createExtensionLogger(EXTENSIONS_MODULE_NAME, 'ExtensionActionRegistryService');

	/**
	 * Map of extensionType → Map of actionId → action definition
	 */
	private readonly actions = new Map<string, Map<string, IExtensionAction>>();

	/**
	 * Register an action for an extension.
	 */
	register(extensionType: string, action: IExtensionAction): void {
		if (!this.actions.has(extensionType)) {
			this.actions.set(extensionType, new Map());
		}

		const extensionActions = this.actions.get(extensionType)!;

		if (extensionActions.has(action.id)) {
			this.logger.warn(`Action '${action.id}' already registered for extension '${extensionType}', overwriting`);
		}

		extensionActions.set(action.id, action);

		this.logger.debug(`Registered action '${action.id}' for extension '${extensionType}' (mode=${action.mode})`);
	}

	/**
	 * Unregister all actions for an extension.
	 */
	unregisterAll(extensionType: string): void {
		this.actions.delete(extensionType);

		this.logger.debug(`Unregistered all actions for extension '${extensionType}'`);
	}

	/**
	 * Check if an extension has any registered actions.
	 */
	hasActions(extensionType: string): boolean {
		const extensionActions = this.actions.get(extensionType);

		return extensionActions !== undefined && extensionActions.size > 0;
	}

	/**
	 * Get all actions for an extension, with dynamic options resolved.
	 * Returns serialized descriptors safe for API responses.
	 */
	async getActions(extensionType: string): Promise<SerializedAction[]> {
		const extensionActions = this.actions.get(extensionType);

		if (!extensionActions) {
			return [];
		}

		const serialized: SerializedAction[] = [];

		for (const action of extensionActions.values()) {
			serialized.push(await this.serializeAction(action));
		}

		return serialized;
	}

	/**
	 * Execute an immediate action.
	 */
	async execute(extensionType: string, actionId: string, params: Record<string, unknown>): Promise<IActionResult> {
		const extensionActions = this.actions.get(extensionType);

		if (!extensionActions) {
			throw new NotFoundException(`No actions registered for extension '${extensionType}'`);
		}

		const action = extensionActions.get(actionId);

		if (!action) {
			throw new NotFoundException(`Action '${actionId}' not found for extension '${extensionType}'`);
		}

		if (action.mode !== 'immediate') {
			throw new BadRequestException(`Action '${actionId}' is not an immediate action (mode=${action.mode})`);
		}

		if (!action.execute) {
			throw new BadRequestException(`Action '${actionId}' has no execute handler`);
		}

		this.logger.log(`Executing action '${actionId}' for extension '${extensionType}'`);

		try {
			const result = await action.execute(params);

			this.logger.log(`Action '${actionId}' completed: success=${result.success}`);

			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';

			this.logger.error(`Action '${actionId}' failed: ${message}`);

			return {
				success: false,
				message: `Action failed: ${message}`,
			};
		}
	}

	/**
	 * Serialize an action for API responses, resolving dynamic options.
	 */
	private async serializeAction(action: IExtensionAction): Promise<SerializedAction> {
		const serialized: SerializedAction = {
			id: action.id,
			label: action.label,
			description: action.description,
			icon: action.icon,
			category: action.category,
			mode: action.mode,
			dangerous: action.dangerous,
		};

		if (action.parameters && action.parameters.length > 0) {
			serialized.parameters = [];

			for (const param of action.parameters) {
				const serializedParam: SerializedActionParameter = {
					name: param.name,
					label: param.label,
					description: param.description,
					type: param.type,
					required: param.required,
					default: param.default,
				};

				// Resolve dynamic options if available, otherwise use static
				if (param.resolveOptions) {
					try {
						serializedParam.options = await param.resolveOptions();
					} catch (error) {
						this.logger.warn(
							`Failed to resolve options for parameter '${param.name}': ${error instanceof Error ? error.message : 'unknown'}`,
						);
						serializedParam.options = param.options ?? [];
					}
				} else if (param.options) {
					serializedParam.options = param.options;
				}

				if (param.validation) {
					serializedParam.validation = {
						min: param.validation.min,
						max: param.validation.max,
						pattern: param.validation.pattern,
						min_length: param.validation.minLength,
						max_length: param.validation.maxLength,
					};
				}

				serialized.parameters.push(serializedParam);
			}
		}

		return serialized;
	}
}
