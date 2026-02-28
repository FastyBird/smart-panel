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

		<el-form-item
			v-if="model.provider !== 'none' && model.provider !== 'ollama'"
			:label="t('buddyModule.fields.config.apiKey.title')"
			prop="apiKey"
		>
			<el-input
				v-model="model.apiKey"
				:placeholder="t('buddyModule.fields.config.apiKey.placeholder')"
				:type="showApiKey ? 'text' : 'password'"
				name="apiKey"
				clearable
			>
				<template #suffix>
					<el-icon
						class="cursor-pointer"
						@click="showApiKey = !showApiKey"
					>
						<icon :icon="showApiKey ? 'mdi:eye-off' : 'mdi:eye'" />
					</el-icon>
				</template>
			</el-input>
		</el-form-item>

		<el-form-item
			v-if="model.provider !== 'none'"
			:label="t('buddyModule.fields.config.model.title')"
			prop="model"
		>
			<el-input
				v-model="model.model"
				:placeholder="modelPlaceholder"
				name="model"
				clearable
			/>
		</el-form-item>

		<el-form-item
			v-if="model.provider === 'ollama'"
			:label="t('buddyModule.fields.config.ollamaUrl.title')"
			prop="ollamaUrl"
		>
			<el-input
				v-model="model.ollamaUrl"
				:placeholder="t('buddyModule.fields.config.ollamaUrl.placeholder')"
				name="ollamaUrl"
				clearable
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElIcon, ElInput, ElOption, ElSelect, type FormRules } from 'element-plus';

import { Icon } from '@iconify/vue';

import { FormResult, type FormResultType, Layout, useConfigModuleEditForm } from '../../config';
import { LlmProvider } from '../buddy.constants';
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

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<IBuddyConfigEditForm>({
	config: props.config,
	messages: {
		success: t('buddyModule.messages.config.edited'),
		error: t('buddyModule.messages.config.notEdited'),
	},
});

const showApiKey = ref<boolean>(false);

const providerOptions = computed(() => [
	{ value: LlmProvider.NONE, label: t('buddyModule.fields.config.provider.options.none') },
	{ value: LlmProvider.CLAUDE, label: t('buddyModule.fields.config.provider.options.claude') },
	{ value: LlmProvider.OPENAI, label: t('buddyModule.fields.config.provider.options.openai') },
	{ value: LlmProvider.OLLAMA, label: t('buddyModule.fields.config.provider.options.ollama') },
]);

const modelPlaceholder = computed<string>((): string => {
	switch (model.provider) {
		case LlmProvider.CLAUDE:
			return 'claude-sonnet-4-5-20250514';
		case LlmProvider.OPENAI:
			return 'gpt-4o';
		case LlmProvider.OLLAMA:
			return 'llama3';
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
