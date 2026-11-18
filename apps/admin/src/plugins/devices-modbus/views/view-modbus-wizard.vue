<template>
	<device-wizard-steps
		:model-value="wizard.state.step - firstStep"
		:steps="labels"
		:can-advance="canAdvance"
		:disabled="busy || wizard.loading.value"
		:dirty="dirty"
		:final-actions="finalActions"
		:before-next="beforeNext"
		:return-route="returnRoute"
		@update:model-value="wizard.state.step = $event + firstStep"
	>
		<div
			v-if="blocked"
			v-loading="wizard.loading.value"
			class="min-h-30"
		>
			<el-result
				v-if="wizard.loadError.value"
				icon="error"
				:title="t('devicesModbusPlugin.wizard.edit.loadFailed')"
				:sub-title="wizard.loadError.value"
				data-test-id="wizard-load-error"
			>
				<template #extra>
					<el-button @click="onRetryLoad">{{ t('devicesModbusPlugin.wizard.edit.retry') }}</el-button>
				</template>
			</el-result>
		</div>
		<div v-else>
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
				ref="reviewStep"
				:show-create-action="false"
				:wizard="wizard"
			/>
		</div>
	</device-wizard-steps>
</template>
<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElResult, vLoading } from 'element-plus';

import { useLogger } from '../../../common';
import { RouteNames as DevicesRouteNames } from '../../../modules/devices';
import DeviceWizardSteps from '../../../modules/devices/components/wizard/device-wizard-steps.vue';
import type { IWizardAction } from '../../../modules/devices/components/wizard/device-wizard.types';
import { useWizardValidation } from '../../../modules/devices/components/wizard/use-wizard-validation';
import ModbusWizardDeviceStep from '../components/wizard/modbus-wizard-device-step.vue';
import ModbusWizardEndpointStep from '../components/wizard/modbus-wizard-endpoint-step.vue';
import ModbusWizardPointsStep from '../components/wizard/modbus-wizard-points-step.vue';
import ModbusWizardReviewStep from '../components/wizard/modbus-wizard-review-step.vue';
import ModbusWizardTemplateStep from '../components/wizard/modbus-wizard-template-step.vue';
import { MODBUS_WIZARD_STEP, useModbusDeviceWizard } from '../composables/useModbusDeviceWizard';
import { MODBUS_MAX_POLL_INTERVAL_MS, MODBUS_MIN_POLL_INTERVAL_MS } from '../devices-modbus.constants';
import { capabilityKindOf } from '../lib/capabilities';
import { bindingIssues } from '../lib/points';

defineOptions({
	name: 'ViewModbusWizard',
});

const props = defineProps<{
	/** The device whose points are edited; absent when a device is added. */
	id?: string;
}>();

const { t } = useI18n();

const logger = useLogger();

// The edit route carries the device id; the add route has none.
const editing = computed<boolean>((): boolean => typeof props.id === 'string' && props.id !== '');

const wizard = useModbusDeviceWizard();
const draftSignature = computed(() =>
	JSON.stringify({
		endpointId: wizard.state.endpointId,
		endpoint: wizard.state.newEndpoint,
		unitId: wizard.state.unitId,
		template: wizard.state.template,
		points: wizard.state.points,
		device: wizard.state.device,
		startedEmpty: wizard.state.startedEmpty,
	})
);
const baseline = ref(draftSignature.value);
const dirty = computed(() => !['created', 'saved'].includes(wizard.submitState.value) && baseline.value !== draftSignature.value);

// Editing skips the endpoint and template steps: the device keeps its endpoint and unit, and has no template step.
const firstStep = computed<number>((): number => (editing.value ? MODBUS_WIZARD_STEP.POINTS : 0));

// Nothing can move on while the edited device is loading or failed to load.
const blocked = computed<boolean>((): boolean => editing.value && (wizard.loading.value || wizard.loadError.value !== null));

const loadDevice = (): void => {
	if (props.id) {
		wizard
			.loadDevice(props.id)
			.then(() => {
				baseline.value = draftSignature.value;
			})
			.catch((error: unknown): void => logger.error('Failed to load the Modbus device', error));
	}
};

const onRetryLoad = (): void => {
	loadDevice();
};

onBeforeMount(loadDevice);

// The view stays mounted when the route switches to another device, or from editing one to adding a device.
watch(
	() => props.id,
	(): void => {
		if (editing.value) {
			loadDevice();
		} else {
			wizard.startCreate();
			baseline.value = draftSignature.value;
		}
	}
);

