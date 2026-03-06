<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('buddyModule.fields.config.enabled.title')"
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
			:label="t('buddyModule.fields.config.name.title')"
			prop="name"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('buddyModule.fields.config.name.placeholder')"
				name="name"
			/>
		</el-form-item>

		<el-alert
			type="info"
			show-icon
			:closable="false"
			style="margin-bottom: 18px"
		>
			{{ t('buddyModule.fields.config.name.description') }}
		</el-alert>

		<el-alert
			v-if="providerFetchFailed"
			type="warning"
			show-icon
			:closable="false"
			style="margin-bottom: 18px"
		>
			{{ t('buddyModule.texts.providersFetchFailed') }}
		</el-alert>

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

		<el-divider />

		<el-form-item
			:label="t('buddyModule.fields.config.voiceEnabled.title')"
			prop="voiceEnabled"
			label-position="left"
		>
			<el-switch
				v-model="model.voiceEnabled"
				name="voiceEnabled"
			/>
		</el-form-item>

		<el-alert
			type="info"
			show-icon
			:closable="false"
			style="margin-bottom: 18px"
		>
			{{ t('buddyModule.fields.config.voiceEnabled.description') }}
		</el-alert>

		<el-alert
			v-if="sttProviderFetchFailed"
			type="warning"
			show-icon
			:closable="false"
			style="margin-bottom: 18px"
		>
			{{ t('buddyModule.texts.sttProvidersFetchFailed') }}
		</el-alert>

		<el-form-item
			:label="t('buddyModule.fields.config.sttPlugin.title')"
			prop="sttPlugin"
		>
			<el-select
				v-model="model.sttPlugin"
				:placeholder="t('buddyModule.fields.config.sttPlugin.placeholder')"
				name="sttPlugin"
			>
				<el-option
					v-for="option in sttOptions"
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
			v-if="model.sttPlugin && model.sttPlugin !== STT_PLUGIN_NONE"
			type="info"
			show-icon
			:closable="false"
			style="margin-bottom: 18px"
		>
			{{ t('buddyModule.texts.pluginConfigHint') }}
		</el-alert>

		<el-divider />

		<el-alert
			v-if="ttsProviderFetchFailed"
			type="warning"
			show-icon
			:closable="false"
			style="margin-bottom: 18px"
		>
			{{ t('buddyModule.texts.ttsProvidersFetchFailed') }}
		</el-alert>

		<el-form-item
			:label="t('buddyModule.fields.config.ttsPlugin.title')"
			prop="ttsPlugin"
		>
			<el-select
				v-model="model.ttsPlugin"
				:placeholder="t('buddyModule.fields.config.ttsPlugin.placeholder')"
				name="ttsPlugin"
			>
				<el-option
					v-for="option in ttsOptions"
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
			v-if="model.ttsPlugin && model.ttsPlugin !== TTS_PLUGIN_NONE"
			type="info"
			show-icon
			:closable="false"
			style="margin-bottom: 18px"
		>
			{{ t('buddyModule.texts.pluginConfigHint') }}
		</el-alert>

		<el-form-item
			v-if="model.ttsPlugin && model.ttsPlugin !== TTS_PLUGIN_NONE"
			:label="t('buddyModule.fields.config.ttsVoice.title')"
			prop="ttsVoice"
		>
			<el-input
				v-model="model.ttsVoice"
				:placeholder="t('buddyModule.fields.config.ttsVoice.placeholder')"
				name="ttsVoice"
				clearable
			/>
		</el-form-item>

		<el-form-item
			v-if="model.ttsPlugin && model.ttsPlugin !== TTS_PLUGIN_NONE"
			:label="t('buddyModule.fields.config.ttsSpeed.title')"
			prop="ttsSpeed"
		>
			<el-input-number
				v-model="model.ttsSpeed"
				:min="0.25"
				:max="4.0"
				:step="0.25"
				:precision="2"
				name="ttsSpeed"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch, ElTag, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigModuleEditForm } from '../../config';
import { LEGACY_PROVIDER_MAP, LLM_PROVIDER_NONE, STT_PLUGIN_NONE, TTS_PLUGIN_NONE } from '../buddy.constants';
import { useBuddyProviders } from '../composables/useBuddyProviders';
import { useBuddySttProviders } from '../composables/useBuddySttProviders';
import { useBuddyTtsProviders } from '../composables/useBuddyTtsProviders';
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

