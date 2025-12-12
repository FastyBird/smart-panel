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
			:title="t('devicesShellyNgPlugin.headings.aboutPluginStatus')"
			:description="t('devicesShellyNgPlugin.texts.aboutPluginStatus')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesShellyNgPlugin.fields.config.enabled.title')"
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
			:title="t('devicesShellyNgPlugin.headings.aboutMdns')"
			:description="t('devicesShellyNgPlugin.texts.aboutMdns')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesShellyNgPlugin.fields.config.mdns.enabled.title')"
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
			:label="t('devicesShellyNgPlugin.fields.config.mdns.interface.title')"
			prop="mdns.interface"
		>
			<el-input
				v-model="model.mdns.interface"
				:placeholder="t('devicesShellyNgPlugin.fields.config.mdns.interface.placeholder')"
				name="mdnsInterface"
			/>
		</el-form-item>

		<hr />

		<el-alert
			type="info"
			:title="t('devicesShellyNgPlugin.headings.aboutWebsockets')"
			:description="t('devicesShellyNgPlugin.texts.aboutWebsockets')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesShellyNgPlugin.fields.config.websockets.requestTimeout.title')"
			prop="websockets.requestTimeout"
			class="mt-3"
		>
			<el-input
				v-model="model.websockets.requestTimeout"
				:placeholder="t('devicesShellyNgPlugin.fields.config.websockets.requestTimeout.placeholder')"
				name="websockets.requestTimeout"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesShellyNgPlugin.fields.config.websockets.pingInterval.title')"
			prop="websockets.pingInterval"
		>
			<el-input
				v-model="model.websockets.pingInterval"
				:placeholder="t('devicesShellyNgPlugin.fields.config.websockets.pingInterval.placeholder')"
				name="websockets.pingInterval"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesShellyNgPlugin.fields.config.websockets.reconnectInterval.title')"
			prop="websockets.reconnectInterval"
		>
			<el-select
				v-model="model.websockets.reconnectInterval"
				name="websockets.reconnectInterval"
				multiple
				filterable
				allow-create
				default-first-option
				:reserve-keyword="false"
				:placeholder="t('devicesShellyNgPlugin.fields.config.websockets.reconnectInterval.placeholder')"
			>
				<el-option
					v-for="item in model.websockets.reconnectInterval"
					:key="item"
					:label="item"
					:value="Number(item)"
				/>
			</el-select>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IShellyNgConfigEditForm } from '../schemas/config.types';

import type { IShellyNgConfigFormProps } from './shelly-ng-config-form.types';

defineOptions({
	name: 'ShellyNgConfigForm',
});

const props = withDefaults(defineProps<IShellyNgConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IShellyNgConfigEditForm>({
	config: props.config,
	messages: {
		success: t('devicesShellyNgPlugin.messages.config.edited'),
		error: t('devicesShellyNgPlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IShellyNgConfigEditForm>>({
	'websockets.requestTimeout': [
		{ required: true, message: t('devicesShellyNgPlugin.fields.config.websockets.requestTimeout.validation.required'), trigger: 'change' },
		{
			type: 'integer',
			message: t('devicesShellyNgPlugin.fields.config.websockets.requestTimeout.validation.number'),
			validator: (rule, value) => value >= 1,
			trigger: 'change',
		},
	],
	'websockets.pingInterval': [
		{ required: true, message: t('devicesShellyNgPlugin.fields.config.websockets.pingInterval.validation.required'), trigger: 'change' },
		{
			type: 'integer',
			message: t('devicesShellyNgPlugin.fields.config.websockets.pingInterval.validation.number'),
			validator: (rule, value) => value >= 0,
			trigger: 'change',
		},
	],
	'websockets.reconnectInterval': [
		{ required: true, message: t('devicesShellyNgPlugin.fields.config.websockets.reconnectInterval.validation.required'), trigger: 'change' },
		{
			type: 'array',
			min: 1,
			defaultField: {
				type: 'integer',
				message: t('devicesShellyNgPlugin.fields.config.websockets.reconnectInterval.validation.number'),
				validator: (rule, value) => value >= 1,
			},
			message: t('devicesShellyNgPlugin.fields.config.websockets.reconnectInterval.validation.array'),
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
