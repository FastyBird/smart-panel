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
			:title="t('remoteAccessCloudflareTunnelPlugin.headings.cloudflareTunnel')"
			:description="t('remoteAccessCloudflareTunnelPlugin.texts.aboutTunnelSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('remoteAccessCloudflareTunnelPlugin.fields.config.enabled.title')"
			prop="enabled"
			label-position="left"
			class="mt-3"
		>
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>

		<el-form-item
			:label="t('remoteAccessCloudflareTunnelPlugin.fields.config.publicHostname.title')"
			prop="publicHostname"
		>
			<el-input
				:model-value="model.publicHostname ?? ''"
				:placeholder="t('remoteAccessCloudflareTunnelPlugin.fields.config.publicHostname.placeholder')"
				name="publicHostname"
				@update:model-value="onPublicHostnameInput"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('remoteAccessCloudflareTunnelPlugin.fields.config.publicHostname.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('remoteAccessCloudflareTunnelPlugin.fields.config.protocol.title')"
			prop="protocol"
		>
			<el-select
				v-model="model.protocol"
				class="w-full"
			>
				<el-option
					v-for="option in protocolOptions"
					:key="option.value"
					:label="option.label"
					:value="option.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('remoteAccessCloudflareTunnelPlugin.fields.config.tunnelToken.title')"
			prop="tunnelToken"
		>
			<config-secret-input
				v-model="model.tunnelToken"
				:configured="model.tunnelTokenConfigured"
				:placeholder="t('remoteAccessCloudflareTunnelPlugin.fields.config.tunnelToken.placeholder')"
				name="tunnelToken"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('remoteAccessCloudflareTunnelPlugin.fields.config.tunnelToken.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch, type FormRules } from 'element-plus';

import { ConfigSecretInput, FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import { RemoteAccessCloudflareTunnelPluginProtocol } from '../../../openapi.constants';
import type { ICloudflareTunnelConfigEditForm } from '../schemas/config.types';
import { isValidCloudflareTunnelHostname } from '../schemas/hostname.schemas';

import type { ICloudflareTunnelConfigFormProps } from './cloudflare-tunnel-config-form.types';

defineOptions({
	name: 'CloudflareTunnelConfigForm',
});

const props = withDefaults(defineProps<ICloudflareTunnelConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<ICloudflareTunnelConfigEditForm>({
	config: props.config,
	messages: {
		success: t('remoteAccessCloudflareTunnelPlugin.messages.config.edited'),
		error: t('remoteAccessCloudflareTunnelPlugin.messages.config.notEdited'),
	},
});

const onPublicHostnameInput = (value: string): void => {
	model.publicHostname = value.trim() === '' ? null : value;
};

const protocolOptions: { value: RemoteAccessCloudflareTunnelPluginProtocol; label: string }[] = [
	{ value: RemoteAccessCloudflareTunnelPluginProtocol.auto, label: t('remoteAccessCloudflareTunnelPlugin.fields.config.protocol.options.auto') },
	{ value: RemoteAccessCloudflareTunnelPluginProtocol.http2, label: t('remoteAccessCloudflareTunnelPlugin.fields.config.protocol.options.http2') },
	{ value: RemoteAccessCloudflareTunnelPluginProtocol.quic, label: t('remoteAccessCloudflareTunnelPlugin.fields.config.protocol.options.quic') },
];

const rules = reactive<FormRules<ICloudflareTunnelConfigEditForm>>({
	publicHostname: [
		{
			validator: (_rule, value, callback) => {
				if (typeof value === 'string' && value.trim() !== '' && !isValidCloudflareTunnelHostname(value.trim())) {
					callback(new Error(t('remoteAccessCloudflareTunnelPlugin.fields.config.publicHostname.invalid')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
	tunnelToken: [
		{
			validator: (_rule, value, callback) => {
				const retained = typeof value === 'undefined' && model.tunnelTokenConfigured === true;
				const provided = (typeof value === 'string' && value.trim() !== '') || retained;

				if (!provided) {
					callback(new Error(t('remoteAccessCloudflareTunnelPlugin.fields.config.tunnelToken.validation.required')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
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