const { providerStatuses, providerFetchFailed, fetchProviderStatuses } = useBuddyProviders();
const { sttProviderStatuses, sttProviderFetchFailed, fetchSttProviderStatuses } = useBuddySttProviders();
const { ttsProviderStatuses, ttsProviderFetchFailed, fetchTtsProviderStatuses } = useBuddyTtsProviders();

onBeforeMount(async (): Promise<void> => {
	await Promise.all([fetchProviderStatuses(), fetchSttProviderStatuses(), fetchTtsProviderStatuses()]);
});

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<IBuddyConfigEditForm>({
	config: normalizedConfig as typeof props.config,
	messages: {
		success: t('buddyModule.messages.config.edited'),
		error: t('buddyModule.messages.config.notEdited'),
	},
});

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger';

const providerOptions = computed(() => {
	const options: { value: string; label: string; disabled: boolean; tag?: string; tagType?: TagType }[] = [
		{
			value: LLM_PROVIDER_NONE,
			label: t('buddyModule.fields.config.provider.options.none'),
			disabled: false,
			tag: t('buddyModule.fields.config.provider.tags.ruleBasedOnly'),
			tagType: 'info',
		},
	];

	for (const provider of providerStatuses.value) {
		let tag: string | undefined;
		let tagType: TagType | undefined;

		if (provider.enabled && !provider.configured) {
			tag = t('buddyModule.fields.config.provider.notConfigured');
			tagType = 'warning';
		}

		options.push({
			value: provider.type,
			label: provider.name,
			disabled: !provider.enabled,
			tag,
			tagType,
		});
	}

	// If the fetch failed and the current provider isn't in the list, add a fallback entry
	if (providerFetchFailed.value && model.provider && model.provider !== LLM_PROVIDER_NONE) {
		const exists = options.some((o) => o.value === model.provider);

		if (!exists) {
			options.push({
				value: model.provider,
				label: model.provider,
				disabled: false,
			});
		}
	}

	return options;
});

const sttOptions = computed(() => {
	const options: { value: string; label: string; disabled: boolean; tag?: string; tagType?: TagType }[] = [
		{
			value: STT_PLUGIN_NONE,
			label: t('buddyModule.fields.config.sttPlugin.options.none'),
			disabled: false,
			tag: t('buddyModule.fields.config.sttPlugin.tags.disabled'),
			tagType: 'info',
		},
	];

	for (const provider of sttProviderStatuses.value) {
		let tag: string | undefined;
		let tagType: TagType | undefined;

		if (provider.enabled && !provider.configured) {
			tag = t('buddyModule.fields.config.sttPlugin.notConfigured');
			tagType = 'warning';
		}

		options.push({
			value: provider.type,
			label: provider.name,
			disabled: !provider.enabled,
			tag,
			tagType,
		});
	}

	// If the fetch failed and the current plugin isn't in the list, add a fallback entry
	if (sttProviderFetchFailed.value && model.sttPlugin && model.sttPlugin !== STT_PLUGIN_NONE) {
		const exists = options.some((o) => o.value === model.sttPlugin);

		if (!exists) {
			options.push({
				value: model.sttPlugin,
				label: model.sttPlugin,
				disabled: false,
			});
		}
	}

	return options;
});

const ttsOptions = computed(() => {
	const options: { value: string; label: string; disabled: boolean; tag?: string; tagType?: TagType }[] = [
		{
			value: TTS_PLUGIN_NONE,
			label: t('buddyModule.fields.config.ttsPlugin.options.none'),
			disabled: false,
			tag: t('buddyModule.fields.config.ttsPlugin.tags.disabled'),
			tagType: 'info',
		},
	];

	for (const provider of ttsProviderStatuses.value) {
		let tag: string | undefined;
		let tagType: TagType | undefined;

		if (provider.enabled && !provider.configured) {
			tag = t('buddyModule.fields.config.ttsPlugin.notConfigured');
			tagType = 'warning';
		}

		options.push({
			value: provider.type,
			label: provider.name,
			disabled: !provider.enabled,
			tag,
			tagType,
		});
	}

	// If the fetch failed and the current plugin isn't in the list, add a fallback entry
	if (ttsProviderFetchFailed.value && model.ttsPlugin && model.ttsPlugin !== TTS_PLUGIN_NONE) {
		const exists = options.some((o) => o.value === model.ttsPlugin);

		if (!exists) {
			options.push({
				value: model.ttsPlugin,
				label: model.ttsPlugin,
				disabled: false,
			});
		}
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
