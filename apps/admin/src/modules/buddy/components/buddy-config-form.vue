<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('buddyModule.fields.config.name.title')"
			prop="name"
		>
			<template #label>
				{{ t('buddyModule.fields.config.name.title') }}
				<el-text
					size="small"
					type="info"
				>
					{{ t('buddyModule.fields.config.name.description') }}
				</el-text>
			</template>
			<el-input
				v-model="model.name"
				:placeholder="t('buddyModule.fields.config.name.placeholder')"
				name="name"
			/>
		</el-form-item>

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
					:disabled="option.disabled"
				>
					<span>{{ option.label }}</span>
					<el-tag
						v-if="option.tag"
						size="small"
						:type="option.tagType"
						effect="light"
						style="margin-left: 8px"
					>
						{{ option.tag }}
					</el-tag>
				</el-option>
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
	</el-form>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElTag, ElText, type FormRules } from 'element-plus';

import { injectStoresManager } from '../../../common';
import { FormResult, type FormResultType, Layout, configPluginsStoreKey, useConfigModuleEditForm } from '../../config';
import { LEGACY_PROVIDER_MAP, LLM_PROVIDER_NONE } from '../buddy.constants';
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

const storesManager = injectStoresManager();
const configPluginsStore = storesManager.getStore(configPluginsStoreKey);

onBeforeMount((): void => {
	configPluginsStore.fetch().catch(() => {
		// Plugin configs may not be available yet
	});
});

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<IBuddyConfigEditForm>({
	config: normalizedConfig as typeof props.config,
	messages: {
		success: t('buddyModule.messages.config.edited'),
		error: t('buddyModule.messages.config.notEdited'),
	},
});

const pluginDefinitions: { value: string; labelKey: string; tag?: string; tagType?: string }[] = [
	{ value: 'buddy-openai-plugin', labelKey: 'buddyModule.fields.config.provider.options.openai' },
	{ value: 'buddy-openai-codex-plugin', labelKey: 'buddyModule.fields.config.provider.options.openaiCodex' },
	{ value: 'buddy-claude-plugin', labelKey: 'buddyModule.fields.config.provider.options.claude' },
	{ value: 'buddy-claude-oauth-plugin', labelKey: 'buddyModule.fields.config.provider.options.claudeOauth' },
	{ value: 'buddy-ollama-plugin', labelKey: 'buddyModule.fields.config.provider.options.ollama', tag: 'local', tagType: 'info' },
];

const isPluginConfigured = (type: string): boolean => {
	const plugin = configPluginsStore.findByType(type) as Record<string, unknown> | null;

	if (!plugin) {
		return false;
	}

	switch (type) {
		case 'buddy-claude-plugin':
		case 'buddy-openai-plugin':
			return !!plugin.apiKey;
		case 'buddy-claude-oauth-plugin':
		case 'buddy-openai-codex-plugin':
			return !!plugin.accessToken || !!plugin.refreshToken;
		case 'buddy-ollama-plugin':
			return true;
		default:
			return false;
	}
};

const providerOptions = computed(() => {
	const options: { value: string; label: string; disabled: boolean; tag?: string; tagType?: string }[] = [
		{
			value: LLM_PROVIDER_NONE,
			label: t('buddyModule.fields.config.provider.options.none'),
			disabled: false,
			tag: t('buddyModule.fields.config.provider.tags.ruleBasedOnly'),
			tagType: 'info',
		},
	];

	for (const def of pluginDefinitions) {
		const plugin = configPluginsStore.findByType(def.value);
		const enabled = plugin?.enabled ?? false;

		let tag = def.tag;
		let tagType = def.tagType;

		if (enabled && !isPluginConfigured(def.value)) {
			tag = t('buddyModule.fields.config.provider.notConfigured');
			tagType = 'warning';
		}

		options.push({
			value: def.value,
			label: t(def.labelKey),
			disabled: !enabled,
			tag,
			tagType,
		});
	}

	return options;
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
