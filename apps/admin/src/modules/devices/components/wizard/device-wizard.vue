<template>
	<device-wizard-discover-step
		v-if="activeStep === 'discover'"
		data-test-id="wizard-step-discover"
		:rows="adapter.rows.value"
		:columns="adapter.columns"
		:controls="adapter.controls.value"
		:identifier-label="adapter.identifierLabel"
		:ready="adapter.ready.value"
	/>
	<device-wizard-select-step
		v-else-if="activeStep === 'select'"
		data-test-id="wizard-step-select"
		:rows="confirmationRows"
		:summary-rows="reviewedRows ?? adapter.rows.value"
		:columns="adapter.columns"
		:selected="selected"
		:name-by-key="nameByKey"
		:category-by-key="categoryByKey"
		:identifier-label="adapter.identifierLabel"
		@toggle-row="onToggleRow"
		@toggle-rows="onToggleRows"
	/>
	<device-wizard-confirm-step
		v-else-if="activeStep === 'confirm'"
		data-test-id="wizard-step-confirm"
		:rows="selectedConfirmationRows"
		:name-by-key="nameByKey"
		:category-by-key="categoryByKey"
		:identifier-label="adapter.identifierLabel"
		:confirmation-mode="adapter.confirmationMode ?? 'editable'"
		@update-name="onUpdateName"
		@update-category="onUpdateCategory"
	/>
	<device-wizard-results-step
		v-else
		data-test-id="wizard-step-results"
		:results="shownResults"
		:columns="adapter.columns"
		:identifier-label="adapter.identifierLabel"
		:retrying="adopting"
		@retry="(key: string) => onRetry([key])"
	/>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { useBreakpoints } from '../../../../common';
import type { DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import { STEP_ORDER, useDeviceWizardState } from '../../composables/useDeviceWizardState';
import { RouteNames } from '../../devices.constants';

import DeviceWizardConfirmStep from './device-wizard-confirm-step.vue';
import DeviceWizardDiscoverStep from './device-wizard-discover-step.vue';
import { useDeviceWizardFlow } from './device-wizard-flow';
import DeviceWizardResultsStep from './device-wizard-results-step.vue';
import DeviceWizardSelectStep from './device-wizard-select-step.vue';
import { buildWizardActions } from './device-wizard.actions';
import type { IDeviceWizardProps, IWizardAction, IWizardActionControl, IWizardResult, IWizardRow } from './device-wizard.types';
import { useWizardValidation } from './use-wizard-validation';

defineOptions({
	name: 'DeviceWizard',
});

const props = defineProps<IDeviceWizardProps>();

const { t } = useI18n();
const router = useRouter();
const { isLGDevice } = useBreakpoints();

// The factory must be invoked here, inside setup(): the adapter is a composable and calls
// useI18n / useBackend / inject internally, which are only valid in an injection context.
const adapter = props.adapterFactory();

// The user confirms this inventory snapshot. Background discovery and adoption updates must not
// rewrite its rows, selected names or categories while the confirmation request is running.
const reviewedRows = ref<IWizardRow[] | null>(null);
const adopting = ref(false);
const draftEdited = ref(false);
let deferredSessionReset = false;
const confirmationRows = computed(() => reviewedRows.value?.filter((row) => row.adoptable) ?? adoptableRows.value);
const selectedConfirmationRows = computed(() => confirmationRows.value.filter((row) => selected[row.key]));
// After a retry the results combine both rounds: the retried devices with their new outcome, the rest as they were
const mergedResults = ref<IWizardResult[] | null>(null);
const shownResults = computed<IWizardResult[]>(() => mergedResults.value ?? adapter.results.value);
const { activeStep, activeStepIndex, selected, nameByKey, categoryByKey, adoptableRows, reconcile, reset, buildSelection } = useDeviceWizardState(
	adapter.rows
);
const validation = useWizardValidation(activeStep, () => {
	const errors: Record<string, string | undefined> = {};
	for (const row of selectedConfirmationRows.value) {
		errors[`name:${row.key}`] = nameByKey[row.key]?.trim() ? undefined : t('devicesModule.fields.devices.name.validation.required');
		errors[`category:${row.key}`] = categoryByKey[row.key] ? undefined : t('devicesModule.fields.devices.category.validation.required');
	}
	return errors;
});

// A rescan opens a brand new discovery session, and the previous session's selections must not
// survive into it: a device that was `ready` last time may come back as `already_registered`,
// and a carried-over tick would silently overwrite its stored name and category on adopt.
// `restart()` handles this for adapters that declare `addMore`, but plugins without it (Shelly)
// reopen a session from a discover-step control the shell never sees — hence the session key.
// Both bounds must be non-null: the first session arriving (null → id) must NOT reset, or it
// would wipe the reconciliation that already ran against those rows.
//
// This watch MUST be registered before the `adapter.rows` watch below: in the Shelly adapters,
// both `rows` and `sessionKey` derive from the same `session` ref, so a rescan changes them in
// the same reactive flush, and Vue runs same-flush watchers in registration order. Reset-then-
// reconcile is the only correct order — reconcile-then-reset would wipe the reconciliation that
// just ran against the new session's rows, leaving the confirm step blank for about a second.
watch(
	() => adapter.sessionKey?.value ?? null,
	(next: string | null, previous: string | null): void => {
		if (next !== null && previous !== null && next !== previous) {
			if (adopting.value) {
				deferredSessionReset = true;
				return;
			}
			reviewedRows.value = null;
			validation.reset();
			reset();
			draftEdited.value = false;
		}
	}
);

watch(
	adapter.rows,
	(rows: IWizardRow[]): void => {
		if (!reviewedRows.value) reconcile(rows);
	},
	{ immediate: true }
);

onMounted(async (): Promise<void> => {
	try {
		await adapter.start();
	} catch {
		// Errors are surfaced by the adapter via flashMessage.
	}
});

onBeforeUnmount(async (): Promise<void> => {
	try {
		// Best-effort teardown — a failure here must never block navigation away.
		await adapter.dispose?.();
	} catch {
		// Errors are surfaced by the adapter via flashMessage.
	}
});

const onCancel = (): void => {
	if (adapter.busy.value) return;
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.DEVICES });
	} else {
		router.push({ name: RouteNames.DEVICES });
	}
};

