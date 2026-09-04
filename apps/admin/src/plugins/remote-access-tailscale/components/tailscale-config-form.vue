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
			:title="t('remoteAccessTailscalePlugin.config.sections.node.title')"
			:description="t('remoteAccessTailscalePlugin.config.sections.node.description')"
			:closable="false"
		/>

		<el-form-item
			:label="t('remoteAccessTailscalePlugin.fields.config.hostname.title')"
			prop="hostname"
			class="mt-3"
		>
			<el-input
				v-model="model.hostname"
				:placeholder="t('remoteAccessTailscalePlugin.fields.config.hostname.placeholder')"
				name="hostname"
			/>
		</el-form-item>

		<el-form-item
			:label="t('remoteAccessTailscalePlugin.fields.config.loginServer.title')"
			prop="loginServer"
		>
			<el-input
				v-model="model.loginServer"
				:placeholder="t('remoteAccessTailscalePlugin.fields.config.loginServer.placeholder')"
				name="loginServer"
			/>
			<div class="text-sm text-gray-500 mt-1">
				{{ t('remoteAccessTailscalePlugin.fields.config.loginServer.description') }}
			</div>
		</el-form-item>

		<el-divider />

		<el-alert
			type="info"
			:title="t('remoteAccessTailscalePlugin.config.sections.tailnet.title')"
			:description="t('remoteAccessTailscalePlugin.config.sections.tailnet.description')"
			:closable="false"
		/>

		<el-form-item
			:label="t('remoteAccessTailscalePlugin.fields.config.acceptDns.title')"
			prop="acceptDns"
			label-position="left"
			class="mt-3"
		>
			<el-switch
				v-model="model.acceptDns"
				name="acceptDns"
			/>
		</el-form-item>

		<el-form-item
			:label="t('remoteAccessTailscalePlugin.fields.config.acceptRoutes.title')"
			prop="acceptRoutes"
			label-position="left"
		>
			<el-switch
				v-model="model.acceptRoutes"
				name="acceptRoutes"
			/>
		</el-form-item>

		<el-form-item
			:label="t('remoteAccessTailscalePlugin.fields.config.advertiseTags.title')"
			prop="advertiseTags"
		>
			<el-select
				v-model="model.advertiseTags"
				name="advertiseTags"
				multiple
				filterable
				allow-create
				default-first-option
				:reserve-keyword="false"
				:placeholder="t('remoteAccessTailscalePlugin.fields.config.advertiseTags.placeholder')"
			>
				<el-option
					v-for="item in model.advertiseTags"
					:key="item"
					:label="item"
					:value="item"
				/>
			</el-select>
			<div class="text-sm text-gray-500 mt-1">
				{{ t('remoteAccessTailscalePlugin.fields.config.advertiseTags.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('remoteAccessTailscalePlugin.fields.config.ssh.title')"
			prop="ssh"
			label-position="left"
		>
			<el-switch
				v-model="model.ssh"
				name="ssh"
			/>
		</el-form-item>

		<el-divider />

		<el-alert
			type="info"
			:title="t('remoteAccessTailscalePlugin.config.sections.serve.title')"
			:description="t('remoteAccessTailscalePlugin.config.sections.serve.description')"
			:closable="false"
		/>

		<el-form-item
			:label="t('remoteAccessTailscalePlugin.fields.config.serveHttps.title')"
			prop="serveHttps"
			label-position="left"
			class="mt-3"
		>
			<el-switch
				v-model="model.serveHttps"
				name="serveHttps"
			/>
		</el-form-item>

		<el-form-item
			:label="t('remoteAccessTailscalePlugin.fields.config.funnel.title')"
			prop="funnel"
			label-position="left"
		>
			<el-switch
				v-model="model.funnel"
				name="funnel"
			/>
		</el-form-item>

		<el-alert
			v-if="model.funnel"
			type="warning"
			:title="t('remoteAccessTailscalePlugin.texts.funnelWarning')"
			:closable="false"
			show-icon
		/>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { ITailscaleConfigEditForm } from '../schemas/config.types';

import type { ITailscaleConfigFormProps } from './tailscale-config-form.types';

defineOptions({
	name: 'TailscaleConfigForm',
});

const props = withDefaults(defineProps<ITailscaleConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<ITailscaleConfigEditForm>({
	config: props.config,
	messages: {
		success: t('remoteAccessTailscalePlugin.messages.config.edited'),
		error: t('remoteAccessTailscalePlugin.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<ITailscaleConfigEditForm>>({
	hostname: [{ required: true, message: t('remoteAccessTailscalePlugin.fields.config.hostname.validation.required'), trigger: 'change' }],
	loginServer: [{ required: true, message: t('remoteAccessTailscalePlugin.fields.config.loginServer.validation.required'), trigger: 'change' }],
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
