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
	required_roles?: string[];
	allowed?: boolean;
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

/**
 * A single action execution history record.
 */
export interface IActionHistoryRecord {
	id: string;
	extension_type: string;
	action_id: string;
	user_id: string | null;
	user_role: string | null;
	success: boolean;
	message: string | null;
	duration_ms: number;
	timestamp: string;
}

export interface IUseActions {
	actions: Ref<IExtensionActionDescriptor[]>;
	isLoading: Ref<boolean>;
	executingActions: Ref<Map<string, number>>;
	fetchActions: (extensionType: string) => Promise<void>;
	executeAction: (extensionType: string, actionId: string, params?: Record<string, unknown>) => Promise<IActionResult>;
	fetchActionHistory: (extensionType: string, actionId: string) => Promise<IActionHistoryRecord[]>;
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
	const executingActions = ref<Map<string, number>>(new Map());

	let fetchSequence = 0;

	const fetchActions = async (extensionType: string): Promise<void> => {
		const thisSequence = ++fetchSequence;

		isLoading.value = true;

		try {
			const { data: responseData } = await backend.client.GET(
				'/modules/extensions/extensions/{type}/actions',
				{ params: { path: { type: extensionType } } },
			);

			// Discard stale responses from earlier navigations
			if (thisSequence !== fetchSequence) {
				return;
			}

			if (responseData?.data) {
				actions.value = responseData.data;
			} else {
				actions.value = [];
			}
		} catch {
			if (thisSequence !== fetchSequence) {
				return;
			}

			actions.value = [];
		} finally {
			if (thisSequence === fetchSequence) {
				isLoading.value = false;
			}
		}
	};

	const executeAction = async (
		extensionType: string,
		actionId: string,
		params?: Record<string, unknown>,
	): Promise<IActionResult> => {
		const count = executingActions.value.get(actionId) ?? 0;
		executingActions.value.set(actionId, count + 1);

		try {
			const { data: responseData, error } = await backend.client.POST(
				'/modules/extensions/extensions/{type}/actions/{actionId}',
				{
					params: { path: { type: extensionType, actionId } },
					body: {
						data: {
							params: params ?? {},
						},
					},
				},
			);

			if (responseData?.data) {
				return responseData.data;
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
			const remaining = (executingActions.value.get(actionId) ?? 1) - 1;

			if (remaining <= 0) {
				executingActions.value.delete(actionId);
			} else {
				executingActions.value.set(actionId, remaining);
			}
		}
	};

	const fetchActionHistory = async (extensionType: string, actionId: string): Promise<IActionHistoryRecord[]> => {
		try {
			const { data: responseData } = await backend.client.GET(
				'/modules/extensions/extensions/{type}/actions/{actionId}/history',
				{ params: { path: { type: extensionType, actionId } } },
			);

			if (responseData?.data) {
				return responseData.data;
			}

			return [];
		} catch {
			return [];
		}
	};

	return {
		actions,
		isLoading,
		executingActions,
		fetchActions,
		executeAction,
		fetchActionHistory,
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
