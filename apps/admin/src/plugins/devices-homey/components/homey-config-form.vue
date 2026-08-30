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
			:title="t(`devicesHomeyPlugin.config.${model.mode}.title`)"
			:description="t(`devicesHomeyPlugin.config.${model.mode}.description`)"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesHomeyPlugin.config.mode.label')"
			prop="mode"
			class="mt-3"
		>
			<el-radio-group v-model="model.mode">
				<el-radio-button :value="DevicesHomeyPluginConnectionMode.local">
					{{ t('devicesHomeyPlugin.config.mode.local') }}
				</el-radio-button>
				<el-radio-button :value="DevicesHomeyPluginConnectionMode.cloud">
					{{ t('devicesHomeyPlugin.config.mode.cloud') }}
				</el-radio-button>
			</el-radio-group>
		</el-form-item>

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

		<template v-if="model.mode === DevicesHomeyPluginConnectionMode.local">
			<el-form-item
				:label="t('devicesHomeyPlugin.config.url.label')"
				prop="url"
				:error="fieldErrors['url']"
			>
				<el-input
					v-model="url"
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
		</template>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<el-form-item
				:label="t('devicesHomeyPlugin.config.connectionTimeout')"
				prop="connectionTimeout"
				:error="fieldErrors['connectionTimeout']"
			>
				<el-input-number
					v-model="model.connectionTimeout"
					:min="MIN_HOMEY_CONNECTION_TIMEOUT_MS"
					:max="MAX_HOMEY_CONNECTION_TIMEOUT_MS"
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
					:min="MIN_HOMEY_RECONCILIATION_INTERVAL_MS"
					:max="MAX_HOMEY_RECONCILIATION_INTERVAL_MS"
					:step="30000"
					class="w-full"
				/>
			</el-form-item>
		</div>

		<homey-connection-panel
			:mode="model.mode"
			:candidate-url="model.url"
			:candidate-api-key="model.apiKey"
		/>

		<homey-cloud-authorization-panel
			v-if="model.mode === DevicesHomeyPluginConnectionMode.cloud"
			:saved-mode="savedMode"
		/>
	</el-form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElInputNumber, ElRadioButton, ElRadioGroup, ElSwitch, type FormRules } from 'element-plus';

import { ConfigSecretInput, FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import { DevicesHomeyPluginConnectionMode } from '../../../openapi.constants';
import {
	MAX_HOMEY_CONNECTION_TIMEOUT_MS,
	MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
	MIN_HOMEY_CONNECTION_TIMEOUT_MS,
	MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
} from '../devices-homey.constants';
import { hasUsableHomeyApiKey, isBlankHomeyApiKeyReplacement } from '../schemas/config.schemas';
import type { IHomeyConfigEditForm } from '../schemas/config.types';
import { isSafeHomeyUrl } from '../schemas/homey-url.schemas';
import type { IHomeyConfig } from '../store/config.store.types';

import HomeyCloudAuthorizationPanel from './HomeyCloudAuthorizationPanel.vue';
import HomeyConnectionPanel from './HomeyConnectionPanel.vue';
import type { IHomeyConfigFormProps } from './homey-config-form.types';
import { normalizeHomeyUrlInput } from './homey-config-form.utils';

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
const {
	formEl,
	model,
	formChanged,
	submit: submitConfig,
	formResult,
} = useConfigPluginEditForm<IHomeyConfigEditForm>({
	config: props.config,
	messages: {
		success: t('devicesHomeyPlugin.messages.config.updated'),
		error: t('devicesHomeyPlugin.messages.config.updateFailed'),
	},
});

const fieldErrors = computed<Record<string, string | undefined>>(() =>
	Object.fromEntries(props.remoteFormErrors.map((error) => [error.field, error.message]))
);
const savedMode = ref<DevicesHomeyPluginConnectionMode>((props.config as IHomeyConfig).mode);

const submit = async (): Promise<'saved'> => {
	const result = await submitConfig();
	savedMode.value = model.mode;

	return result;
};

const url = computed<string>({
	get: () => model.url ?? '',
	set: (value) => {
		model.url = normalizeHomeyUrlInput(value);
	},
});

const rules = computed<FormRules<IHomeyConfigEditForm>>(() => ({
	url: [
		{
			validator: (_rule, value, callback) => {
				if (model.mode === DevicesHomeyPluginConnectionMode.local && model.enabled && (value === null || value === undefined || value === '')) {
					callback(new Error(t('devicesHomeyPlugin.config.url.required')));
				} else if (typeof value === 'string' && value !== '' && !isSafeHomeyUrl(value)) {
					callback(new Error(t('devicesHomeyPlugin.config.url.invalid')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
	apiKey: [
		{
			validator: (_rule, value, callback) => {
				if (model.mode === DevicesHomeyPluginConnectionMode.local && isBlankHomeyApiKeyReplacement(value)) {
					callback(new Error(t('devicesHomeyPlugin.config.apiKey.invalid')));
				} else if (model.mode === DevicesHomeyPluginConnectionMode.local && model.enabled && !hasUsableHomeyApiKey(value, model.apiKeyConfigured)) {
					callback(new Error(t('devicesHomeyPlugin.config.apiKey.required')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
	connectionTimeout: [
		{
			required: true,
			message: t('devicesHomeyPlugin.config.validation.connectionTimeoutRequired'),
			trigger: ['change', 'blur'],
		},
		{
			type: 'number',
			min: MIN_HOMEY_CONNECTION_TIMEOUT_MS,
			max: MAX_HOMEY_CONNECTION_TIMEOUT_MS,
			message: t('devicesHomeyPlugin.config.validation.connectionTimeoutRange', {
				min: MIN_HOMEY_CONNECTION_TIMEOUT_MS,
				max: MAX_HOMEY_CONNECTION_TIMEOUT_MS,
			}),
			trigger: ['change', 'blur'],
		},
	],
	reconciliationInterval: [
		{
			required: true,
			message: t('devicesHomeyPlugin.config.validation.reconciliationIntervalRequired'),
			trigger: ['change', 'blur'],
		},
		{
			type: 'number',
			min: MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
			max: MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
			message: t('devicesHomeyPlugin.config.validation.reconciliationIntervalRange', {
				min: MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
				max: MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
			}),
			trigger: ['change', 'blur'],
		},
	],
}));

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
		if (value) {
			formEl.value?.resetFields();
			model.mode = savedMode.value;
		}
	}
);
</script>
