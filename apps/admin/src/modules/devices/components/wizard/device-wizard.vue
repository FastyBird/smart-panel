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
	<device-wizard-confirm-step
		v-else-if="activeStep === 'confirm'"
		data-test-id="wizard-step-confirm"
		:rows="confirmationRows"
		:summary-rows="reviewedRows ?? adapter.rows.value"
		:columns="adapter.columns"
		:selected="selected"
		:name-by-key="nameByKey"
		:category-by-key="categoryByKey"
		:identifier-label="adapter.identifierLabel"
		:confirmation-mode="adapter.confirmationMode ?? 'editable'"
		@toggle-row="onToggleRow"
		@toggle-rows="onToggleRows"
		@update-name="onUpdateName"
		@update-category="onUpdateCategory"
	/>
	<device-wizard-results-step
		v-else
		data-test-id="wizard-step-results"
		:results="adapter.results.value"
		:columns="adapter.columns"
		:identifier-label="adapter.identifierLabel"
	/>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { useBreakpoints } from '../../../../common';
import type { DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import { useDeviceWizardState } from '../../composables/useDeviceWizardState';
import { RouteNames } from '../../devices.constants';

import DeviceWizardConfirmStep from './device-wizard-confirm-step.vue';
import DeviceWizardDiscoverStep from './device-wizard-discover-step.vue';
import { useDeviceWizardFlow } from './device-wizard-flow';
import DeviceWizardResultsStep from './device-wizard-results-step.vue';
import { buildWizardActions } from './device-wizard.actions';
import type { IDeviceWizardProps, IWizardAction, IWizardActionControl, IWizardRow } from './device-wizard.types';
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
const { activeStep, activeStepIndex, selected, nameByKey, categoryByKey, adoptableRows, reconcile, reset, buildSelection } = useDeviceWizardState(
	adapter.rows
);
const validation = useWizardValidation(activeStep, () => {
	const selectedRows = confirmationRows.value.filter((row) => selected[row.key]);
	const errors: Record<string, string | undefined> = {
		selection: selectedRows.length ? undefined : t('devicesModule.wizard.validation.minimumItems', { count: 1 }),
	};
	for (const row of selectedRows) {
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
	activeStep.value = 'confirm';
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

const onAdopt = async (): Promise<void> => {
	if (adapter.busy.value || adopting.value || !validation.validate()) return;
	reviewedRows.value ??= JSON.parse(JSON.stringify(adapter.rows.value)) as IWizardRow[];
	adopting.value = true;
	try {
		await adapter.adopt(buildSelection(reviewedRows.value));

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
const onAddMore = async (): Promise<void> => {
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
		busy: adapter.busy.value || adopting.value,
		actionControls: actionControls.value,
		onCancel,
		onBack,
		onNext,
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
		steps: ['discover', 'confirm', 'results'].map((step) => t(`devicesModule.wizard.steps.${step}`)),
		activeStep: activeStepIndex.value,
		busy: adapter.busy.value || adopting.value,
		dirty: draftEdited.value,
		actions: actions.value,
	}))
);
</script>
