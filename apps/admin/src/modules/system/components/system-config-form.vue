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
			:title="t('systemModule.headings.aboutLanguageSettings')"
			:description="t('systemModule.texts.aboutLanguageSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('systemModule.fields.config.language.title')"
			prop="language"
			class="mt-3"
		>
			<el-select
				v-model="model.language"
				:placeholder="t('systemModule.fields.config.language.placeholder')"
				name="language"
			>
				<el-option
					:label="t('systemModule.fields.config.language.values.english')"
					value="en_US"
				/>
				<el-option
					:label="t('systemModule.fields.config.language.values.czech')"
					value="cs_CZ"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('systemModule.fields.config.timezone.title')"
			prop="timezone"
		>
			<el-select
				v-model="model.timezone"
				:placeholder="t('systemModule.fields.config.timezone.placeholder')"
				name="timezone"
				filterable
			>
				<el-option
					v-for="tz in timezones"
					:key="tz"
					:label="tz"
					:value="tz"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('systemModule.fields.config.timeFormat.title')"
			prop="timeFormat"
		>
			<el-select
				v-model="model.timeFormat"
				:placeholder="t('systemModule.fields.config.timeFormat.placeholder')"
				name="timeFormat"
			>
				<el-option
					:label="t('systemModule.fields.config.timeFormat.values.hour12')"
					value="12h"
				/>
				<el-option
					:label="t('systemModule.fields.config.timeFormat.values.hour24')"
					value="24h"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('systemModule.fields.config.temperatureUnit.title')"
			prop="temperatureUnit"
		>
			<el-select
				v-model="model.temperatureUnit"
				:placeholder="t('systemModule.fields.config.temperatureUnit.placeholder')"
				name="temperatureUnit"
			>
				<el-option
					:label="t('systemModule.fields.config.temperatureUnit.values.celsius')"
					value="celsius"
				/>
				<el-option
					:label="t('systemModule.fields.config.temperatureUnit.values.fahrenheit')"
					value="fahrenheit"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('systemModule.fields.config.windSpeedUnit.title')"
			prop="windSpeedUnit"
		>
			<el-select
				v-model="model.windSpeedUnit"
				:placeholder="t('systemModule.fields.config.windSpeedUnit.placeholder')"
				name="windSpeedUnit"
			>
				<el-option
					:label="t('systemModule.fields.config.windSpeedUnit.values.ms')"
					value="ms"
				/>
				<el-option
					:label="t('systemModule.fields.config.windSpeedUnit.values.kmh')"
					value="kmh"
				/>
				<el-option
					:label="t('systemModule.fields.config.windSpeedUnit.values.mph')"
					value="mph"
				/>
				<el-option
					:label="t('systemModule.fields.config.windSpeedUnit.values.knots')"
					value="knots"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('systemModule.fields.config.pressureUnit.title')"
			prop="pressureUnit"
		>
			<el-select
				v-model="model.pressureUnit"
				:placeholder="t('systemModule.fields.config.pressureUnit.placeholder')"
				name="pressureUnit"
			>
				<el-option
					:label="t('systemModule.fields.config.pressureUnit.values.hpa')"
					value="hpa"
				/>
				<el-option
					:label="t('systemModule.fields.config.pressureUnit.values.mbar')"
					value="mbar"
				/>
				<el-option
					:label="t('systemModule.fields.config.pressureUnit.values.inhg')"
					value="inhg"
				/>
				<el-option
					:label="t('systemModule.fields.config.pressureUnit.values.mmhg')"
					value="mmhg"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('systemModule.fields.config.precipitationUnit.title')"
			prop="precipitationUnit"
		>
			<el-select
				v-model="model.precipitationUnit"
				:placeholder="t('systemModule.fields.config.precipitationUnit.placeholder')"
				name="precipitationUnit"
			>
				<el-option
					:label="t('systemModule.fields.config.precipitationUnit.values.mm')"
					value="mm"
				/>
				<el-option
					:label="t('systemModule.fields.config.precipitationUnit.values.inches')"
					value="inches"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('systemModule.fields.config.distanceUnit.title')"
			prop="distanceUnit"
		>
			<el-select
				v-model="model.distanceUnit"
				:placeholder="t('systemModule.fields.config.distanceUnit.placeholder')"
				name="distanceUnit"
			>
				<el-option
					:label="t('systemModule.fields.config.distanceUnit.values.km')"
					value="km"
				/>
				<el-option
					:label="t('systemModule.fields.config.distanceUnit.values.miles')"
					value="miles"
				/>
				<el-option
					:label="t('systemModule.fields.config.distanceUnit.values.meters')"
					value="meters"
				/>
				<el-option
					:label="t('systemModule.fields.config.distanceUnit.values.feet')"
					value="feet"
				/>
			</el-select>
		</el-form-item>

		<el-divider />

		<el-alert
			type="info"
			:title="t('systemModule.headings.aboutSystemSettings')"
			:description="t('systemModule.texts.aboutSystemSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('systemModule.fields.config.logLevels.title')"
			prop="logLevels"
			class="mt-3"
		>
			<el-select
				v-model="model.logLevels"
				:placeholder="t('systemModule.fields.config.logLevels.placeholder')"
				name="logLevels"
				multiple
			>
				<el-option
					v-for="level in logLevels"
					:key="level.value"
					:label="level.label"
					:value="level.value"
				/>
			</el-select>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElSelect, ElOption, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigModuleEditForm } from '../../config';
