<template>
	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:wizard-hat"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ adapter.title }}
		</template>

		<template #subtitle>
			{{ adapter.subtitle }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="onCancel"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:heading="adapter.title"
		:sub-heading="adapter.subtitle"
		icon="mdi:wizard-hat"
	>
		<template
			v-if="isMDDevice"
			#extra
		>
			<div class="flex items-center gap-2">
				<el-button
					v-for="action in actions"
					:key="action.id"
					:data-test-id="`wizard-action-${action.id}`"
					:link="action.variant === 'link'"
					:type="action.variant === 'primary' ? 'primary' : undefined"
					class="px-4!"
					:disabled="action.disabled"
					:loading="action.loading"
					@click="action.handler"
				>
					{{ action.label }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2">
		<el-card
			shadow="never"
			class="max-h-full flex flex-col overflow-hidden box-border"
			body-class="p-0! max-h-full overflow-hidden flex flex-col"
		>
			<template #header>
				<el-steps
					:active="activeStepIndex"
					finish-status="success"
					align-center
				>
					<el-step :title="t('devicesModule.wizard.steps.discover')" />
					<el-step :title="t('devicesModule.wizard.steps.confirm')" />
					<el-step :title="t('devicesModule.wizard.steps.results')" />
				</el-steps>
			</template>

			<div class="p-4 max-h-full box-border flex flex-col gap-3 overflow-hidden">
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
					:rows="adoptableRows"
					:columns="adapter.columns"
					:selected="selected"
					:name-by-key="nameByKey"
					:category-by-key="categoryByKey"
					:identifier-label="adapter.identifierLabel"
					:all-selected="allSelected"
					:some-selected="someSelected"
					@toggle-all="toggleAll"
					@toggle-row="onToggleRow"
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
			</div>

			<div
				v-if="!isMDDevice"
				class="flex justify-end gap-2 p-4 border-t border-t-solid"
			>
				<el-button
					v-for="action in actions"
					:key="action.id"
					:data-test-id="`wizard-action-mobile-${action.id}`"
					:link="action.variant === 'link'"
					:type="action.variant === 'primary' ? 'primary' : undefined"
					:disabled="action.disabled"
					:loading="action.loading"
					@click="action.handler"
				>
					{{ action.label }}
				</el-button>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElCard, ElIcon, ElStep, ElSteps } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../../common';
import type { DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import { useDeviceWizardState } from '../../composables/useDeviceWizardState';
import { RouteNames } from '../../devices.constants';

import DeviceWizardConfirmStep from './device-wizard-confirm-step.vue';
import DeviceWizardDiscoverStep from './device-wizard-discover-step.vue';
import DeviceWizardResultsStep from './device-wizard-results-step.vue';
import { buildWizardActions } from './device-wizard.actions';
import type { IDeviceWizardProps, IWizardAction, IWizardRow } from './device-wizard.types';

defineOptions({
	name: 'DeviceWizard',
});

const props = defineProps<IDeviceWizardProps>();

const { t } = useI18n();
const router = useRouter();
const { isMDDevice, isLGDevice } = useBreakpoints();

// The factory must be invoked here, inside setup(): the adapter is a composable and calls
// useI18n / useBackend / inject internally, which are only valid in an injection context.
const adapter = props.adapterFactory();

const {
	activeStep,
	activeStepIndex,
	selected,
	nameByKey,
	categoryByKey,
	adoptableRows,
	canContinue,
	allSelected,
	someSelected,
	toggleAll,
	reconcile,
	reset,
	buildSelection,
} = useDeviceWizardState(adapter.rows);

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
			reset();
		}
	}
);

watch(
	adapter.rows,
	(rows: IWizardRow[]): void => {
		reconcile(rows);
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

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(() => [
	{
		label: t('devicesModule.breadcrumbs.devices.list'),
		route: router.resolve({ name: RouteNames.DEVICES }),
	},
	{
		label: adapter.breadcrumbLabel,
		route: router.resolve({
			name: RouteNames.DEVICES_WIZARD,
			params: { type: adapter.pluginType },
		}),
	},
]);

const onCancel = (): void => {
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

	activeStep.value = 'confirm';
};

const onBack = (): void => {
	activeStep.value = 'discover';
};

const onAdopt = async (): Promise<void> => {
	try {
		await adapter.adopt(buildSelection());

		activeStep.value = 'results';
	} catch {
		// Stay on the confirm step with the user's input intact.
	}
};

// Order matters: the new session must be fully in place before the discover step renders,
// otherwise it mounts against a null session and flashes a misleading offline banner.
const onAddMore = async (): Promise<void> => {
	try {
		await adapter.restart?.();
	} catch {
		// Errors are surfaced by the adapter via flashMessage.
	}

	reset();

	activeStep.value = 'discover';
};

const onDone = (): void => {
	onCancel();
};

const actions = computed<IWizardAction[]>(() =>
	buildWizardActions(activeStep.value, {
		t,
		capabilities: adapter.capabilities,
		canContinue: canContinue.value,
		hasAdoptable: adoptableRows.value.length > 0,
		busy: adapter.busy.value,
		onCancel,
		onBack,
		onNext,
		onAdopt,
		onAddMore,
		onDone,
	})
);

const onToggleRow = (key: string, value: boolean): void => {
	selected[key] = value;
};

const onUpdateName = (key: string, value: string): void => {
	nameByKey[key] = value;
};

const onUpdateCategory = (key: string, value: DevicesModuleDeviceCategory | null): void => {
	categoryByKey[key] = value;
};
</script>
