<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:heading="t('devicesModbusPlugin.wizard.title')"
		:sub-heading="t('devicesModbusPlugin.wizard.subtitle')"
		icon="mdi:lan-connect"
	/>

	<div class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2">
		<el-card
			shadow="never"
			class="max-h-full flex flex-col overflow-hidden box-border"
			body-class="p-0! max-h-full overflow-hidden flex flex-col"
		>
			<template #header>
				<el-steps
					:active="wizard.state.step"
					finish-status="success"
					align-center
				>
					<el-step :title="t('devicesModbusPlugin.wizard.steps.endpoint')" />
					<el-step :title="t('devicesModbusPlugin.wizard.steps.template')" />
					<el-step :title="t('devicesModbusPlugin.wizard.steps.points')" />
					<el-step :title="t('devicesModbusPlugin.wizard.steps.device')" />
					<el-step :title="t('devicesModbusPlugin.wizard.steps.review')" />
				</el-steps>
			</template>

			<el-scrollbar class="flex-1 overflow-hidden h-full">
				<!-- Only the active step is mounted; the wizard state lives in the composable, so nothing is lost when a step unmounts. -->
				<div class="p-4">
					<modbus-wizard-endpoint-step
						v-if="wizard.state.step === MODBUS_WIZARD_STEP.ENDPOINT"
						:wizard="wizard"
					/>

					<modbus-wizard-template-step
						v-else-if="wizard.state.step === MODBUS_WIZARD_STEP.TEMPLATE"
						:wizard="wizard"
					/>

					<el-empty
						v-else
						:description="t('devicesModbusPlugin.wizard.comingNext')"
					/>
				</div>
			</el-scrollbar>
		</el-card>
	</div>

	<div class="mt-2 flex justify-end lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2">
		<el-button
			v-if="wizard.state.step > 0"
			:disabled="busy"
			data-test-id="wizard-back"
			@click="onBack"
		>
			{{ t('devicesModule.wizard.actions.back') }}
		</el-button>
		<el-button
			link
			class="ml-2!"
			:disabled="busy"
			data-test-id="wizard-cancel"
			@click="onCancel"
		>
			{{ t('devicesModule.wizard.actions.cancel') }}
		</el-button>
		<el-button
			v-if="!isLastStep"
			type="primary"
			class="ml-2!"
			:disabled="!canAdvance"
			:loading="busy"
			data-test-id="wizard-next"
			@click="onNext"
		>
			{{ t('devicesModule.wizard.actions.next') }}
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElCard, ElEmpty, ElScrollbar, ElStep, ElSteps } from 'element-plus';

import { AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { RouteNames as DevicesRouteNames } from '../../../modules/devices';
import ModbusWizardEndpointStep from '../components/wizard/modbus-wizard-endpoint-step.vue';
import ModbusWizardTemplateStep from '../components/wizard/modbus-wizard-template-step.vue';
import { MODBUS_WIZARD_STEP, MODBUS_WIZARD_STEP_COUNT, useModbusDeviceWizard } from '../composables/useModbusDeviceWizard';
import { RouteNames } from '../devices-modbus.constants';

defineOptions({
	name: 'ViewModbusWizard',
});

const { t } = useI18n();
const router = useRouter();
const { isLGDevice } = useBreakpoints();

useMeta({
	title: t('devicesModbusPlugin.wizard.title'),
});

const wizard = useModbusDeviceWizard();

// True while a step transition does work (saving a new endpoint when leaving step 1).
const busy = ref<boolean>(false);

const isLastStep = computed<boolean>((): boolean => wizard.state.step === MODBUS_WIZARD_STEP_COUNT - 1);

const canAdvance = computed<boolean>((): boolean => !busy.value && wizard.canContinue(wizard.state.step));

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => [
		{
			label: t('devicesModule.breadcrumbs.devices.list'),
			route: router.resolve({ name: DevicesRouteNames.DEVICES }),
		},
		{
			label: t('devicesModbusPlugin.wizard.breadcrumb'),
			route: router.resolve({ name: RouteNames.WIZARD }),
		},
	]
);

const onCancel = (): void => {
	if (busy.value) {
		return;
	}

	if (isLGDevice.value) {
		router.replace({ name: DevicesRouteNames.DEVICES });
	} else {
		router.push({ name: DevicesRouteNames.DEVICES });
	}
};

const onBack = (): void => {
	if (busy.value || wizard.state.step === 0) {
		return;
	}

	wizard.state.step -= 1;
};

const onNext = async (): Promise<void> => {
	if (!canAdvance.value || isLastStep.value) {
		return;
	}

	if (wizard.state.step === MODBUS_WIZARD_STEP.ENDPOINT && wizard.state.endpointMode === 'new') {
		busy.value = true;

		try {
			// Device creation needs an endpoint id, so a new endpoint is saved here (once). A failure stays on this step with
			// the errors shown on the form.
			await wizard.saveNewEndpoint();
		} catch {
			return;
		} finally {
			busy.value = false;
		}
	}

	wizard.state.step += 1;
};
</script>
