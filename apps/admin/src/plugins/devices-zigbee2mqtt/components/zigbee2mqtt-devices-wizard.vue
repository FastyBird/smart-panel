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
			{{ t('devicesZigbee2mqttPlugin.wizard.title') }}
		</template>

		<template #subtitle>
			{{ t('devicesZigbee2mqttPlugin.wizard.subtitle') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="handleCancel"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:heading="t('devicesZigbee2mqttPlugin.wizard.title')"
		:sub-heading="t('devicesZigbee2mqttPlugin.wizard.subtitle')"
		icon="mdi:wizard-hat"
	>
		<template
			v-if="isMDDevice"
			#extra
		>
			<div class="flex items-center gap-2">
				<el-button
					v-if="activeStep !== 'results'"
					link
					class="px-4!"
					@click="handleCancel"
				>
					{{ t('devicesZigbee2mqttPlugin.wizard.actions.cancel') }}
				</el-button>

				<template v-if="activeStep === 'discovery'">
					<el-button
						type="primary"
						class="px-4!"
						:disabled="selectedDevices.length === 0"
						@click="goToCategorize"
					>
						{{ t('devicesZigbee2mqttPlugin.wizard.actions.next') }}
					</el-button>
				</template>

				<template v-else-if="activeStep === 'categorize'">
					<el-button
						class="px-4!"
						@click="goBack"
					>
						{{ t('devicesZigbee2mqttPlugin.wizard.actions.back') }}
					</el-button>
					<el-button
						type="primary"
						class="px-4!"
						:disabled="!canContinue"
						:loading="isAdopting"
						@click="onAdopt"
					>
						{{ t('devicesZigbee2mqttPlugin.wizard.actions.adopt') }}
					</el-button>
				</template>
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
					<el-step :title="t('devicesZigbee2mqttPlugin.wizard.steps.discovery.title')" />
					<el-step :title="t('devicesZigbee2mqttPlugin.wizard.steps.categorize.title')" />
					<el-step :title="t('devicesZigbee2mqttPlugin.wizard.steps.results.title')" />
				</el-steps>
			</template>

			<div class="p-4 max-h-full box-border flex flex-col gap-3 overflow-hidden">
				<Zigbee2mqttWizardDiscoveryStep
					v-if="activeStep === 'discovery'"
					:devices="devices"
					:selected="selected"
					:permit-join="permitJoin"
					:bridge-online="bridgeOnline"
					:session-ready="sessionReady"
					:permit-join-pending="isPermitJoinPending"
					@enable-permit-join="onEnablePermitJoin"
					@disable-permit-join="onDisablePermitJoin"
					@update:selected="onUpdateSelected"
				/>

				<Zigbee2mqttWizardCategorizeStep
					v-else-if="activeStep === 'categorize'"
					:devices="devices"
					:selected="selected"
					:name-by-ieee="nameByIeee"
					:category-by-ieee="categoryByIeee"
					:category-options="categoryOptions"
					@update:name-by-ieee="onUpdateNameByIeee"
					@update:category-by-ieee="onUpdateCategoryByIeee"
				/>

				<Zigbee2mqttWizardResultsStep
					v-else
					:results="adoptionResults"
					:devices="devices"
					@done="onDone"
					@restart="onRestart"
				/>
			</div>

			<div
				v-if="!isMDDevice && activeStep !== 'results'"
				class="flex justify-between gap-2 p-4 border-t border-t-solid"
			>
				<template v-if="activeStep === 'discovery'">
					<el-button @click="handleCancel">
						{{ t('devicesZigbee2mqttPlugin.wizard.actions.cancel') }}
					</el-button>
					<el-button
						type="primary"
						:disabled="selectedDevices.length === 0"
						@click="goToCategorize"
					>
						{{ t('devicesZigbee2mqttPlugin.wizard.actions.next') }}
					</el-button>
				</template>

				<template v-else-if="activeStep === 'categorize'">
					<el-button @click="goBack">
						{{ t('devicesZigbee2mqttPlugin.wizard.actions.back') }}
					</el-button>
					<div class="flex gap-2">
						<el-button @click="handleCancel">
							{{ t('devicesZigbee2mqttPlugin.wizard.actions.cancel') }}
						</el-button>
						<el-button
							type="primary"
							:disabled="!canContinue"
							:loading="isAdopting"
							@click="onAdopt"
						>
							{{ t('devicesZigbee2mqttPlugin.wizard.actions.adopt') }}
						</el-button>
					</div>
				</template>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElCard, ElIcon, ElStep, ElSteps } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints, useFlashMessage } from '../../../common';
