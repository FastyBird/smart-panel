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
			:title="t('weatherModule.headings.aboutPrimaryLocation')"
			:description="t('weatherModule.texts.aboutPrimaryLocation')"
			:closable="false"
		/>

		<el-form-item
			:label="t('weatherModule.fields.config.primaryLocation.title')"
			prop="primaryLocationId"
			class="mt-3"
		>
			<el-select
				v-model="model.primaryLocationId"
				:placeholder="t('weatherModule.fields.config.primaryLocation.placeholder')"
				name="primaryLocationId"
				clearable
				:loading="locationsLoading"
			>
				<el-option
					v-for="location in locations"
					:key="location.id"
					:label="location.name"
					:value="location.id"
				/>
			</el-select>
		</el-form-item>

		<el-alert
			v-if="locations.length === 0 && !locationsLoading"
			type="warning"
			:title="t('weatherModule.messages.locations.noLocations')"
			:closable="false"
			class="mt-3"
		/>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElSelect, ElOption, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigModuleEditForm } from '../../config';
import { useLocations } from '../composables';
import type { IWeatherConfigEditForm } from '../schemas/config.types';

import type { IWeatherConfigFormProps } from './weather-config-form.types';

defineOptions({
	name: 'WeatherConfigForm',
});

const props = withDefaults(defineProps<IWeatherConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<IWeatherConfigEditForm>({
	config: props.config,
	messages: {
		success: t('weatherModule.messages.config.edited'),
		error: t('weatherModule.messages.config.notEdited'),
	},
});

const { locations, areLoading: locationsLoading } = useLocations();

const rules = reactive<FormRules<IWeatherConfigEditForm>>({});

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