// Failing to close a pairing window must not trap the user on the discover step, so we
// advance regardless of the outcome.
const onNext = async (): Promise<void> => {
	try {
		await adapter.beforeLeaveDiscover?.();
	} catch {
		// Errors are surfaced by the adapter via flashMessage.
	}

	if (!adoptableRows.value.length) return;
	activeStep.value = 'select';
};

const onReview = (): void => {
	if (!selectedConfirmationRows.value.length) return;
	activeStep.value = 'confirm';
};

const onBackToSelect = (): void => {
	activeStep.value = 'select';
};

const onBack = (): void => {
	activeStep.value = 'discover';
	if (deferredSessionReset) {
		reset();
		draftEdited.value = false;
		validation.reset();
		deferredSessionReset = false;
	}
	reviewedRows.value = null;
	reconcile(adapter.rows.value);
};

// Discovery keeps updating the rows until adoption starts: a device that becomes registered meanwhile loses its tick.
// When none is left to add, Confirm has nothing to confirm, so the flow returns to Select
watch(
	() => activeStep.value === 'confirm' && !adopting.value && !reviewedRows.value && selectedConfirmationRows.value.length === 0,
	(empty: boolean): void => {
		if (empty) activeStep.value = 'select';
	}
);

const onAdopt = async (): Promise<void> => {
	if (adapter.busy.value || adopting.value || !selectedConfirmationRows.value.length || !validation.validate()) return;
	reviewedRows.value ??= JSON.parse(JSON.stringify(adapter.rows.value)) as IWizardRow[];
	adopting.value = true;
	try {
		await adapter.adopt(buildSelection(reviewedRows.value));

		mergedResults.value = null;
		draftEdited.value = false;
		activeStep.value = 'results';
	} catch {
		// Stay on the confirm step with the user's input intact.
	} finally {
		adopting.value = false;
	}
};

