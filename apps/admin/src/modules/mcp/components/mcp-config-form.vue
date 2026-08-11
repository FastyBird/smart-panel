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
			:title="t('mcpModule.config.about.title')"
			:description="t('mcpModule.config.about.description')"
			:closable="false"
			show-icon
		/>

		<el-form-item
			:label="t('mcpModule.config.enabled.title')"
			prop="enabled"
			label-position="left"
			class="mt-3"
		>
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>

		<el-form-item :label="t('mcpModule.config.endpoint.title')">
			<el-input
				:model-value="endpointUrl"
				readonly
				name="endpoint"
			>
				<template #append>
					<el-button
						:aria-label="t('mcpModule.actions.copyEndpoint')"
						@click="copyEndpoint"
					>
						<icon icon="mdi:content-copy" />
					</el-button>
				</template>
			</el-input>
			<div class="text-sm text-gray-500 mt-1">
				{{ t('mcpModule.config.endpoint.description') }}
			</div>
		</el-form-item>

		<el-divider />

		<el-alert
			type="warning"
			:title="t('mcpModule.config.oauth.warningTitle')"
			:description="t('mcpModule.config.oauth.warningDescription')"
			:closable="false"
			show-icon
			class="mb-4"
		/>

		<el-form-item
			:label="t('mcpModule.config.oauth.publicBaseUrlTitle')"
			prop="oauthPublicBaseUrl"
		>
			<el-input
				v-model="model.oauthPublicBaseUrl"
				:placeholder="t('mcpModule.config.oauth.publicBaseUrlPlaceholder')"
				name="oauthPublicBaseUrl"
				clearable
			/>
			<div class="text-sm text-gray-500 mt-1">
				{{ t('mcpModule.config.oauth.publicBaseUrlDescription') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('mcpModule.config.oauth.enabledTitle')"
			prop="oauthEnabled"
			label-position="left"
		>
			<el-switch
				v-model="model.oauthEnabled"
				name="oauthEnabled"
				:disabled="!model.enabled"
			/>
			<div class="w-full text-sm text-gray-500 mt-1">
				{{ t('mcpModule.config.oauth.enabledDescription') }}
			</div>
		</el-form-item>

		<el-divider />

		<el-form-item
			:label="t('mcpModule.config.capabilities.title')"
			prop="capabilities"
		>
			<el-checkbox-group v-model="model.capabilities">
				<div
					v-for="capability in capabilityOptions"
					:key="capability"
					class="mb-3"
				>
					<el-checkbox
						:value="capability"
						:name="`capability-${capability}`"
					>
						{{ t(`mcpModule.capabilities.${capability}.title`) }}
					</el-checkbox>
					<div class="text-sm text-gray-500 ml-6">
						{{ t(`mcpModule.capabilities.${capability}.description`) }}
					</div>
				</div>
			</el-checkbox-group>
		</el-form-item>

		<el-alert
			type="warning"
			:title="t('mcpModule.config.capabilities.warningTitle')"
			:description="t('mcpModule.config.capabilities.warningDescription')"
			:closable="false"
			show-icon
			class="mb-4"
		/>

		<el-divider />

		<el-form-item
			:label="t('mcpModule.config.allowedOrigins.title')"
			prop="allowedOrigins"
		>
			<div class="w-full flex flex-col gap-2">
				<div
					v-for="(_origin, index) in model.allowedOrigins"
					:key="index"
					class="flex gap-2"
				>
					<el-input
						v-model="model.allowedOrigins[index]"
						:placeholder="t('mcpModule.config.allowedOrigins.placeholder')"
						:name="`allowedOrigin-${index}`"
					/>
					<el-button
						type="danger"
						plain
						:aria-label="t('mcpModule.actions.removeOrigin')"
						@click="removeOrigin(index)"
					>
						<icon icon="mdi:delete-outline" />
					</el-button>
				</div>
				<el-button
					plain
					class="self-start"
					@click="addOrigin"
				>
					<icon icon="mdi:plus" />
					{{ t('mcpModule.actions.addOrigin') }}
				</el-button>
			</div>
			<div class="text-sm text-gray-500 mt-1">
				{{ t('mcpModule.config.allowedOrigins.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCheckbox, ElCheckboxGroup, ElDivider, ElForm, ElFormItem, ElInput, ElSwitch, type FormRules } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useFlashMessage } from '../../../common';
import { FormResult, type FormResultType, Layout, useConfigModuleEditForm } from '../../config';
import { McpCapability } from '../mcp.constants';
import { resolveMcpEndpoint } from '../mcp.utils';
import { McpOAuthPublicBaseUrlSchema, McpOriginSchema } from '../schemas/config.schemas';
import type { IMcpConfigEditForm } from '../schemas/config.types';

import type { IMcpConfigFormProps } from './mcp-config-form.types';

defineOptions({ name: 'McpConfigForm' });

const props = withDefaults(defineProps<IMcpConfigFormProps>(), {
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
const flashMessage = useFlashMessage();
const endpointUrl = resolveMcpEndpoint(window.location);
const capabilityOptions = Object.values(McpCapability);

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<IMcpConfigEditForm>({
	config: props.config,
	messages: {
		success: t('mcpModule.messages.configSaved'),
		error: t('mcpModule.messages.configSaveFailed'),
	},
});

const rules = reactive<FormRules<IMcpConfigEditForm>>({
	oauthPublicBaseUrl: [
		{
			validator: (_rule, value: string | null, callback): void => {
				const required = model.enabled && model.oauthEnabled;
				const missing = value === null || value === '';
				const valid = missing ? !required : McpOAuthPublicBaseUrlSchema.safeParse(value).success;
				callback(valid ? undefined : new Error(t('mcpModule.config.oauth.publicBaseUrlInvalid')));
			},
			trigger: 'change',
		},
	],
	allowedOrigins: [
		{
			validator: (_rule, value: string[], callback): void => {
				const valid = Array.isArray(value) && value.every((origin) => McpOriginSchema.safeParse(origin).success);
				callback(valid ? undefined : new Error(t('mcpModule.config.allowedOrigins.invalid')));
			},
			trigger: 'change',
		},
	],
});

const addOrigin = (): void => {
	model.allowedOrigins.push('');
};

const removeOrigin = (index: number): void => {
	model.allowedOrigins.splice(index, 1);
};

const copyEndpoint = async (): Promise<void> => {
	try {
		await navigator.clipboard.writeText(endpointUrl);
		flashMessage.success(t('mcpModule.messages.endpointCopied'));
	} catch {
		flashMessage.error(t('mcpModule.messages.copyFailed'));
	}
};

watch(formResult, (value): void => emit('update:remote-form-result', value));
watch(
	(): boolean => props.remoteFormSubmit,
	(value): void => {
		if (!value) return;
		emit('update:remote-form-submit', false);
		submit().catch(() => undefined);
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
