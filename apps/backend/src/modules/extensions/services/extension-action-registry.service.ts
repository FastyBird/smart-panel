import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EXTENSIONS_MODULE_NAME } from '../extensions.constants';

import type { IActionParameter, IActionResult, IExtensionAction } from './extension-action.interface';
import { ActionParameterType } from './extension-action.interface';

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

		const extensionActions = this.actions.get(extensionType);

		if (extensionActions === undefined) {
			return;
		}

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

		await this.validateParams(action, params);

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
	 * Validate params against the action's declared parameter definitions.
	 * Fills in defaults for missing optional parameters.
	 * Resolves dynamic options for SELECT/MULTI_SELECT before validating allowed values.
	 */
	private async validateParams(action: IExtensionAction, params: Record<string, unknown>): Promise<void> {
		if (!action.parameters || action.parameters.length === 0) {
			return;
		}

		const errors: string[] = [];

		for (const param of action.parameters) {
			const value = params[param.name];

			// Apply default for missing optional params
			if (value === undefined || value === null) {
				if (param.required) {
					errors.push(`Parameter '${param.name}' is required`);
					continue;
				}

				if (param.default !== undefined) {
					params[param.name] = param.default;
				}

				continue;
			}

			this.validateParamType(param, value, errors);
			await this.validateParamConstraints(param, value, errors);
		}

		if (errors.length > 0) {
			throw new BadRequestException(`Invalid action parameters: ${errors.join('; ')}`);
		}
	}

	/**
	 * Validate that a parameter value matches its declared type.
	 */
	private validateParamType(param: IActionParameter, value: unknown, errors: string[]): void {
		switch (param.type) {
			case ActionParameterType.STRING:
				if (typeof value !== 'string') {
					errors.push(`Parameter '${param.name}' must be a string`);
				}
				break;
			case ActionParameterType.NUMBER:
				if (typeof value !== 'number' || Number.isNaN(value)) {
					errors.push(`Parameter '${param.name}' must be a number`);
				}
				break;
			case ActionParameterType.BOOLEAN:
				if (typeof value !== 'boolean') {
					errors.push(`Parameter '${param.name}' must be a boolean`);
				}
				break;
			case ActionParameterType.SELECT:
				if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
					errors.push(`Parameter '${param.name}' must be a string, number, or boolean`);
				}
				break;
			case ActionParameterType.MULTI_SELECT:
				if (!Array.isArray(value)) {
					errors.push(`Parameter '${param.name}' must be an array`);
				}
				break;
		}
	}

	/**
	 * Validate parameter constraints (min/max, pattern, minLength/maxLength, allowed options).
	 * Resolves dynamic options for SELECT/MULTI_SELECT parameters.
	 */
	private async validateParamConstraints(param: IActionParameter, value: unknown, errors: string[]): Promise<void> {
		if (param.validation) {
			const v = param.validation;

			if (typeof value === 'number') {
				if (v.min !== undefined && value < v.min) {
					errors.push(`Parameter '${param.name}' must be >= ${v.min}`);
				}

				if (v.max !== undefined && value > v.max) {
					errors.push(`Parameter '${param.name}' must be <= ${v.max}`);
				}
			}

			if (typeof value === 'string') {
				if (v.minLength !== undefined && value.length < v.minLength) {
					errors.push(`Parameter '${param.name}' must be at least ${v.minLength} characters`);
				}

				if (v.maxLength !== undefined && value.length > v.maxLength) {
					errors.push(`Parameter '${param.name}' must be at most ${v.maxLength} characters`);
				}

				if (v.pattern !== undefined) {
					// Limit tested string length to prevent ReDoS from catastrophic backtracking
					const MAX_PATTERN_TEST_LENGTH = 1000;

					if (value.length > MAX_PATTERN_TEST_LENGTH) {
						errors.push(
							`Parameter '${param.name}' is too long for pattern validation (max ${MAX_PATTERN_TEST_LENGTH} chars)`,
						);
					} else {
						try {
							if (!new RegExp(v.pattern).test(value)) {
								errors.push(`Parameter '${param.name}' does not match pattern '${v.pattern}'`);
							}
						} catch {
							errors.push(`Parameter '${param.name}' has invalid validation pattern '${v.pattern}'`);
						}
					}
				}
			}
		}

		// Resolve allowed options: prefer dynamic resolveOptions, fall back to static options
		const isSelectType = param.type === ActionParameterType.SELECT || param.type === ActionParameterType.MULTI_SELECT;

		if (isSelectType && (param.options || param.resolveOptions)) {
			let allowedOptions = param.options;

			if (param.resolveOptions) {
				try {
					allowedOptions = await param.resolveOptions();
				} catch {
					// If dynamic resolution fails, skip option validation rather than blocking execution
					this.logger.warn(`Failed to resolve options for parameter '${param.name}' during validation, skipping`);

					return;
				}
			}

			if (allowedOptions && allowedOptions.length > 0) {
				const allowedValues = allowedOptions.map((o) => o.value);

				if (param.type === ActionParameterType.SELECT) {
					if (!allowedValues.includes(value as string | number | boolean)) {
						errors.push(`Parameter '${param.name}' must be one of: ${allowedValues.join(', ')}`);
					}
				} else if (Array.isArray(value)) {
					for (const item of value) {
						if (!allowedValues.includes(item as string | number | boolean)) {
							errors.push(`Parameter '${param.name}' contains invalid value: ${String(item)}`);
						}
					}
				}
			}
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
