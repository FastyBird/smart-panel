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
			:title="t('buddyModule.headings.aboutBuddy')"
			:description="t('buddyModule.texts.aboutBuddy')"
			:closable="false"
		/>

		<el-form-item
			:label="t('buddyModule.fields.config.llmProvider.title')"
			prop="llmProvider"
			class="mt-3"
		>
			<el-select
				v-model="model.llmProvider"
				:placeholder="t('buddyModule.fields.config.llmProvider.placeholder')"
				name="llmProvider"
			>
				<el-option
					:label="t('buddyModule.fields.config.llmProvider.options.none')"
					value="none"
				/>
				<el-option
					:label="t('buddyModule.fields.config.llmProvider.options.claude')"
					value="claude"
				/>
				<el-option
					:label="t('buddyModule.fields.config.llmProvider.options.openai')"
					value="openai"
				/>
				<el-option
					:label="t('buddyModule.fields.config.llmProvider.options.ollama')"
					value="ollama"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			v-if="model.llmProvider !== 'none' && model.llmProvider !== 'ollama'"
			:label="t('buddyModule.fields.config.apiKey.title')"
			prop="apiKey"
		>
			<el-input
				v-model="model.apiKey"
				:type="showApiKey ? 'text' : 'password'"
				:placeholder="t('buddyModule.fields.config.apiKey.placeholder')"
				name="apiKey"
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
			v-if="model.llmProvider !== 'none'"
			:label="t('buddyModule.fields.config.llmModel.title')"
			prop="llmModel"
		>
			<el-input
				v-model="model.llmModel"
				:placeholder="modelPlaceholder"
				name="llmModel"
			/>
		</el-form-item>

		<el-form-item
			v-if="model.llmProvider === 'ollama'"
			:label="t('buddyModule.fields.config.ollamaUrl.title')"
			prop="ollamaUrl"
		>
			<el-input
				v-model="model.ollamaUrl"
				:placeholder="t('buddyModule.fields.config.ollamaUrl.placeholder')"
				name="ollamaUrl"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElIcon, ElInput, ElOption, ElSelect, type FormRules } from 'element-plus';

import { Icon } from '@iconify/vue';

import { FormResult, type FormResultType, Layout, useConfigModuleEditForm } from '../../config';

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

const modelPlaceholder = computed<string>((): string => {
	switch (model.llmProvider) {
		case 'claude':
			return 'claude-sonnet-4-20250514';
		case 'openai':
			return 'gpt-4o';
		case 'ollama':
			return 'llama3';
		default:
			return '';
	}
});

const rules = reactive<FormRules<IBuddyConfigEditForm>>({});

watch(
	(): FormResultType => formResult.value,
	(val: FormResultType): void => {
		emit('update:remote-form-result', val);
	}
);

watch(
	(): boolean => props.remoteFormSubmit,
	(val: boolean): void => {
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
