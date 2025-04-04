<template>
	<el-form
		ref="formEl"
		:model="model"
		:label-position="props.layout === Layout.PHONE ? 'top' : 'right'"
		:label-width="180"
		status-icon
	>
		<el-form-item
			:label="t('configModule.fields.language.title')"
			prop="language"
		>
			<el-select
				v-model="model.language"
				:placeholder="t('configModule.fields.language.placeholder')"
				name="language"
				filterable
				class="md:max-w-50"
			>
				<el-option
					v-for="item in languageOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('configModule.fields.timezone.title')"
			prop="timezone"
		>
			<el-select
				v-model="model.timezone"
				:placeholder="t('configModule.fields.timezone.placeholder')"
				name="timezone"
				filterable
				class="md:max-w-50"
			>
				<el-option
					v-for="item in timezoneOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('configModule.fields.timeFormat.title')"
			prop="timeFormat"
		>
			<el-select
				v-model="model.timeFormat"
				:placeholder="t('configModule.fields.timeFormat.placeholder')"
				name="timeFormat"
				filterable
				class="md:max-w-50"
			>
				<el-option
					v-for="item in timeFormatOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElOption, ElSelect } from 'element-plus';

import { useConfigLanguageEditForm } from '../composables';
import { FormResult, type FormResultType, Layout } from '../config.constants';

import type { IConfigLanguageFormProps } from './config-language-form.types';

defineOptions({
	name: 'ConfigLanguageForm',
});

const props = withDefaults(defineProps<IConfigLanguageFormProps>(), {
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

const { languageOptions, timezoneOptions, timeFormatOptions, model, formEl, formChanged, submit, formResult } = useConfigLanguageEditForm({
	config: props.config,
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
				// Form is not valid
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