// True while a step transition does work (saving a new endpoint when leaving step 1).
const stepBusy = ref<boolean>(false);

// Back and Cancel are locked while the device is being created.
const busy = computed<boolean>((): boolean => stepBusy.value || wizard.submitState.value === 'submitting');

const canAdvance = computed<boolean>((): boolean => !stepBusy.value && !blocked.value && !wizard.applyingTemplate.value);

const validation = useWizardValidation(
	() => wizard.state.step,
	() => {
		const state = wizard.state;
		const required = t('devicesModule.wizard.validation.required');
		const invalid = t('devicesModule.wizard.validation.invalidValue');
		const range = (value: number, minimum: number, maximum: number) =>
			Number.isInteger(value) && value >= minimum && value <= maximum
				? undefined
				: t('devicesModule.wizard.validation.numberRange', { minimum, maximum });
		const errors: Record<string, string | undefined> = {};
		if (state.step === MODBUS_WIZARD_STEP.ENDPOINT) {
			errors.unitId = range(state.unitId, 0, 255);
			if (state.endpointMode === 'existing') errors.endpointId = state.endpointId ? undefined : required;
			else {
				const endpoint = state.newEndpoint;
				errors['endpoint.name'] = endpoint.name.trim() ? undefined : t('devicesModbusPlugin.endpoints.form.name.required');
				errors['endpoint.host'] = endpoint.host.trim() ? undefined : t('devicesModbusPlugin.endpoints.form.host.required');
				for (const [field, minimum, maximum] of [
					['port', 1, 65535],
					['connectTimeoutMs', 1, 60000],
					['requestTimeoutMs', 1, 60000],
					['interRequestDelayMs', 0, 60000],
					['maxInFlight', 1, 64],
				] as const)
					errors[`endpoint.${field}`] = range(endpoint[field], minimum, maximum);
			}
		} else if (state.step === MODBUS_WIZARD_STEP.TEMPLATE) {
			errors.template = state.template || state.startedEmpty ? undefined : required;
		} else if (state.step === MODBUS_WIZARD_STEP.POINTS) {
			errors.points = state.points.length && state.points.some((point) => point.read) ? undefined : required;
			for (const point of state.points) {
				const problems = (['read', 'write'] as const).flatMap((kind) =>
					point[kind] ? Object.values(bindingIssues(point[kind]!, kind, capabilityKindOf(point))) : []
				);
				if (problems.length) errors[`point:${point.key}`] = problems.map((key) => t(key!)).join(' · ');
			}
		} else if (state.step === MODBUS_WIZARD_STEP.DEVICE) {
			errors.name = editing.value || state.device.name.trim() ? undefined : t('devicesModule.fields.devices.name.validation.required');
			errors.category = state.device.category ? undefined : t('devicesModule.fields.devices.category.validation.required');
			errors.pollInterval = range(state.device.pollIntervalMs, MODBUS_MIN_POLL_INTERVAL_MS, MODBUS_MAX_POLL_INTERVAL_MS);
			errors.byteOrder = ['big', 'little'].includes(state.device.byteOrder) ? undefined : invalid;
			errors.wordOrder = ['big', 'little'].includes(state.device.wordOrder) ? undefined : invalid;
		}
		return errors;
	}
);
const beforeNext = async (): Promise<boolean> => {
	if (!validation.validate()) return false;
	if (wizard.state.step === MODBUS_WIZARD_STEP.ENDPOINT && wizard.state.endpointMode === 'new') {
		stepBusy.value = true;
		try {
			await wizard.saveNewEndpoint();
		} finally {
			stepBusy.value = false;
		}
	}
	return true;
};
const reviewStep = ref<{ canCreate: boolean; onCreate: () => Promise<void> } | null>(null);
const labels = computed(() =>
	['endpoint', 'template', 'points', 'device', 'review'].slice(firstStep.value).map((step) => t(`devicesModbusPlugin.wizard.steps.${step}`))
);
const returnRoute = computed(() =>
	editing.value ? { name: DevicesRouteNames.DEVICE, params: { id: props.id }, query: { tab: 'plugin:modbus' } } : { name: DevicesRouteNames.DEVICES }
);
const finalActions = computed<IWizardAction[]>(() => [
	{
		id: 'create',
		label: t(editing.value ? 'devicesModbusPlugin.wizard.edit.save' : 'devicesModbusPlugin.wizard.review.create'),
		variant: 'primary',
		disabled: !reviewStep.value?.canCreate,
		handler: () => reviewStep.value?.onCreate(),
	},
]);
</script>
