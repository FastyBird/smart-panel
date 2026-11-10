<template>
	<div class="flex flex-col gap-3">
		<div class="font-bold">
			{{ t('devicesModbusPlugin.wizard.probe.title') }}
		</div>

		<div class="text-sm">
			{{ t('devicesModbusPlugin.wizard.probe.description') }}
		</div>

		<el-form
			label-position="top"
			@submit.prevent="onRun"
		>
			<div class="flex flex-wrap gap-4">
				<el-form-item :label="t('devicesModbusPlugin.wizard.probe.registerType.title')">
					<el-select
						v-model="registerType"
						class="w-[200px]!"
						name="probeRegisterType"
					>
						<el-option
							v-for="option in registerTypeOptions"
							:key="option.value"
							:label="option.label"
							:value="option.value"
						/>
					</el-select>
				</el-form-item>

				<el-form-item :label="t('devicesModbusPlugin.wizard.probe.notation.title')">
					<el-select
						v-model="notation"
						class="w-[200px]!"
						name="probeNotation"
					>
						<el-option
							v-for="option in notationOptions"
							:key="option.value"
							:label="option.label"
							:value="option.value"
						/>
					</el-select>
				</el-form-item>

				<el-form-item
					:label="t('devicesModbusPlugin.wizard.probe.address.title')"
					:error="addressError ?? undefined"
				>
					<el-input
						v-model="addressText"
						class="w-[160px]!"
						name="probeAddress"
					/>
					<div
						v-if="parsed.ok"
						class="text-xs mt-1 w-full"
					>
						{{
							t('devicesModbusPlugin.wizard.probe.address.stored', {
								address: parsed.start,
								registerType: t(`devicesModbusPlugin.wizard.probe.registerType.${parsed.registerType}`),
							})
						}}
					</div>
				</el-form-item>

				<el-form-item :label="t('devicesModbusPlugin.wizard.probe.count.title')">
					<el-input-number
						v-model="count"
						:min="1"
						:max="maxCount"
						controls-position="right"
					/>
				</el-form-item>
			</div>

			<el-button
				type="primary"
				:loading="running"
				:disabled="!canRun"
				data-test-id="probe-run"
				@click="onRun"
			>
				{{ t('devicesModbusPlugin.wizard.probe.run') }}
			</el-button>
		</el-form>

		<el-alert
			v-if="result && result.ok"
			type="success"
			:closable="false"
			show-icon
			:title="t('devicesModbusPlugin.wizard.probe.success', { count: result.values?.length ?? 0, ms: Math.round(result.durationMs) })"
		>
			<div class="font-mono break-all">
				{{ (result.values ?? []).map((value) => String(value)).join(', ') }}
			</div>
		</el-alert>

		<el-alert
			v-else-if="result && result.error"
			type="error"
			:closable="false"
			show-icon
			:title="t(explainProbeError(result.error))"
		>
			<div class="text-xs">
				{{ result.error.message }}
			</div>
		</el-alert>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect } from 'element-plus';

import { DevicesModbusPluginRegisterType } from '../../../../openapi.constants';
import { type IModbusProbeReadResult, useModbusProbe } from '../../composables/useModbusProbe';
import { type AddressNotation, AddressNotationError, formatAddress, parseAddressInput } from '../../lib/address-notation';
import { explainProbeError } from '../../lib/probe-messages';

import type { IModbusWizardProbePanelProps } from './modbus-wizard-probe-panel.types';

defineOptions({
	name: 'ModbusWizardProbePanel',
});

const props = defineProps<IModbusWizardProbePanelProps>();

const { t } = useI18n();

const probe = useModbusProbe();

const registerType = ref<DevicesModbusPluginRegisterType>(DevicesModbusPluginRegisterType.holding_register);
const count = ref<number>(1);
const running = ref<boolean>(false);
const result = ref<IModbusProbeReadResult | null>(null);

const notation = computed<AddressNotation>({
	get: () => props.wizard.state.notation,
	set: (value) => {
		props.wizard.setNotation(value);
	},
});

const addressText = ref<string>(formatAddress(0, registerType.value, notation.value));

const registerTypeOptions = computed(() => [
	{ value: DevicesModbusPluginRegisterType.holding_register, label: t('devicesModbusPlugin.wizard.probe.registerType.holding_register') },
	{ value: DevicesModbusPluginRegisterType.input_register, label: t('devicesModbusPlugin.wizard.probe.registerType.input_register') },
	{ value: DevicesModbusPluginRegisterType.coil, label: t('devicesModbusPlugin.wizard.probe.registerType.coil') },
	{ value: DevicesModbusPluginRegisterType.discrete_input, label: t('devicesModbusPlugin.wizard.probe.registerType.discrete_input') },
]);

const notationOptions = computed(() => [
	{ value: 'one_based', label: t('devicesModbusPlugin.wizard.probe.notation.one_based') },
	{ value: 'pdu', label: t('devicesModbusPlugin.wizard.probe.notation.pdu') },
	{ value: 'modicon', label: t('devicesModbusPlugin.wizard.probe.notation.modicon') },
]);

type Parsed = { ok: true; start: number; registerType: DevicesModbusPluginRegisterType } | { ok: false; error: string };

const parse = (text: string, mode: AddressNotation, type: DevicesModbusPluginRegisterType): Parsed => {
	try {
		const parsedAddress = parseAddressInput(text, mode, type);

		return { ok: true, start: parsedAddress.start, registerType: parsedAddress.registerType ?? type };
	} catch (error: unknown) {
		return { ok: false, error: error instanceof AddressNotationError ? error.message : 'devicesModbusPlugin.wizard.address.errors.invalid' };
	}
};

const parsed = computed<Parsed>(() => parse(addressText.value, notation.value, registerType.value));

const addressError = computed<string | null>(() => (parsed.value.ok ? null : t(parsed.value.error)));

const effectiveRegisterType = computed<DevicesModbusPluginRegisterType>(() => (parsed.value.ok ? parsed.value.registerType : registerType.value));

const isBitTable = computed<boolean>(
	() =>
		effectiveRegisterType.value === DevicesModbusPluginRegisterType.coil ||
		effectiveRegisterType.value === DevicesModbusPluginRegisterType.discrete_input
);

const maxCount = computed<number>(() => (isBitTable.value ? 2000 : 125));

// Keeps what the user typed meaningful when the notation or the table changes: re-expresses the same stored
// address in the new notation, or falls back to address 0 when the text does not parse.
watch([notation, registerType], ([newNotation, newType], [oldNotation, oldType]) => {
	const previous = parse(addressText.value, oldNotation, oldType);

	addressText.value = formatAddress(previous.ok ? previous.start : 0, newType, newNotation);
});

// A result describes the target it was read from; drop it when the target changes.
watch(
	() => {
		const { endpointMode, endpointId, newEndpoint, unitId } = props.wizard.state;

		return [endpointMode, endpointId, newEndpoint.host, newEndpoint.port, newEndpoint.framing, unitId];
	},
	() => {
		result.value = null;
	}
);

const canRun = computed<boolean>(() => parsed.value.ok && props.wizard.probeTarget() !== null && !running.value);

const onRun = async (): Promise<void> => {
	const target = props.wizard.probeTarget();

	if (!parsed.value.ok || target === null || running.value) {
		return;
	}

	running.value = true;

	try {
		result.value = await probe.read(target, props.wizard.state.unitId, effectiveRegisterType.value, parsed.value.start, count.value);
	} finally {
		running.value = false;
	}
};
</script>