import { RouteNames as DevicesRouteNames } from '../../../modules/devices/devices.constants';
import { type DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { useDevicesWizard } from '../composables/useDevicesWizard';

import Zigbee2mqttWizardCategorizeStep from './zigbee2mqtt-wizard-categorize-step.vue';
import Zigbee2mqttWizardDiscoveryStep from './zigbee2mqtt-wizard-discovery-step.vue';
import Zigbee2mqttWizardResultsStep from './zigbee2mqtt-wizard-results-step.vue';

defineOptions({
	name: 'Zigbee2mqttDevicesWizard',
});

const { t } = useI18n();
const router = useRouter();
const flashMessage = useFlashMessage();
const { isMDDevice, isLGDevice } = useBreakpoints();

const {
	devices,
	selected,
	nameByIeee,
	categoryByIeee,
	selectedDevices,
	permitJoin,
	bridgeOnline,
	sessionReady,
	canContinue,
	adoptionResults,
	enablePermitJoin,
	disablePermitJoin,
	adoptSelected,
	endSession,
	startSession,
	categoryOptions,
} = useDevicesWizard();

type WizardStep = 'discovery' | 'categorize' | 'results';

const activeStep = ref<WizardStep>('discovery');
const isAdopting = ref<boolean>(false);
const isPermitJoinPending = ref<boolean>(false);

const activeStepIndex = computed<number>(() => {
	if (activeStep.value === 'categorize') {
		return 1;
	}

	if (activeStep.value === 'results') {
		return 2;
	}

	return 0;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(() => [
	{
		label: t('devicesModule.breadcrumbs.devices.list'),
		route: router.resolve({ name: DevicesRouteNames.DEVICES }),
	},
	{
		label: t('devicesZigbee2mqttPlugin.wizard.breadcrumb'),
		route: router.resolve({
			name: DevicesRouteNames.DEVICES_WIZARD,
			params: { type: 'devices-zigbee2mqtt-plugin' },
		}),
	},
]);

// The step components emit fresh maps; sync them back into the reactive maps owned by the
// composable so its derived state (`selectedDevices`, `canContinue`, …) updates immediately.
const onUpdateSelected = (value: Record<string, boolean>): void => {
	for (const key of Object.keys(selected)) {
		if (!(key in value)) {
			delete selected[key];
		}
	}

	Object.assign(selected, value);
};

const onUpdateNameByIeee = (value: Record<string, string>): void => {
	for (const key of Object.keys(nameByIeee)) {
		if (!(key in value)) {
			delete nameByIeee[key];
		}
	}

	Object.assign(nameByIeee, value);
};

const onUpdateCategoryByIeee = (value: Record<string, DevicesModuleDeviceCategory | null>): void => {
	for (const key of Object.keys(categoryByIeee)) {
		if (!(key in value)) {
			delete categoryByIeee[key];
		}
	}

	Object.assign(categoryByIeee, value);
};

// Track in-flight permit_join toggles separately so the discovery step can disable / show
// loading on the pair / cancel buttons during the round-trip. Errors are already surfaced by
// the composable via flashMessage; we just need to release the pending flag either way.
const onEnablePermitJoin = async (): Promise<void> => {
	isPermitJoinPending.value = true;

	try {
		await enablePermitJoin();
	} catch {
		// Error already surfaced by the composable.
	} finally {
		isPermitJoinPending.value = false;
	}
};

const onDisablePermitJoin = async (): Promise<void> => {
	isPermitJoinPending.value = true;

	try {
		await disablePermitJoin();
	} catch {
		// Error already surfaced by the composable.
	} finally {
		isPermitJoinPending.value = false;
	}
};

const goToCategorize = async (): Promise<void> => {
	// Pairing should never be left active once the user moves on — silently turn it off so the
	// gateway stops accepting new joins while the categorize step is in focus.
	if (permitJoin.value.active) {
		try {
			await disablePermitJoin();
			flashMessage.info(t('devicesZigbee2mqttPlugin.wizard.steps.discovery.pairingDisabled'));
		} catch {
			// Errors are surfaced by the composable via flashMessage; advancing is still fine.
		}
	}

	activeStep.value = 'categorize';
};

const goBack = (): void => {
	activeStep.value = 'discovery';
};

const onAdopt = async (): Promise<void> => {
	isAdopting.value = true;

	try {
		await adoptSelected();
		activeStep.value = 'results';
	} catch {
		// Errors are surfaced by the composable via flashMessage; stay on the categorize step.
	} finally {
		isAdopting.value = false;
	}
};

const handleCancel = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: DevicesRouteNames.DEVICES });
	} else {
		router.push({ name: DevicesRouteNames.DEVICES });
	}
};

const onDone = async (): Promise<void> => {
	await router.push({ name: DevicesRouteNames.DEVICES });
};

// "Add more" wipes the previous session so the next round of pairings starts from a clean
// state; the composable's auto-cleanup hook only fires on unmount, not on user-driven resets.
//
// Order matters: switching `activeStep` to 'discovery' BEFORE the new session is loaded would
// briefly render the discovery step with `session.value === null`, which makes `bridgeOnline`
// compute to false and flashes a misleading "Bridge offline" banner. We finish endSession +
// startSession first and only then transition the UI, so the discovery step mounts with a
// real session in place.
const onRestart = async (): Promise<void> => {
	try {
		await endSession();
	} catch {
		// Best-effort cleanup; errors are non-fatal because startSession will overwrite anyway.
	}

	try {
		await startSession();
	} catch {
		// Errors are surfaced by the composable via flashMessage.
	}

	activeStep.value = 'discovery';
};
</script>
