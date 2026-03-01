<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('buddyModule.fields.config.provider.title')"
			prop="provider"
		>
			<el-select
				v-model="model.provider"
				:placeholder="t('buddyModule.fields.config.provider.placeholder')"
				name="provider"
			>
				<el-option
					v-for="option in providerOptions"
					:key="option.value"
					:label="option.label"
					:value="option.value"
				/>
			</el-select>
		</el-form-item>

		<el-alert
			v-if="model.provider !== LLM_PROVIDER_NONE"
			type="info"
			show-icon
			:closable="false"
			style="margin-bottom: 18px"
		>
			{{ t('buddyModule.texts.pluginConfigHint') }}
		</el-alert>

		<el-divider />

		<el-form-item
			:label="t('buddyModule.fields.config.sttProvider.title')"
			prop="sttProvider"
		>
			<el-select
				v-model="model.sttProvider"
				:placeholder="t('buddyModule.fields.config.sttProvider.placeholder')"
				name="sttProvider"
			>
				<el-option
					v-for="option in sttProviderOptions"
					:key="option.value"
					:label="option.label"
					:value="option.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			v-if="model.sttProvider === SttProvider.WHISPER_API"
			:label="t('buddyModule.fields.config.sttApiKey.title')"
			prop="sttApiKey"
		>
			<el-input
				v-model="model.sttApiKey"
				:placeholder="t('buddyModule.fields.config.sttApiKey.placeholder')"
				:type="showSttApiKey ? 'text' : 'password'"
				name="sttApiKey"
				clearable
			>
				<template #suffix>
					<el-icon
						class="cursor-pointer"
						@click="showSttApiKey = !showSttApiKey"
					>
						<icon :icon="showSttApiKey ? 'mdi:eye-off' : 'mdi:eye'" />
					</el-icon>
				</template>
			</el-input>
		</el-form-item>

		<el-form-item
			v-if="model.sttProvider !== SttProvider.NONE"
			:label="t('buddyModule.fields.config.sttModel.title')"
			prop="sttModel"
		>
			<el-input
				v-model="model.sttModel"
				:placeholder="sttModelPlaceholder"
				name="sttModel"
				clearable
			/>
		</el-form-item>

		<el-form-item
			v-if="model.sttProvider !== SttProvider.NONE"
			:label="t('buddyModule.fields.config.sttLanguage.title')"
			prop="sttLanguage"
		>
			<el-input
				v-model="model.sttLanguage"
				:placeholder="t('buddyModule.fields.config.sttLanguage.placeholder')"
				name="sttLanguage"
				clearable
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElIcon, ElInput, ElOption, ElSelect, type FormRules } from 'element-plus';

import { Icon } from '@iconify/vue';

import { FormResult, type FormResultType, Layout, useConfigModuleEditForm } from '../../config';
import { LEGACY_PROVIDER_MAP, LLM_PROVIDER_NONE, SttProvider } from '../buddy.constants';
import type { IBuddyConfigEditForm } from '../schemas/config.types';

import type { IBuddyConfigFormProps } from './buddy-config-form.types';

defineOptions({
	name: 'BuddyConfigForm',
});

const props = withDefaults(defineProps<IBuddyConfigFormProps>(), {
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

// Normalize legacy provider values before initializing the form so the
// initial snapshot already contains the mapped value (avoids false dirty state).
const normalizedConfig = { ...props.config } as Record<string, unknown>;
const rawProvider = normalizedConfig.provider as string | undefined;

if (rawProvider && LEGACY_PROVIDER_MAP.has(rawProvider)) {
	normalizedConfig.provider = LEGACY_PROVIDER_MAP.get(rawProvider) ?? rawProvider;
}

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<IBuddyConfigEditForm>({
	config: normalizedConfig as typeof props.config,
	messages: {
		success: t('buddyModule.messages.config.edited'),
		error: t('buddyModule.messages.config.notEdited'),
	},
});

const showSttApiKey = ref<boolean>(false);

const providerOptions = computed(() => [
	{ value: LLM_PROVIDER_NONE, label: t('buddyModule.fields.config.provider.options.none') },
	{ value: 'buddy-openai-plugin', label: t('buddyModule.fields.config.provider.options.openai') },
	{ value: 'buddy-openai-codex-plugin', label: t('buddyModule.fields.config.provider.options.openaiCodex') },
	{ value: 'buddy-claude-plugin', label: t('buddyModule.fields.config.provider.options.claude') },
	{ value: 'buddy-claude-oauth-plugin', label: t('buddyModule.fields.config.provider.options.claudeOauth') },
	{ value: 'buddy-ollama-plugin', label: t('buddyModule.fields.config.provider.options.ollama') },
]);

const sttProviderOptions = computed(() => [
	{ value: SttProvider.NONE, label: t('buddyModule.fields.config.sttProvider.options.none') },
	{ value: SttProvider.WHISPER_API, label: t('buddyModule.fields.config.sttProvider.options.whisperApi') },
	{ value: SttProvider.WHISPER_LOCAL, label: t('buddyModule.fields.config.sttProvider.options.whisperLocal') },
]);

const sttModelPlaceholder = computed<string>((): string => {
	switch (model.sttProvider) {
		case SttProvider.WHISPER_API:
			return 'whisper-1';
		case SttProvider.WHISPER_LOCAL:
			return 'base';
		default:
			return '';
	}
});

const rules = reactive<FormRules<IBuddyConfigEditForm>>({});

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
