/**
 * Action execution mode.
 *
 * - `immediate`: Flat form with upfront parameters, REST execution, instant result
 * - `interactive`: WebSocket terminal session for multi-step flows (future)
 */
export type ActionMode = 'immediate' | 'interactive';

/**
 * Parameter types for action inputs.
 */
export type ActionParameterType = 'string' | 'number' | 'boolean' | 'select' | 'multi_select';

/**
 * A single option for select / multi_select parameters.
 */
export interface ActionParameterOption {
	label: string;
	value: string | number | boolean;
}

/**
 * Validation constraints for action parameters.
 */
export interface ActionParameterValidation {
	min?: number;
	max?: number;
	pattern?: string;
	minLength?: number;
	maxLength?: number;
}

/**
 * Describes a single parameter for an extension action.
 */
export interface ActionParameter {
	/** Unique parameter key */
	name: string;
	/** Human-readable label */
	label: string;
	/** Optional help text */
	description?: string;
	/** Parameter type determines the form control */
	type: ActionParameterType;
	/** Whether the parameter is required */
	required?: boolean;
	/** Default value */
	default?: string | number | boolean;
	/** Static options for select types */
	options?: ActionParameterOption[];
	/** Dynamic options resolver (called at fetch time) */
	resolveOptions?(): Promise<ActionParameterOption[]>;
	/** Validation constraints */
	validation?: ActionParameterValidation;
}

/**
 * Action category for UI grouping.
 */
export type ActionCategory = 'general' | 'simulation' | 'data' | 'diagnostics' | 'maintenance';

/**
 * Result of executing an action.
 */
export interface ActionResult {
	success: boolean;
	message?: string;
	data?: Record<string, unknown>;
}

/**
 * Describes an action that an extension makes available.
 *
 * Extensions register actions during onModuleInit via ExtensionActionRegistryService.
 */
export interface ExtensionAction {
	/** Unique action ID within the extension */
	id: string;
	/** Human-readable action name */
	label: string;
	/** Description of what the action does */
	description?: string;
	/** MDI icon name (e.g., 'mdi:play') */
	icon?: string;
	/** Category for UI grouping */
	category?: ActionCategory;
	/** Execution mode */
	mode: ActionMode;
	/** Whether the action requires confirmation */
	dangerous?: boolean;
	/** Action parameters */
	parameters?: ActionParameter[];
	/** Handler for immediate mode actions */
	execute?(params: Record<string, unknown>): Promise<ActionResult>;
}
