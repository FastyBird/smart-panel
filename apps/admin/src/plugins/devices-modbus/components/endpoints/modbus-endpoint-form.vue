<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
		@submit.prevent="onSubmit"
	>
		<el-alert
			v-if="formAlert"
			:title="formAlert"
			type="error"
			:closable="false"
			show-icon
			class="mb-4"
		/>

		<el-form-item
			:label="t('devicesModbusPlugin.endpoints.form.name.title')"
			prop="name"
			:error="fieldErrors.name"
		>
			<el-input
				v-model="model.name"
				name="name"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesModbusPlugin.endpoints.form.host.title')"
			prop="host"
			:error="fieldErrors.host"
		>
			<el-input
				v-model="model.host"
				name="host"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesModbusPlugin.endpoints.form.port.title')"
			prop="port"
			:error="fieldErrors.port"
		>
			<el-input-number
				v-model="model.port"
				:min="1"
				:max="65535"
				controls-position="right"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesModbusPlugin.endpoints.form.framing.title')"
			prop="framing"
			:error="fieldErrors.framing"
		>
			<el-select
				:model-value="model.framing"
				name="framing"
				@update:model-value="setFraming"
			>
				<el-option
					v-for="option in framingOptions"
					:key="option.value"
					:label="option.label"
					:value="option.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('devicesModbusPlugin.endpoints.form.connectTimeoutMs.title')"
			prop="connectTimeoutMs"
			:error="fieldErrors.connectTimeoutMs"
		>
			<el-input-number
				v-model="model.connectTimeoutMs"
				:min="1"
				:max="60000"
				controls-position="right"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesModbusPlugin.endpoints.form.requestTimeoutMs.title')"
			prop="requestTimeoutMs"
			:error="fieldErrors.requestTimeoutMs"
		>
			<el-input-number
				v-model="model.requestTimeoutMs"
				:min="1"
				:max="60000"
				controls-position="right"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesModbusPlugin.endpoints.form.interRequestDelayMs.title')"
			prop="interRequestDelayMs"
			:error="fieldErrors.interRequestDelayMs"
		>
			<el-input-number
				v-model="model.interRequestDelayMs"
				:min="0"
				:max="60000"
				controls-position="right"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesModbusPlugin.endpoints.form.maxInFlight.title')"
			prop="maxInFlight"
			:error="fieldErrors.maxInFlight"
		>
			<el-input-number
				v-model="model.maxInFlight"
				:min="1"
				:max="64"
				:disabled="maxInFlightDisabled"
				controls-position="right"
			/>
			<div
				v-if="maxInFlightDisabled"
				class="text-xs mt-1"
			>
				{{ t('devicesModbusPlugin.endpoints.form.maxInFlight.rtuHint') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('devicesModbusPlugin.endpoints.form.enabled.title')"
			prop="enabled"
			:error="fieldErrors.enabled"
		>
			<el-switch v-model="model.enabled" />
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch, type FormInstance, type FormRules } from 'element-plus';

import { DevicesModbusPluginFraming } from '../../../../openapi.constants';
import { useModbusEndpointForm } from '../../composables/useModbusEndpointForm';
import type { IModbusEndpoint } from '../../store/endpoints.types';

import type { IModbusEndpointFormProps } from './modbus-endpoint-form.types';

defineOptions({
	name: 'ModbusEndpointForm',
});

const props = defineProps<IModbusEndpointFormProps>();

const emit = defineEmits<{
	(e: 'saved', endpoint: IModbusEndpoint): void;
	(e: 'update:submitting', submitting: boolean): void;
}>();

const { t } = useI18n();

const { model, fieldErrors, formAlert, maxInFlightDisabled, setFraming, submit } = props.form ?? useModbusEndpointForm(props.endpoint);

const formEl = ref<FormInstance>();

const framingOptions = computed(() => [
	{ value: DevicesModbusPluginFraming.tcp, label: t('devicesModbusPlugin.endpoints.framing.tcp') },
	{ value: DevicesModbusPluginFraming.rtu_over_tcp, label: t('devicesModbusPlugin.endpoints.framing.rtuOverTcp') },
]);

const required = (key: string) => ({ required: true, message: t(key), trigger: 'change' as const });

const rules = reactive<FormRules>({
	name: [required('devicesModbusPlugin.endpoints.form.name.required')],
	host: [required('devicesModbusPlugin.endpoints.form.host.required')],
});

let busy = false;

// Locked before the validation is awaited, so a second Save click while validating does not start a second save.
const onSubmit = async (): Promise<void> => {
	if (!formEl.value || busy) {
		return;
	}

	busy = true;
	emit('update:submitting', true);

	try {
		const valid = await formEl.value.validate().catch(() => false);

		if (!valid) {
			return;
		}

		emit('saved', await submit());
	} catch {
		// Field errors and the form alert are set by the composable.
	} finally {
		busy = false;
		emit('update:submitting', false);
	}
};

defineExpose({ submit: onSubmit });
</script>