// Two ordering constraints, and they pull in opposite directions.
//
// `reset()` must come BEFORE `restart()`. An adapter's `restart()` installs the replacement
// session before it resolves, which queues the `rows` watcher above; that watcher flushes
// before our `await` resumes, so the new session is already reconciled by the time we get
// here. Resetting afterwards would erase that — leaving the user on a fresh session with
// nothing selected and blank names until a later poll happened to reconcile it again. Same
// rule as the session-key watch above: reset, then reconcile.
//
// `activeStep` must come AFTER `restart()`. The new session has to be fully in place before
// the discover step renders, otherwise it mounts against a null session and flashes a
// misleading offline banner.
// Partial success: the failed devices go through adoption again with the names and categories confirmed for them
const onRetry = async (keys: string[]): Promise<void> => {
	if (adapter.busy.value || adopting.value || !reviewedRows.value) return;
	const retry = buildSelection(reviewedRows.value).filter((item) => keys.includes(item.key));
	if (!retry.length) return;
	// Held before the request: an adapter may clear its own results as soon as a new adoption starts
	const previous = shownResults.value.slice();
	mergedResults.value = previous;
	adopting.value = true;
	try {
		const outcome = await adapter.adopt(retry);
		mergedResults.value = previous.map((result) => outcome.find((item) => item.key === result.key) ?? result);
	} catch {
		// The earlier results stay; the adapter reports the error
		mergedResults.value = previous;
	} finally {
		adopting.value = false;
	}
};

const failedKeys = computed<string[]>(() => shownResults.value.filter((result) => result.status === 'failed').map((result) => result.key));

const onAddMore = async (): Promise<void> => {
	mergedResults.value = null;
	reviewedRows.value = null;
	deferredSessionReset = false;
	validation.reset();
	reset();
	draftEdited.value = false;

	try {
		await adapter.restart?.();
	} catch {
		// Errors are surfaced by the adapter via flashMessage.
	}

	activeStep.value = 'discover';
};

const onDone = (): void => {
	onCancel();
};

// The plugin's discovery actions ("Scan again", "Pair new device") are lifted out of the step
// body and into the action bar, so the discover step renders only its banners, progress and
// forms. `buildWizardActions` decides where they land and ignores them off the discover step.
const actionControls = computed<IWizardActionControl[]>(() =>
	adapter.controls.value.filter((control): control is IWizardActionControl => control.type === 'action')
);

const actions = computed<IWizardAction[]>(() =>
	buildWizardActions(activeStep.value, {
		t,
		capabilities: adapter.capabilities,
		canContinue: !adapter.busy.value && !adopting.value,
		hasAdoptable: adoptableRows.value.length > 0,
		hasSelection: selectedConfirmationRows.value.length > 0,
		failedCount: failedKeys.value.length,
		busy: adapter.busy.value || adopting.value,
		actionControls: actionControls.value,
		onCancel,
		onBack,
		onNext,
		onReview,
		onBackToSelect,
		onRetryFailed: () => onRetry(failedKeys.value),
		onAdopt,
		onAddMore,
		onDone,
	})
);

const onToggleRow = (key: string, value: boolean): void => {
	if (selected[key] !== value) draftEdited.value = true;
	selected[key] = value;
};

const onToggleRows = (keys: string[], value: boolean): void => {
	const allowed = new Set(confirmationRows.value.map((row) => row.key));
	for (const key of keys) if (allowed.has(key)) onToggleRow(key, value);
};
const onUpdateName = (key: string, value: string): void => {
	if (nameByKey[key] !== value) draftEdited.value = true;
	nameByKey[key] = value;
};

const onUpdateCategory = (key: string, value: DevicesModuleDeviceCategory | null): void => {
	if (categoryByKey[key] !== value) draftEdited.value = true;
	categoryByKey[key] = value;
};
useDeviceWizardFlow(
	computed(() => ({
		steps: STEP_ORDER.map((step) => t(`devicesModule.wizard.steps.${step}`)),
		activeStep: activeStepIndex.value,
		busy: adapter.busy.value || adopting.value,
		dirty: draftEdited.value,
		actions: actions.value,
		selectedCount: activeStep.value === 'select' || activeStep.value === 'confirm' ? selectedConfirmationRows.value.length : undefined,
		// Back to Discover or Select from the stepper, as Back does; Results is final
		goTo:
			activeStep.value === 'select' || activeStep.value === 'confirm'
				? (step: number): void => {
						if (adapter.busy.value || adopting.value) return;
						if (step === 0) onBack();
						else if (step === 1 && activeStep.value === 'confirm') onBackToSelect();
					}
				: undefined,
		stepWidth: 'table',
	}))
);
</script>
