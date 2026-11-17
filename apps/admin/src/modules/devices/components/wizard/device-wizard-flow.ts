import {
	type ComputedRef,
	type InjectionKey,
	type Reactive,
	type ShallowRef,
	hasInjectionContext,
	inject,
	onScopeDispose,
	reactive,
	ref,
	shallowRef,
} from 'vue';

import type { IWizardAction } from './device-wizard.types';

/** A plugin registers reactive step state; the shared shell renders all page chrome and actions. */
export interface IDeviceWizardFlow {
	steps: string[];
	activeStep: number;
	busy: boolean;
	dirty?: boolean;
	actions: IWizardAction[];
}

export interface IDeviceWizardContext {
	flow: ShallowRef<ComputedRef<IDeviceWizardFlow> | null>;
	completed: import('vue').Ref<boolean>;
	data: Map<string, object>;
}

export const deviceWizardContextKey: InjectionKey<IDeviceWizardContext> = Symbol('device-wizard-context');

export const createDeviceWizardContext = (): IDeviceWizardContext => ({ flow: shallowRef(null), completed: ref(false), data: new Map() });

export const useDeviceWizardFlow = (flow: ComputedRef<IDeviceWizardFlow>): void => {
	const context = inject(deviceWizardContextKey, null);
	if (!context) return;
	context.flow.value = flow;
	onScopeDispose(() => {
		if (context.flow.value === flow) context.flow.value = null;
	});
};

export const useDeviceWizardComplete = (): (() => void) => {
	const context = inject(deviceWizardContextKey, null);
	return () => {
		if (context) context.completed.value = true;
	};
};

/** Data belongs to this wrapper session and survives replacement of individual step components. */
export const useDeviceWizardData = <T extends object>(key: string, initial: () => T): Reactive<T> => {
	const context = hasInjectionContext() ? inject(deviceWizardContextKey, null) : null;
	const existing = context?.data.get(key) as Reactive<T> | undefined;
	if (existing) return existing;
	const data = reactive(initial());
	context?.data.set(key, data);
	return data;
};
