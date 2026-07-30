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
			:title="t('devicesZigbeeHerdsmanPlugin.headings.aboutPluginStatus')"
			:description="t('devicesZigbeeHerdsmanPlugin.texts.aboutPluginStatus')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesZigbeeHerdsmanPlugin.fields.config.enabled.title')"
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
			:title="t('devicesZigbeeHerdsmanPlugin.headings.aboutSerial')"
			:description="t('devicesZigbeeHerdsmanPlugin.texts.aboutSerial')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesZigbeeHerdsmanPlugin.fields.config.serial.path.title')"
			prop="serial.path"
			class="mt-3"
		>
			<el-input
				v-model="model.serial.path"
				:placeholder="t('devicesZigbeeHerdsmanPlugin.fields.config.serial.path.placeholder')"
				name="serialPath"
			/>
		</el-form-item>

		<el-row :gutter="20">
			<el-col
				:xs="24"
				:sm="12"
			>
				<el-form-item
					:label="t('devicesZigbeeHerdsmanPlugin.fields.config.serial.baudRate.title')"
					prop="serial.baudRate"
				>
					<el-input-number
						v-model="model.serial.baudRate"
						:min="1"
						name="serialBaudRate"
						class="w-full!"
					/>
				</el-form-item>
			</el-col>
			<el-col
				:xs="24"
				:sm="12"
			>
				<el-form-item
					:label="t('devicesZigbeeHerdsmanPlugin.fields.config.serial.adapterType.title')"
					prop="serial.adapterType"
				>
					<el-input
						v-model="model.serial.adapterType"
						:placeholder="t('devicesZigbeeHerdsmanPlugin.fields.config.serial.adapterType.placeholder')"
						name="serialAdapterType"
					/>
				</el-form-item>
			</el-col>
		</el-row>

		<hr />

		<el-alert
			type="info"
			:title="t('devicesZigbeeHerdsmanPlugin.headings.aboutNetwork')"
			:description="t('devicesZigbeeHerdsmanPlugin.texts.aboutNetwork')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesZigbeeHerdsmanPlugin.fields.config.network.channel.title')"
			prop="network.channel"
			class="mt-3"
		>
			<el-input-number
				v-model="model.network.channel"
				:min="11"
				:max="26"
				name="networkChannel"
				class="w-full!"
			/>
		</el-form-item>

		<hr />

		<el-alert
			type="info"
			:title="t('devicesZigbeeHerdsmanPlugin.headings.aboutDiscovery')"
			:description="t('devicesZigbeeHerdsmanPlugin.texts.aboutDiscovery')"
			:closable="false"
		/>

		<el-row
			:gutter="20"
			class="mt-3"
		>
			<el-col
				:xs="24"
				:sm="8"
			>
				<el-form-item
					:label="t('devicesZigbeeHerdsmanPlugin.fields.config.discovery.permitJoinTimeout.title')"
					prop="discovery.permitJoinTimeout"
				>
					<el-input-number
						v-model="model.discovery.permitJoinTimeout"
						:min="0"
						name="discoveryPermitJoinTimeout"
						class="w-full!"
					/>
				</el-form-item>
			</el-col>
			<el-col
				:xs="24"
				:sm="8"
			>
				<el-form-item
					:label="t('devicesZigbeeHerdsmanPlugin.fields.config.discovery.mainsDeviceTimeout.title')"
					prop="discovery.mainsDeviceTimeout"
				>
					<el-input-number
						v-model="model.discovery.mainsDeviceTimeout"
						:min="60"
						name="discoveryMainsDeviceTimeout"
						class="w-full!"
					/>
				</el-form-item>
			</el-col>
			<el-col
				:xs="24"
				:sm="8"
			>
				<el-form-item
					:label="t('devicesZigbeeHerdsmanPlugin.fields.config.discovery.batteryDeviceTimeout.title')"
					prop="discovery.batteryDeviceTimeout"
				>
					<el-input-number
						v-model="model.discovery.batteryDeviceTimeout"
						:min="60"
						name="discoveryBatteryDeviceTimeout"
						class="w-full!"
					/>
				</el-form-item>
			</el-col>
		</el-row>

		<el-row :gutter="20">
			<el-col
				:xs="24"
				:sm="12"
			>
				<el-form-item
					:label="t('devicesZigbeeHerdsmanPlugin.fields.config.discovery.commandRetries.title')"
					prop="discovery.commandRetries"
				>
					<el-input-number
						v-model="model.discovery.commandRetries"
						:min="1"
						name="discoveryCommandRetries"
						class="w-full!"
					/>
				</el-form-item>
			</el-col>
		</el-row>

		<el-form-item
			:label="t('devicesZigbeeHerdsmanPlugin.fields.config.discovery.syncOnStartup.title')"
			prop="discovery.syncOnStartup"
			label-position="left"
		>
			<el-switch
				v-model="model.discovery.syncOnStartup"
				name="discoverySyncOnStartup"
			/>
		</el-form-item>

		<hr />

		<el-alert
			type="info"
			:title="t('devicesZigbeeHerdsmanPlugin.headings.aboutDatabase')"
			:description="t('devicesZigbeeHerdsmanPlugin.texts.aboutDatabase')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesZigbeeHerdsmanPlugin.fields.config.databasePath.title')"
			prop="databasePath"
			class="mt-3"
		>
			<el-input
				v-model="model.databasePath"
				:placeholder="t('devicesZigbeeHerdsmanPlugin.fields.config.databasePath.placeholder')"
				name="databasePath"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElCol,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElRow,
	ElSwitch,
	type FormRules,
} from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IZigbeeHerdsmanConfigEditForm } from '../schemas/config.types';

import type { IZigbeeHerdsmanConfigFormProps } from './zigbee-herdsman-config-form.types';

defineOptions({
	name: 'ZigbeeHerdsmanConfigForm',
});

const props = withDefaults(defineProps<IZigbeeHerdsmanConfigFormProps>(), {
	remoteFormSubmit: false,
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IZigbeeHerdsmanConfigEditForm>({
	config: props.config,
	messages: {
		success: t('devicesZigbeeHerdsmanPlugin.messages.config.edited'),
		error: t('devicesZigbeeHerdsmanPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IZigbeeHerdsmanConfigEditForm>>({
	'serial.path': [
		{ required: true, message: t('devicesZigbeeHerdsmanPlugin.fields.config.serial.path.validation.required'), trigger: 'blur' },
	],
	'serial.baudRate': [
		{
			type: 'integer',
			message: t('devicesZigbeeHerdsmanPlugin.fields.config.serial.baudRate.validation.number'),
			validator: (_rule, value) => value >= 1,
			trigger: 'change',
		},
	],
	'serial.adapterType': [
		{ required: true, message: t('devicesZigbeeHerdsmanPlugin.fields.config.serial.adapterType.validation.required'), trigger: 'blur' },
	],
	'network.channel': [
		{
			type: 'integer',
			message: t('devicesZigbeeHerdsmanPlugin.fields.config.network.channel.validation.range'),
			validator: (_rule, value) => value >= 11 && value <= 26,
			trigger: 'change',
		},
	],
	'databasePath': [
		{ required: true, message: t('devicesZigbeeHerdsmanPlugin.fields.config.databasePath.validation.required'), trigger: 'blur' },
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
		if (val) {
			emit('update:remote-form-reset', false);

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
