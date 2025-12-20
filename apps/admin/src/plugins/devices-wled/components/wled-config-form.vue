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
			:title="t('devicesWledPlugin.headings.aboutPluginStatus')"
			:description="t('devicesWledPlugin.texts.aboutPluginStatus')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesWledPlugin.fields.config.enabled.title')"
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
			:title="t('devicesWledPlugin.headings.aboutMdns')"
			:description="t('devicesWledPlugin.texts.aboutMdns')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesWledPlugin.fields.config.mdns.enabled.title')"
			prop="mdns.enabled"
			class="mt-3"
			label-position="left"
		>
			<el-switch
				v-model="model.mdns.enabled"
				name="mdnsEnabled"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesWledPlugin.fields.config.mdns.interface.title')"
			prop="mdns.interface"
		>
			<el-input
				v-model="model.mdns.interface"
				:placeholder="t('devicesWledPlugin.fields.config.mdns.interface.placeholder')"
				name="mdnsInterface"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesWledPlugin.fields.config.mdns.autoAdd.title')"
			prop="mdns.autoAdd"
			label-position="left"
		>
			<el-switch
				v-model="model.mdns.autoAdd"
				name="mdnsAutoAdd"
			/>
		</el-form-item>

		<hr />

		<el-alert
			type="info"
			:title="t('devicesWledPlugin.headings.aboutWebsocket')"
			:description="t('devicesWledPlugin.texts.aboutWebsocket')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesWledPlugin.fields.config.websocket.enabled.title')"
			prop="websocket.enabled"
			class="mt-3"
			label-position="left"
		>
			<el-switch
				v-model="model.websocket.enabled"
				name="websocketEnabled"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesWledPlugin.fields.config.websocket.reconnectInterval.title')"
			prop="websocket.reconnectInterval"
		>
			<el-input-number
				v-model="model.websocket.reconnectInterval"
				:min="1000"
				:step="1000"
				name="websocket.reconnectInterval"
			/>
		</el-form-item>

		<hr />

		<el-alert
			type="info"
			:title="t('devicesWledPlugin.headings.aboutPolling')"
			:description="t('devicesWledPlugin.texts.aboutPolling')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesWledPlugin.fields.config.polling.interval.title')"
			prop="polling.interval"
			class="mt-3"
		>
			<el-input-number
				v-model="model.polling.interval"
				:min="1000"
				:step="1000"
				name="polling.interval"
			/>
		</el-form-item>

		<hr />

		<el-alert
			type="info"
			:title="t('devicesWledPlugin.headings.aboutTimeouts')"
			:description="t('devicesWledPlugin.texts.aboutTimeouts')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesWledPlugin.fields.config.timeouts.connectionTimeout.title')"
			prop="timeouts.connectionTimeout"
			class="mt-3"
		>
			<el-input-number
				v-model="model.timeouts.connectionTimeout"
				:min="1000"
				:step="1000"
				name="timeouts.connectionTimeout"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesWledPlugin.fields.config.timeouts.commandDebounce.title')"
			prop="timeouts.commandDebounce"
		>
			<el-input-number
				v-model="model.timeouts.commandDebounce"
				:min="0"
				:step="100"
				name="timeouts.commandDebounce"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElInputNumber, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IWledConfigEditForm } from '../schemas/config.types';

import type { IWledConfigFormProps } from './wled-config-form.types';

defineOptions({
	name: 'WledConfigForm',
});

const props = withDefaults(defineProps<IWledConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IWledConfigEditForm>({
	config: props.config,
	messages: {
		success: t('devicesWledPlugin.messages.config.edited'),
		error: t('devicesWledPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IWledConfigEditForm>>({
	'polling.interval': [
		{ required: true, message: t('devicesWledPlugin.fields.config.polling.interval.validation.required'), trigger: 'change' },
		{
			type: 'integer',
			message: t('devicesWledPlugin.fields.config.polling.interval.validation.number'),
			validator: (rule, value) => value >= 1000,
			trigger: 'change',
		},
	],
	'websocket.reconnectInterval': [
		{ required: true, message: t('devicesWledPlugin.fields.config.websocket.reconnectInterval.validation.required'), trigger: 'change' },
		{
			type: 'integer',
			message: t('devicesWledPlugin.fields.config.websocket.reconnectInterval.validation.number'),
			validator: (rule, value) => value >= 1000,
			trigger: 'change',
		},
	],
	'timeouts.connectionTimeout': [
		{ required: true, message: t('devicesWledPlugin.fields.config.timeouts.connectionTimeout.validation.required'), trigger: 'change' },
		{
			type: 'integer',
			message: t('devicesWledPlugin.fields.config.timeouts.connectionTimeout.validation.number'),
			validator: (rule, value) => value >= 1000,
			trigger: 'change',
		},
	],
	'timeouts.commandDebounce': [
		{ required: true, message: t('devicesWledPlugin.fields.config.timeouts.commandDebounce.validation.required'), trigger: 'change' },
		{
			type: 'integer',
			message: t('devicesWledPlugin.fields.config.timeouts.commandDebounce.validation.number'),
			validator: (rule, value) => value >= 0,
			trigger: 'change',
		},
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
