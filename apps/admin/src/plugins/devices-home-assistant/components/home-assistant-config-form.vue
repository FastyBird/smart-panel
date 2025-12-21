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
			:title="t('devicesHomeAssistantPlugin.headings.aboutConnectionSettings')"
			:description="t('devicesHomeAssistantPlugin.texts.aboutConnectionSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.config.enabled.title')"
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
			:label="t('devicesHomeAssistantPlugin.fields.config.apiKey.title')"
			prop="apiKey"
		>
			<el-input
				v-model="model.apiKey"
				:placeholder="t('devicesHomeAssistantPlugin.fields.config.apiKey.placeholder')"
				name="apiKey"
				:rows="4"
				type="textarea"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.config.hostname.title')"
			prop="hostname"
		>
			<div class="flex gap-2 w-full">
				<el-autocomplete
					v-model="model.hostname"
					:fetch-suggestions="querySearch"
					:placeholder="t('devicesHomeAssistantPlugin.fields.config.hostname.placeholder')"
					:loading="isLoadingInstances"
					class="flex-1"
					clearable
					@focus="onHostnameFocus"
				>
					<template #default="{ item }">
						<div class="flex flex-col">
							<span class="font-medium">{{ item.value }}</span>
							<span class="text-xs text-gray-500">
								{{ item.name }}
								<template v-if="item.version"> (v{{ item.version }})</template>
							</span>
						</div>
					</template>
				</el-autocomplete>
				<el-tooltip
					:content="t('devicesHomeAssistantPlugin.buttons.refreshDiscovery')"
					placement="top"
				>
					<el-button
						:loading="isLoadingInstances"
						@click="onRefreshClick"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
						</svg>
					</el-button>
				</el-tooltip>
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElAutocomplete, ElButton, ElForm, ElFormItem, ElInput, ElSwitch, ElTooltip, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import { useDiscoveredInstances } from '../composables/useDiscoveredInstances';
import type { IHomeAssistantConfigEditForm } from '../schemas/config.types';

import type { IHomeAssistantConfigFormProps } from './home-assistant-config-form.types';

interface AutocompleteItem {
	value: string;
	name: string;
	version?: string | null;
}

defineOptions({
	name: 'HomeAssistantConfigForm',
});

const props = withDefaults(defineProps<IHomeAssistantConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IHomeAssistantConfigEditForm>({
	config: props.config,
	messages: {
		success: t('devicesHomeAssistantPlugin.messages.config.edited'),
		error: t('devicesHomeAssistantPlugin.messages.config.notEdited'),
	},
});

const { instances, isLoading: isLoadingInstances, fetchInstances, refreshInstances } = useDiscoveredInstances();

const autocompleteOptions = computed<AutocompleteItem[]>(() => {
	return instances.value.map((instance) => ({
		value: instance.port === 8123 ? instance.hostname : `${instance.hostname}:${instance.port}`,
		name: instance.name,
		version: instance.version,
	}));
});

const querySearch = (queryString: string, cb: (results: AutocompleteItem[]) => void): void => {
	const results = queryString
		? autocompleteOptions.value.filter((item) => item.value.toLowerCase().includes(queryString.toLowerCase()))
		: autocompleteOptions.value;
	cb(results);
};

const onHostnameFocus = (): void => {
	if (instances.value.length === 0) {
		fetchInstances();
	}
};

const onRefreshClick = (): void => {
	refreshInstances();
};

onMounted(() => {
	fetchInstances();
});

const rules = reactive<FormRules<IHomeAssistantConfigEditForm>>({
	hostname: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.config.hostname.validation.required'), trigger: 'change' }],
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
