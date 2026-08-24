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
			:title="t('devicesHomeyPlugin.config.local.title')"
			:description="t('devicesHomeyPlugin.config.local.description')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesHomeyPlugin.config.enabled')"
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
			:label="t('devicesHomeyPlugin.config.url.label')"
			prop="url"
			:error="fieldErrors['url']"
		>
			<el-input
				v-model="model.url"
				name="url"
				:placeholder="t('devicesHomeyPlugin.config.url.placeholder')"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesHomeyPlugin.config.apiKey.label')"
			prop="apiKey"
			:error="fieldErrors['apiKey']"
		>
			<config-secret-input
				v-model="model.apiKey"
				:configured="model.apiKeyConfigured"
				name="apiKey"
				:placeholder="t('devicesHomeyPlugin.config.apiKey.placeholder')"
			/>
		</el-form-item>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<el-form-item
				:label="t('devicesHomeyPlugin.config.connectionTimeout')"
				prop="connectionTimeout"
				:error="fieldErrors['connectionTimeout']"
			>
				<el-input-number
					v-model="model.connectionTimeout"
					:min="1000"
					:max="120000"
					:step="1000"
					class="w-full"
				/>
			</el-form-item>

			<el-form-item
				:label="t('devicesHomeyPlugin.config.reconciliationInterval')"
				prop="reconciliationInterval"
				:error="fieldErrors['reconciliationInterval']"
			>
				<el-input-number
					v-model="model.reconciliationInterval"
					:min="30000"
					:max="86400000"
					:step="30000"
					class="w-full"
				/>
			</el-form-item>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElInputNumber, ElSwitch, type FormRules } from 'element-plus';

import { ConfigSecretInput, FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IHomeyConfigEditForm } from '../schemas/config.types';

import type { IHomeyConfigFormProps } from './homey-config-form.types';

defineOptions({ name: 'HomeyConfigForm' });

const props = withDefaults(defineProps<IHomeyConfigFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
	remoteFormErrors: () => [],
	layout: Layout.DEFAULT,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', value: boolean): void;
	(e: 'update:remote-form-result', value: FormResultType): void;
	(e: 'update:remote-form-reset', value: boolean): void;
	(e: 'update:remote-form-changed', value: boolean): void;
}>();

const { t } = useI18n();
const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IHomeyConfigEditForm>({
	config: props.config,
	messages: {
		success: t('devicesHomeyPlugin.messages.config.updated'),
		error: t('devicesHomeyPlugin.messages.config.updateFailed'),
	},
});

const fieldErrors = computed<Record<string, string | undefined>>(() =>
	Object.fromEntries(props.remoteFormErrors.map((error) => [error.field, error.message]))
);

const rules = reactive<FormRules<IHomeyConfigEditForm>>({
	url: [{ required: true, message: t('devicesHomeyPlugin.config.url.required'), trigger: 'change' }],
});

watch(formResult, (value) => emit('update:remote-form-result', value));
watch(formChanged, (value) => emit('update:remote-form-changed', value));
watch(
	() => props.remoteFormSubmit,
	(value) => {
		if (!value) return;
		emit('update:remote-form-submit', false);
		void submit().catch(() => undefined);
	}
);
watch(
	() => props.remoteFormReset,
	(value) => {
		emit('update:remote-form-reset', false);
		if (value) formEl.value?.resetFields();
	}
);
</script>
