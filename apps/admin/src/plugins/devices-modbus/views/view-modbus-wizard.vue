<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:heading="editing ? t('devicesModbusPlugin.wizard.edit.title') : t('devicesModbusPlugin.wizard.title')"
		:sub-heading="editing ? t('devicesModbusPlugin.wizard.edit.subtitle') : t('devicesModbusPlugin.wizard.subtitle')"
		icon="mdi:lan-connect"
	/>

	<div
		v-if="editing && (wizard.loading.value || wizard.loadError.value !== null)"
		v-loading="wizard.loading.value"
		class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 mt-2 min-h-[200px]"
	>
		<el-result
			v-if="wizard.loadError.value !== null"
			icon="error"
			:title="t('devicesModbusPlugin.wizard.edit.loadFailed')"
			:sub-title="wizard.loadError.value"
			data-test-id="wizard-load-error"
		>
			<template #extra>
				<el-button
					type="primary"
					@click="onRetryLoad"
				>
					{{ t('devicesModbusPlugin.wizard.edit.retry') }}
				</el-button>
			</template>
		</el-result>
	</div>

	<div
		v-else
		class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2"
	>
		<el-card
			shadow="never"
			class="max-h-full flex flex-col overflow-hidden box-border"
			body-class="p-0! max-h-full overflow-hidden flex flex-col"
		>
			<template #header>
				<el-steps
					:active="wizard.state.step - firstStep"
					finish-status="success"
					align-center
				>
					<template v-if="!editing">
						<el-step :title="t('devicesModbusPlugin.wizard.steps.endpoint')" />
						<el-step :title="t('devicesModbusPlugin.wizard.steps.template')" />
					</template>
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

					<modbus-wizard-points-step
						v-else-if="wizard.state.step === MODBUS_WIZARD_STEP.POINTS"
						:wizard="wizard"
					/>

					<modbus-wizard-device-step
						v-else-if="wizard.state.step === MODBUS_WIZARD_STEP.DEVICE"
						:wizard="wizard"
					/>

					<modbus-wizard-review-step
						v-else
						:wizard="wizard"
					/>
				</div>
			</el-scrollbar>
		</el-card>
	</div>

	<div class="mt-2 flex justify-end lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2">
		<el-button
			v-if="wizard.state.step > firstStep"
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
			v-if="!isLastStep && !blocked"
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
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElCard, ElResult, ElScrollbar, ElStep, ElSteps, vLoading } from 'element-plus';

import { AppBreadcrumbs, ViewHeader, useBreakpoints, useLogger } from '../../../common';
import { RouteNames as DevicesRouteNames } from '../../../modules/devices';
import ModbusWizardDeviceStep from '../components/wizard/modbus-wizard-device-step.vue';
import ModbusWizardEndpointStep from '../components/wizard/modbus-wizard-endpoint-step.vue';
import ModbusWizardPointsStep from '../components/wizard/modbus-wizard-points-step.vue';
import ModbusWizardReviewStep from '../components/wizard/modbus-wizard-review-step.vue';
import ModbusWizardTemplateStep from '../components/wizard/modbus-wizard-template-step.vue';
import { MODBUS_WIZARD_STEP, MODBUS_WIZARD_STEP_COUNT, useModbusDeviceWizard } from '../composables/useModbusDeviceWizard';
import { RouteNames } from '../devices-modbus.constants';

defineOptions({
	name: 'ViewModbusWizard',
});

const props = defineProps<{
	/** The device whose points are edited; absent when a device is added. */
	id?: string;
}>();

const { t } = useI18n();
const router = useRouter();
const logger = useLogger();
const { isLGDevice } = useBreakpoints();

// The edit route carries the device id; the add route has none.
const editing = computed<boolean>((): boolean => typeof props.id === 'string' && props.id !== '');

useMeta({
	title: editing.value ? t('devicesModbusPlugin.wizard.edit.title') : t('devicesModbusPlugin.wizard.title'),
});

const wizard = useModbusDeviceWizard();

// Editing skips the endpoint and template steps: the device keeps its endpoint and unit, and has no template step.
const firstStep = computed<number>((): number => (editing.value ? MODBUS_WIZARD_STEP.POINTS : 0));

// Nothing can move on while the edited device is loading or failed to load.
const blocked = computed<boolean>((): boolean => editing.value && (wizard.loading.value || wizard.loadError.value !== null));

const loadDevice = (): void => {
	if (props.id) {
		wizard.loadDevice(props.id).catch((error: unknown): void => logger.error('Failed to load the Modbus device', error));
	}
};

const onRetryLoad = (): void => {
	loadDevice();
};

onBeforeMount(loadDevice);

// The view stays mounted when the route switches to another device.
watch(
	() => props.id,
	(): void => loadDevice()
);

// True while a step transition does work (saving a new endpoint when leaving step 1).
const stepBusy = ref<boolean>(false);

// Back and Cancel are locked while the device is being created.
const busy = computed<boolean>((): boolean => stepBusy.value || wizard.submitState.value === 'submitting');

const isLastStep = computed<boolean>((): boolean => wizard.state.step === MODBUS_WIZARD_STEP_COUNT - 1);

const canAdvance = computed<boolean>((): boolean => !stepBusy.value && !blocked.value && wizard.canContinue(wizard.state.step));

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => [
		{
			label: t('devicesModule.breadcrumbs.devices.list'),
			route: router.resolve({ name: DevicesRouteNames.DEVICES }),
		},
		...(editing.value
			? [
					{
						label: wizard.state.device.name !== '' ? wizard.state.device.name : t('devicesModbusPlugin.wizard.edit.device'),
						route: router.resolve({ name: DevicesRouteNames.DEVICE, params: { id: props.id } }),
					},
					{
						label: t('devicesModbusPlugin.wizard.edit.breadcrumb'),
						route: router.resolve({ name: RouteNames.EDIT, params: { id: props.id } }),
					},
				]
			: [
					{
						label: t('devicesModbusPlugin.wizard.breadcrumb'),
						route: router.resolve({ name: RouteNames.WIZARD }),
					},
				]),
	]
);

const onCancel = (): void => {
	if (busy.value) {
		return;
	}

	// Leaving the points editor goes back to the device it edits.
	const target = editing.value ? { name: DevicesRouteNames.DEVICE, params: { id: props.id } } : { name: DevicesRouteNames.DEVICES };

	if (isLGDevice.value) {
		router.replace(target);
	} else {
		router.push(target);
	}
};

const onBack = (): void => {
	if (busy.value || wizard.state.step <= firstStep.value) {
		return;
	}

	wizard.state.step -= 1;
};

const onNext = async (): Promise<void> => {
	if (!canAdvance.value || isLastStep.value) {
		return;
	}

	if (wizard.state.step === MODBUS_WIZARD_STEP.ENDPOINT && wizard.state.endpointMode === 'new') {
		stepBusy.value = true;

		try {
			// Device creation needs an endpoint id, so a new endpoint is saved here (once). A failure stays on this step with
			// the errors shown on the form.
			await wizard.saveNewEndpoint();
		} catch {
			return;
		} finally {
			stepBusy.value = false;
		}
	}

	wizard.state.step += 1;
};
</script>
