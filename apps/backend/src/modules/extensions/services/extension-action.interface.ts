/**
 * Action execution mode.
 *
 * - `immediate`: Flat form with upfront parameters, REST execution, instant result (Phase 1)
 * - `interactive`: WebSocket terminal session for multi-step flows (Phase 2 - future)
 */
export type ActionMode = 'immediate' | 'interactive';

/**
 * Parameter types for action inputs.
 * Determines which form control the admin UI renders.
 */
export enum ActionParameterType {
	STRING = 'string',
	NUMBER = 'number',
	BOOLEAN = 'boolean',
	SELECT = 'select',
	MULTI_SELECT = 'multi_select',
}

/**
 * A single option for SELECT / MULTI_SELECT parameters.
 */
export interface IActionParameterOption {
	label: string;
	value: string | number | boolean;
}

/**
 * Validation constraints for action parameters.
 */
export interface IActionParameterValidation {
	min?: number;
	max?: number;
	pattern?: string;
	minLength?: number;
	maxLength?: number;
}

/**
 * Describes a single parameter for an extension action.
 */
export interface IActionParameter {
	/** Unique parameter key (used in the params object) */
	name: string;
	/** Human-readable label */
	label: string;
	/** Optional description / help text */
	description?: string;
	/** Parameter type determines the form control rendered in UI */
	type: ActionParameterType;
	/** Whether the parameter is required */
	required?: boolean;
	/** Default value */
	default?: string | number | boolean;
	/** Static options for SELECT / MULTI_SELECT */
	options?: IActionParameterOption[];
	/** Dynamic options resolver (called at fetch time, not registration time) */
	resolveOptions?(): Promise<IActionParameterOption[]>;
	/** Validation constraints */
	validation?: IActionParameterValidation;
}

/**
 * Categories to group actions visually in the UI.
 */
export enum ActionCategory {
	GENERAL = 'general',
	SIMULATION = 'simulation',
	DATA = 'data',
	DIAGNOSTICS = 'diagnostics',
	MAINTENANCE = 'maintenance',
}

/**
 * Result of executing an action.
 */
export interface IActionResult {
	/** Whether the action completed successfully */
	success: boolean;
	/** Short summary shown as a flash message in the UI */
	message?: string;
	/** Optional structured data returned to the UI */
	data?: Record<string, unknown>;
}

/**
 * Describes an action that an extension makes available.
 *
 * Extensions register actions during onModuleInit via the ExtensionActionRegistryService.
 * The admin UI discovers them via the REST API and renders appropriate controls.
 */
export interface IExtensionAction {
	/** Unique action ID within the extension (e.g., 'load-scenario') */
	id: string;
	/** Human-readable action name */
	label: string;
	/** Longer description of what the action does */
	description?: string;
	/** MDI icon name (e.g., 'mdi:play') */
	icon?: string;
	/** Group actions visually */
	category?: ActionCategory;
	/** Execution mode: immediate (REST) or interactive (WebSocket, future) */
	mode: ActionMode;
	/** If true, UI shows a confirmation dialog before executing */
	dangerous?: boolean;
	/** Action parameters (rendered as a form in the UI for immediate mode) */
	parameters?: IActionParameter[];
	/** Handler for immediate mode actions. Receives validated parameters, returns result. */
	execute?(params: Record<string, unknown>): Promise<IActionResult>;
}
