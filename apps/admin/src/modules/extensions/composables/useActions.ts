import { type InjectionKey, type Ref, inject, provide, ref } from 'vue';

import { useBackend } from '../../../common';

/**
 * Action parameter option (for select/multi_select).
 */
export interface IActionParameterOption {
	label: string;
	value: string | number | boolean;
}

/**
 * Action parameter validation constraints.
 */
export interface IActionParameterValidation {
	min?: number;
	max?: number;
	pattern?: string;
	min_length?: number;
	max_length?: number;
}

/**
 * Describes a single action parameter.
 */
export interface IActionParameter {
	name: string;
	label: string;
	description?: string;
	type: 'string' | 'number' | 'boolean' | 'select' | 'multi_select';
	required?: boolean;
	default?: string | number | boolean;
	options?: IActionParameterOption[];
	validation?: IActionParameterValidation;
}

/**
 * Describes an extension action.
 */
export interface IExtensionActionDescriptor {
	id: string;
	label: string;
	description?: string;
	icon?: string;
	category?: string;
	mode: 'immediate' | 'interactive';
	dangerous?: boolean;
	parameters?: IActionParameter[];
}

/**
 * Result of executing an action.
 */
export interface IActionResult {
	success: boolean;
	message?: string;
	data?: Record<string, unknown>;
}

export interface IUseActions {
	actions: Ref<IExtensionActionDescriptor[]>;
	isLoading: Ref<boolean>;
	executingActions: Ref<Set<string>>;
	fetchActions: (extensionType: string) => Promise<void>;
	executeAction: (extensionType: string, actionId: string, params?: Record<string, unknown>) => Promise<IActionResult>;
}

/**
 * Composable for fetching and executing extension actions.
 *
 * Uses the raw backend client since action endpoints are not yet
 * part of the generated OpenAPI types.
 */
export const useActions = (): IUseActions => {
	const backend = useBackend();

	const actions = ref<IExtensionActionDescriptor[]>([]);
	const isLoading = ref<boolean>(false);
	const executingActions = ref<Set<string>>(new Set());

	const fetchActions = async (extensionType: string): Promise<void> => {
		isLoading.value = true;

		try {
			/* eslint-disable @typescript-eslint/no-explicit-any -- action endpoints not yet in generated OpenAPI types */
			const { data: responseData } = await (backend.client as any).GET(
				`/modules/extensions/extensions/${extensionType}/actions` as any,
			);
			/* eslint-enable @typescript-eslint/no-explicit-any */

			if (responseData?.data) {
				actions.value = responseData.data as IExtensionActionDescriptor[];
			} else {
				actions.value = [];
			}
		} catch {
			actions.value = [];
		} finally {
			isLoading.value = false;
		}
	};

	const executeAction = async (
		extensionType: string,
		actionId: string,
		params?: Record<string, unknown>,
	): Promise<IActionResult> => {
		executingActions.value.add(actionId);

		try {
			/* eslint-disable @typescript-eslint/no-explicit-any -- action endpoints not yet in generated OpenAPI types */
			const { data: responseData, error } = await (backend.client as any).POST(
				`/modules/extensions/extensions/${extensionType}/actions/${actionId}` as any,
				{
					body: {
						data: {
							params: params ?? {},
						},
					},
				},
			);
			/* eslint-enable @typescript-eslint/no-explicit-any */

			if (responseData?.data) {
				return responseData.data as IActionResult;
			}

			return {
				success: false,
				message: error?.error?.message ?? 'Action execution failed',
			};
		} catch (err) {
			return {
				success: false,
				message: err instanceof Error ? err.message : 'Action execution failed',
			};
		} finally {
			executingActions.value.delete(actionId);
		}
	};

	return {
		actions,
		isLoading,
		executingActions,
		fetchActions,
		executeAction,
	};
};

const ACTIONS_KEY: InjectionKey<IUseActions> = Symbol('useActions');

/**
 * Create and provide a useActions instance for child components to inject.
 */
export const useActionsProvider = (): IUseActions => {
	const instance = useActions();
	provide(ACTIONS_KEY, instance);

	return instance;
};

/**
 * Inject the useActions instance provided by a parent component.
 * Falls back to creating a new instance if no parent provided one.
 */
export const useActionsInjection = (): IUseActions => {
	const injected = inject(ACTIONS_KEY, null);

	return injected ?? useActions();
};
