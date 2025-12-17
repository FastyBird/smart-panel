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
			:title="t('weatherOpenweathermapPlugin.headings.aboutApiSettings')"
			:description="t('weatherOpenweathermapPlugin.texts.aboutApiSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('weatherOpenweathermapPlugin.fields.config.enabled.title')"
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
			:label="t('weatherOpenweathermapPlugin.fields.config.apiKey.title')"
			prop="apiKey"
		>
			<el-input
				v-model="model.apiKey"
				:placeholder="t('weatherOpenweathermapPlugin.fields.config.apiKey.placeholder')"
				name="apiKey"
				type="password"
				show-password
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('weatherOpenweathermapPlugin.fields.config.apiKey.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('weatherOpenweathermapPlugin.fields.config.unit.title')"
			prop="unit"
		>
			<el-select
				v-model="model.unit"
				:placeholder="t('weatherOpenweathermapPlugin.fields.config.unit.placeholder')"
				class="w-full"
			>
				<el-option
					v-for="option in unitOptions"
					:key="option.value"
					:label="option.label"
					:value="option.value"
				/>
			</el-select>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import type { IOpenWeatherMapConfigEditForm } from '../schemas/config.types';
import { TemperatureUnit } from '../weather-openweathermap.constants';

import type { IOpenWeatherMapConfigFormProps } from './openweathermap-config-form.types';

defineOptions({
	name: 'OpenWeatherMapConfigForm',
});

const props = withDefaults(defineProps<IOpenWeatherMapConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IOpenWeatherMapConfigEditForm>({
	config: props.config,
	messages: {
		success: t('weatherOpenweathermapPlugin.messages.config.edited'),
		error: t('weatherOpenweathermapPlugin.messages.config.notEdited'),
	},
});

const unitOptions = computed(() => [
	{
		value: TemperatureUnit.CELSIUS,
		label: t('weatherOpenweathermapPlugin.fields.config.unit.values.celsius'),
	},
	{
		value: TemperatureUnit.FAHRENHEIT,
		label: t('weatherOpenweathermapPlugin.fields.config.unit.values.fahrenheit'),
	},
]);

const rules = reactive<FormRules<IOpenWeatherMapConfigEditForm>>({});

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
