import { type Reactive, reactive, ref } from 'vue';

import type { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IWizardRow } from '../components/wizard/device-wizard.types';

export interface IUseDeviceWizardState {
	selected: Reactive<Record<string, boolean>>;
	nameByKey: Reactive<Record<string, string>>;
	categoryByKey: Reactive<Record<string, DevicesModuleDeviceCategory | null>>;
	reconcile: (rows: IWizardRow[]) => void;
	reset: () => void;
}

export const useDeviceWizardState = (): IUseDeviceWizardState => {
	const selected = reactive<Record<string, boolean>>({});
	const nameByKey = reactive<Record<string, string>>({});
	const categoryByKey = reactive<Record<string, DevicesModuleDeviceCategory | null>>({});

	// Rows observed on the previous reconcile, used to detect status transitions.
	const previousRows = ref<IWizardRow[]>([]);

	// Keys that have been seen in the `ready` state at least once. Guards against
	// re-selecting a device the user deliberately deselected: without it, every poll
	// that reports the device as still `ready` would flip the checkbox back on.
	const everReady = new Set<string>();

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
		selected,
		nameByKey,
		categoryByKey,
		reconcile,
		reset,
	};
};
