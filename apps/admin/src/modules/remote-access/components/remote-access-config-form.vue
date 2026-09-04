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
			:title="t('remoteAccessModule.config.about.title')"
			:description="t('remoteAccessModule.config.about.description')"
			:closable="false"
		/>

		<el-form-item
			:label="t('remoteAccessModule.fields.config.internalUrl.title')"
			prop="internalUrl"
			class="mt-3"
		>
			<el-input
				v-model="model.internalUrl"
				:placeholder="t('remoteAccessModule.fields.config.internalUrl.placeholder')"
				name="internalUrl"
				clearable
			/>
			<div class="text-sm text-gray-500 mt-1">
				{{ t('remoteAccessModule.fields.config.internalUrl.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('remoteAccessModule.fields.config.externalUrl.title')"
			prop="externalUrl"
		>
			<el-input
				v-model="model.externalUrl"
				:placeholder="t('remoteAccessModule.fields.config.externalUrl.placeholder')"
				name="externalUrl"
				clearable
			/>
			<div class="text-sm text-gray-500 mt-1">
				{{ t('remoteAccessModule.fields.config.externalUrl.description') }}
			</div>
		</el-form-item>

		<el-divider />

		<el-alert
			type="info"
			:title="t('remoteAccessModule.config.proxyTrust.title')"
			:description="t('remoteAccessModule.config.proxyTrust.description')"
			:closable="false"
		/>

		<el-form-item
			:label="t('remoteAccessModule.fields.config.trustForwardedHeaders.title')"
			prop="trustForwardedHeaders"
			label-position="left"
			class="mt-3"
		>
			<el-switch
				v-model="model.trustForwardedHeaders"
				name="trustForwardedHeaders"
			/>
		</el-form-item>

		<el-form-item
			:label="t('remoteAccessModule.fields.config.trustedProxies.title')"
			prop="trustedProxies"
		>
			<el-select
				v-model="model.trustedProxies"
				name="trustedProxies"
				multiple
				filterable
				allow-create
				default-first-option
				:reserve-keyword="false"
				:placeholder="t('remoteAccessModule.fields.config.trustedProxies.placeholder')"
			>
				<el-option
					v-for="item in model.trustedProxies"
					:key="item"
					:label="item"
					:value="item"
				/>
			</el-select>
			<div class="text-sm text-gray-500 mt-1">
				{{ t('remoteAccessModule.fields.config.trustedProxies.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigModuleEditForm } from '../../config';
import { RemoteAccessOriginSchema, RemoteAccessTrustedProxySchema } from '../schemas/config.schemas';
import type { IRemoteAccessConfigEditForm } from '../schemas/config.types';

import type { IRemoteAccessConfigFormProps } from './remote-access-config-form.types';

defineOptions({
	name: 'RemoteAccessConfigForm',
});

const props = withDefaults(defineProps<IRemoteAccessConfigFormProps>(), {
	remoteFormSubmit: false,
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
	layout: Layout.DEFAULT,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', value: boolean): void;
	(e: 'update:remote-form-result', value: FormResultType): void;
	(e: 'update:remote-form-reset', value: boolean): void;
	(e: 'update:remote-form-changed', value: boolean): void;
}>();

const { t } = useI18n();

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<IRemoteAccessConfigEditForm>({
	config: props.config,
	messages: {
		success: t('remoteAccessModule.messages.config.edited'),
		error: t('remoteAccessModule.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<IRemoteAccessConfigEditForm>>({
	internalUrl: [
		{
			validator: (_rule, value: string | null, callback): void => {
				const empty = value === null || value === '';
				const valid = empty ? true : RemoteAccessOriginSchema.safeParse(value).success;

				callback(valid ? undefined : new Error(t('remoteAccessModule.fields.config.internalUrl.invalid')));
			},
			trigger: 'change',
		},
	],
	externalUrl: [
		{
			validator: (_rule, value: string | null, callback): void => {
				const empty = value === null || value === '';
				const valid = empty ? true : RemoteAccessOriginSchema.safeParse(value).success;

				callback(valid ? undefined : new Error(t('remoteAccessModule.fields.config.externalUrl.invalid')));
			},
			trigger: 'change',
		},
	],
	trustedProxies: [
		{
			validator: (_rule, value: string[], callback): void => {
				const valid = Array.isArray(value) && value.every((entry) => RemoteAccessTrustedProxySchema.safeParse(entry).success);

				callback(valid ? undefined : new Error(t('remoteAccessModule.fields.config.trustedProxies.invalid')));
			},
			trigger: 'change',
		},
	],
});

watch(formResult, (value): void => emit('update:remote-form-result', value));
watch(
	(): boolean => props.remoteFormSubmit,
	(value): void => {
		if (!value) return;

		emit('update:remote-form-submit', false);

		submit().catch(() => {
			// The form is not valid
		});
	}
);
watch(
	(): boolean => props.remoteFormReset,
	(value): void => {
		emit('update:remote-form-reset', false);

		if (value) formEl.value?.resetFields();
	}
);
watch(formChanged, (value): void => emit('update:remote-form-changed', value));
</script>
