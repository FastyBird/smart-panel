<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-alert
			type="info"
			:title="t('devicesSimulatorPlugin.headings.aboutPluginStatus')"
			:description="t('devicesSimulatorPlugin.texts.aboutPluginStatus')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesSimulatorPlugin.fields.config.enabled.title')"
			prop="enabled"
			label-position="left"
			class="mt-3"
		>
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>

		<hr />

		<el-alert
			type="info"
			:title="t('devicesSimulatorPlugin.headings.aboutSimulation')"
			:description="t('devicesSimulatorPlugin.texts.aboutSimulation')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesSimulatorPlugin.fields.config.updateOnStart.title')"
			prop="updateOnStart"
			class="mt-3"
			label-position="left"
		>
			<el-switch
				v-model="model.updateOnStart"
				name="updateOnStart"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesSimulatorPlugin.fields.config.simulationInterval.title')"
			prop="simulationInterval"
		>
			<el-input-number
				v-model="model.simulationInterval"
				:min="0"
				:max="3600000"
				:step="1000"
				name="simulationInterval"
			/>
		</el-form-item>

		<hr />

		<el-alert
			type="info"
			:title="t('devicesSimulatorPlugin.headings.aboutEnvironment')"
			:description="t('devicesSimulatorPlugin.texts.aboutEnvironment')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesSimulatorPlugin.fields.config.latitude.title')"
			prop="latitude"
			class="mt-3"
		>
			<el-input-number
				v-model="model.latitude"
				:min="-90"
				:max="90"
				:step="0.1"
				name="latitude"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesSimulatorPlugin.fields.config.smoothTransitions.title')"
			prop="smoothTransitions"
			label-position="left"
		>
			<el-switch
				v-model="model.smoothTransitions"
				name="smoothTransitions"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesSimulatorPlugin.fields.config.connectionStateOnStart.title')"
			prop="connectionStateOnStart"
		>
			<el-select
				v-model="model.connectionStateOnStart"
				name="connectionStateOnStart"
				:placeholder="t('devicesSimulatorPlugin.fields.config.connectionStateOnStart.placeholder')"
			>
				<el-option
					v-for="state in connectionStates"
					:key="state.value"
					:label="state.label"
					:value="state.value"
				/>
			</el-select>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInputNumber, ElSelect, ElOption, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { ISimulatorConfigEditForm } from '../schemas/config.types';
import { SIMULATOR_CONNECTION_STATES } from '../devices-simulator.constants';

import type { ISimulatorConfigFormProps } from './simulator-config-form.types';

defineOptions({
	name: 'SimulatorConfigForm',
});

const props = withDefaults(defineProps<ISimulatorConfigFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
	layout: Layout.DEFAULT,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<ISimulatorConfigEditForm>({
	config: props.config,
	messages: {
		success: t('devicesSimulatorPlugin.messages.config.edited'),
		error: t('devicesSimulatorPlugin.messages.config.notEdited'),
	},
});

const connectionStates = SIMULATOR_CONNECTION_STATES.map((state) => ({
	value: state,
	label: t(`devicesSimulatorPlugin.fields.config.connectionStateOnStart.options.${state}`),
}));

const rules = reactive<FormRules<ISimulatorConfigEditForm>>({
	simulationInterval: [
		{ required: true, message: t('devicesSimulatorPlugin.fields.config.simulationInterval.validation.required'), trigger: 'change' },
		{
			type: 'integer',
			message: t('devicesSimulatorPlugin.fields.config.simulationInterval.validation.number'),
			validator: (rule, value) => typeof value === 'number' && value >= 0 && value <= 3_600_000,
			trigger: 'change',
		},
	],
	latitude: [
		{ required: true, message: t('devicesSimulatorPlugin.fields.config.latitude.validation.required'), trigger: 'change' },
		{
			type: 'number',
			message: t('devicesSimulatorPlugin.fields.config.latitude.validation.number'),
			validator: (rule, value) => typeof value === 'number' && value >= -90 && value <= 90,
			trigger: 'change',
		},
	],
	connectionStateOnStart: [
		{ required: true, message: t('devicesSimulatorPlugin.fields.config.connectionStateOnStart.validation.required'), trigger: 'change' },
	],
});

watch(
	(): FormResultType => formResult.value,
	async (val: FormResultType): Promise<void> => {
		emit('update:remote-form-result', val);
	}
);

watch(
	(): boolean => props.remoteFormSubmit,
	async (val: boolean): Promise<void> => {
		if (val) {
			emit('update:remote-form-submit', false);

			submit().catch(() => {
				// The form is not valid
			});
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remote-form-reset', false);

		if (val) {
			if (!formEl.value) return;

			formEl.value.resetFields();
		}
	}
);

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>
