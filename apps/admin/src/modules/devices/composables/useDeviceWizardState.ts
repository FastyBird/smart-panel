import { type ComputedRef, type Reactive, type Ref, computed, reactive, ref } from 'vue';

import type { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IWizardAdoptSelection, IWizardRow, IWizardStep } from '../components/wizard/device-wizard.types';

export interface IUseDeviceWizardState {
	activeStep: Ref<IWizardStep>;
	activeStepIndex: ComputedRef<number>;
	selected: Reactive<Record<string, boolean>>;
	nameByKey: Reactive<Record<string, string>>;
	categoryByKey: Reactive<Record<string, DevicesModuleDeviceCategory | null>>;
	adoptableRows: ComputedRef<IWizardRow[]>;
	selectedRows: ComputedRef<IWizardRow[]>;
	canContinue: ComputedRef<boolean>;
	allSelected: ComputedRef<boolean>;
	someSelected: ComputedRef<boolean>;
	toggleAll: (value: boolean) => void;
	reconcile: (rows: IWizardRow[]) => void;
	reset: () => void;
	buildSelection: () => IWizardAdoptSelection[];
}

export const useDeviceWizardState = (rows: Ref<IWizardRow[]> | ComputedRef<IWizardRow[]> = ref([])): IUseDeviceWizardState => {
	const selected = reactive<Record<string, boolean>>({});
	const nameByKey = reactive<Record<string, string>>({});
	const categoryByKey = reactive<Record<string, DevicesModuleDeviceCategory | null>>({});

	// Rows observed on the previous reconcile, used to detect status transitions.
	const previousRows = ref<IWizardRow[]>([]);

	// Keys that have been seen in the `ready` state at least once. Guards against
	// re-selecting a device the user deliberately deselected: without it, every poll
	// that reports the device as still `ready` would flip the checkbox back on.
	const everReady = new Set<string>();

	const activeStep = ref<IWizardStep>('discover');

	const activeStepIndex = computed<number>(() => {
		if (activeStep.value === 'confirm') {
			return 1;
		}

		if (activeStep.value === 'results') {
			return 2;
		}

		return 0;
	});

	const adoptableRows = computed<IWizardRow[]>(() => rows.value.filter((item) => item.adoptable));

	const selectedRows = computed<IWizardRow[]>(() => adoptableRows.value.filter((item) => selected[item.key] === true));

	const canContinue = computed<boolean>(() => {
		if (selectedRows.value.length === 0) {
			return false;
		}

		return selectedRows.value.every((item) => {
			const name = nameByKey[item.key];
			const category = categoryByKey[item.key];

			return typeof name === 'string' && name.trim().length > 0 && category !== null && category !== undefined;
		});
	});

	const allSelected = computed<boolean>(() => adoptableRows.value.length > 0 && adoptableRows.value.every((item) => selected[item.key] === true));

	const someSelected = computed<boolean>(() => adoptableRows.value.some((item) => selected[item.key] === true));

	const toggleAll = (value: boolean): void => {
		for (const item of adoptableRows.value) {
			selected[item.key] = value;
		}
	};

	const buildSelection = (): IWizardAdoptSelection[] =>
		selectedRows.value.map((item) => ({
			key: item.key,
			name: (nameByKey[item.key] ?? item.suggestedName).trim(),
			category: categoryByKey[item.key] as DevicesModuleDeviceCategory,
		}));

	const reconcile = (rows: IWizardRow[]): void => {
		for (const row of rows) {
			const previous = previousRows.value.find((item) => item.key === row.key);

			const firstTimeReady = row.status === 'ready' && !everReady.has(row.key);
			const becameAlreadyRegistered = previous !== undefined && previous.status !== 'already_registered' && row.status === 'already_registered';
			const becameAdoptable = previous !== undefined && !previous.adoptable && row.adoptable;

			// Pre-select ready devices on first sight and on their first transition to ready,
			// but never resurrect a selection the user cleared.
			if (selected[row.key] === undefined || firstTimeReady) {
				selected[row.key] = row.status === 'ready';
			} else if (becameAlreadyRegistered) {
				// The background connector adopted this device mid-session. Updating it is now
				// an explicit opt-in rather than the default.
				selected[row.key] = false;
			}

			// Fill the editable name from the adapter's suggestion. Refresh it when a device
			// finishes inspection while the field still shows the raw identifier placeholder —
			// otherwise an `already_registered` device would keep the placeholder and overwrite
			// the existing registered name on update.
			if (nameByKey[row.key] === undefined || (becameAdoptable && nameByKey[row.key] === row.identifier)) {
				nameByKey[row.key] = row.suggestedName;
			}

			// Fill in a late-arriving suggestion, but never overwrite a real choice.
			if (categoryByKey[row.key] === undefined || (categoryByKey[row.key] === null && row.suggestedCategory !== null)) {
				categoryByKey[row.key] = row.suggestedCategory;
			}

			if (row.status === 'ready') {
				everReady.add(row.key);
			}
		}

		previousRows.value = rows.slice();
	};

	const reset = (): void => {
		for (const key of Object.keys(selected)) {
			delete selected[key];
		}

		for (const key of Object.keys(nameByKey)) {
			delete nameByKey[key];
		}

		for (const key of Object.keys(categoryByKey)) {
			delete categoryByKey[key];
		}

		everReady.clear();
		previousRows.value = [];
	};

	return {
		activeStep,
		activeStepIndex,
		selected,
		nameByKey,
		categoryByKey,
		adoptableRows,
		selectedRows,
		canContinue,
		allSelected,
		someSelected,
		toggleAll,
		reconcile,
		reset,
		buildSelection,
	};
};