import type { ISystemConfigEditForm } from '../schemas/config.types';

import type { ISystemConfigFormProps } from './system-config-form.types';

defineOptions({
	name: 'SystemConfigForm',
});

const props = withDefaults(defineProps<ISystemConfigFormProps>(), {
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

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<ISystemConfigEditForm>({
	config: props.config,
	messages: {
		success: t('systemModule.messages.config.edited'),
		error: t('systemModule.messages.config.notEdited'),
	},
});

const timezones = [
	'Africa/Cairo',
	'Africa/Johannesburg',
	'America/New_York',
	'America/Los_Angeles',
	'Asia/Dubai',
	'Asia/Tokyo',
	'Asia/Kolkata',
	'Australia/Sydney',
	'Europe/London',
	'Europe/Berlin',
	'Europe/Prague',
];

const logLevels = [
	{ value: 'silent', label: t('systemModule.fields.config.logLevels.values.silent') },
	{ value: 'verbose', label: t('systemModule.fields.config.logLevels.values.verbose') },
	{ value: 'debug', label: t('systemModule.fields.config.logLevels.values.debug') },
	{ value: 'trace', label: t('systemModule.fields.config.logLevels.values.trace') },
	{ value: 'log', label: t('systemModule.fields.config.logLevels.values.log') },
	{ value: 'info', label: t('systemModule.fields.config.logLevels.values.info') },
	{ value: 'success', label: t('systemModule.fields.config.logLevels.values.success') },
	{ value: 'warn', label: t('systemModule.fields.config.logLevels.values.warn') },
	{ value: 'error', label: t('systemModule.fields.config.logLevels.values.error') },
	{ value: 'fail', label: t('systemModule.fields.config.logLevels.values.fail') },
	{ value: 'fatal', label: t('systemModule.fields.config.logLevels.values.fatal') },
];

const rules = reactive<FormRules<ISystemConfigEditForm>>({
	language: [{ required: true, message: t('systemModule.fields.config.language.validation.required'), trigger: 'change' }],
	timezone: [{ required: true, message: t('systemModule.fields.config.timezone.validation.required'), trigger: 'change' }],
	timeFormat: [{ required: true, message: t('systemModule.fields.config.timeFormat.validation.required'), trigger: 'change' }],
	temperatureUnit: [{ required: true, message: t('systemModule.fields.config.temperatureUnit.validation.required'), trigger: 'change' }],
	windSpeedUnit: [{ required: true, message: t('systemModule.fields.config.windSpeedUnit.validation.required'), trigger: 'change' }],
	pressureUnit: [{ required: true, message: t('systemModule.fields.config.pressureUnit.validation.required'), trigger: 'change' }],
	precipitationUnit: [{ required: true, message: t('systemModule.fields.config.precipitationUnit.validation.required'), trigger: 'change' }],
	distanceUnit: [{ required: true, message: t('systemModule.fields.config.distanceUnit.validation.required'), trigger: 'change' }],
	logLevels: [
		{ required: true, message: t('systemModule.fields.config.logLevels.validation.required'), trigger: 'change' },
		{
			type: 'array',
			min: 1,
			message: t('systemModule.fields.config.logLevels.validation.min'),
			trigger: 'change',
		},
	],
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
