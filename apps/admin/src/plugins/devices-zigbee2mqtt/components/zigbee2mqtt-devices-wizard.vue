<template>
	<div class="z2m-devices-wizard flex flex-col gap-3 h-full overflow-hidden">
		<el-steps
			:active="activeStepIndex"
			finish-status="success"
			align-center
			class="shrink-0"
		>
			<el-step :title="t('devicesZigbee2mqttPlugin.wizard.steps.discovery.title')" />
			<el-step :title="t('devicesZigbee2mqttPlugin.wizard.steps.categorize.title')" />
			<el-step :title="t('devicesZigbee2mqttPlugin.wizard.steps.results.title')" />
		</el-steps>

		<div class="flex-grow overflow-hidden">
			<Zigbee2mqttWizardDiscoveryStep
				v-if="activeStep === 'discovery'"
				:devices="devices"
				:selected="selected"
				:permit-join="permitJoin"
				:bridge-online="bridgeOnline"
				@enable-permit-join="enablePermitJoin"
				@disable-permit-join="disablePermitJoin"
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

		<div class="flex justify-between gap-2 shrink-0">
			<el-button
				v-if="activeStep === 'categorize'"
				@click="goBack"
			>
				{{ t('devicesZigbee2mqttPlugin.wizard.actions.back') }}
			</el-button>
			<div v-else />

			<el-button
				v-if="activeStep === 'discovery'"
				type="primary"
				:disabled="selectedDevices.length === 0"
				@click="goToCategorize"
			>
				{{ t('devicesZigbee2mqttPlugin.wizard.actions.next') }}
			</el-button>

			<el-button
				v-else-if="activeStep === 'categorize'"
				type="primary"
				:disabled="!canContinue"
				:loading="isAdopting"
				@click="onAdopt"
			>
				{{ t('devicesZigbee2mqttPlugin.wizard.actions.adopt') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElStep, ElSteps } from 'element-plus';

import { useFlashMessage } from '../../../common';
import { type DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { useDevicesWizard } from '../composables/useDevicesWizard';

import Zigbee2mqttWizardCategorizeStep from './zigbee2mqtt-wizard-categorize-step.vue';
import Zigbee2mqttWizardDiscoveryStep from './zigbee2mqtt-wizard-discovery-step.vue';
import Zigbee2mqttWizardResultsStep from './zigbee2mqtt-wizard-results-step.vue';

defineOptions({
	name: 'Zigbee2mqttDevicesWizard',
});

const emit = defineEmits<{
	(e: 'done'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const {
	devices,
	selected,
	nameByIeee,
	categoryByIeee,
	selectedDevices,
	permitJoin,
	bridgeOnline,
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

const activeStepIndex = computed<number>(() => {
	if (activeStep.value === 'categorize') {
		return 1;
	}

	if (activeStep.value === 'results') {
		return 2;
	}

	return 0;
});

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

const onDone = (): void => {
	emit('done');
};

// "Add more" wipes the previous session so the next round of pairings starts from a clean
// state; the composable's auto-cleanup hook only fires on unmount, not on user-driven resets.
const onRestart = async (): Promise<void> => {
	activeStep.value = 'discovery';

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
};
</script>
