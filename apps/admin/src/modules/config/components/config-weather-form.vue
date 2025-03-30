<template>
	<el-form
		ref="formEl"
		:model="model"
		:label-position="props.layout === Layout.PHONE ? 'top' : 'right'"
		:label-width="180"
		status-icon
	>
		<el-form-item
			:label="t('configModule.fields.locationType.title')"
			prop="locationType"
		>
			<el-select
				v-model="model.locationType"
				:placeholder="t('configModule.fields.locationType.placeholder')"
				name="locationType"
				filterable
				class="md:max-w-50"
			>
				<el-option
					v-for="item in locationTypeOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('configModule.fields.location.title')"
			prop="location"
		>
			<el-input
				v-model="model.location"
				:placeholder="t('configModule.fields.location.placeholder')"
				name="location"
			/>
		</el-form-item>

		<el-form-item
			:label="t('configModule.fields.unit.title')"
			prop="unit"
		>
			<el-select
				v-model="model.unit"
				:placeholder="t('configModule.fields.unit.placeholder')"
				name="unit"
				filterable
				class="md:max-w-50"
			>
				<el-option
					v-for="item in unitOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('configModule.fields.openWeatherApiKey.title')"
			prop="openWeatherApiKey"
		>
			<el-input
				v-model="model.openWeatherApiKey"
				:placeholder="t('configModule.fields.openWeatherApiKey.placeholder')"
				name="openWeatherApiKey"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, ElOption, ElSelect } from 'element-plus';

import { useConfigWeatherEditForm } from '../composables';
import { FormResult, type FormResultType, Layout } from '../config.constants';

import type { ConfigWeatherFormProps } from './config-weather-form.types';

defineOptions({
	name: 'ConfigWeatherForm',
});

const props = withDefaults(defineProps<ConfigWeatherFormProps>(), {
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

const { locationTypeOptions, unitOptions, model, formEl, formChanged, submit, formResult } = useConfigWeatherEditForm(props.config);

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
