<template>
	<div>
		<el-form
			ref="formEl"
			:model="model"
			:rules="rules"
			label-position="top"
			status-icon
		>
			<el-alert
				type="info"
				:title="t('devicesModbusPlugin.config.about.title')"
				:description="t('devicesModbusPlugin.config.about.text')"
				:closable="false"
			/>

			<el-form-item
				:label="t('devicesModbusPlugin.config.enabled.title')"
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
				:label="t('devicesModbusPlugin.config.defaultConnectTimeoutMs.title')"
				prop="defaultConnectTimeoutMs"
			>
				<el-input-number
					v-model="model.defaultConnectTimeoutMs"
					:min="1"
					:max="60000"
					:step="100"
					name="defaultConnectTimeoutMs"
				/>
			</el-form-item>

			<el-form-item
				:label="t('devicesModbusPlugin.config.defaultRequestTimeoutMs.title')"
				prop="defaultRequestTimeoutMs"
			>
				<el-input-number
					v-model="model.defaultRequestTimeoutMs"
					:min="1"
					:max="60000"
					:step="100"
					name="defaultRequestTimeoutMs"
				/>
			</el-form-item>

			<el-form-item
				:label="t('devicesModbusPlugin.config.defaultPollIntervalMs.title')"
				prop="defaultPollIntervalMs"
			>
				<el-input-number
					v-model="model.defaultPollIntervalMs"
					:min="100"
					:max="86400000"
					:step="100"
					name="defaultPollIntervalMs"
				/>
			</el-form-item>

			<el-button
				link
				type="primary"
				data-test-id="modbus-config-endpoints-link"
				@click="onOpenEndpoints"
			>
				{{ t('devicesModbusPlugin.config.manageEndpoints') }}
			</el-button>
		</el-form>

		<hr class="my-4" />

		<modbus-templates-catalog />
	</div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElAlert, ElButton, ElForm, ElFormItem, ElInputNumber, ElMessageBox, ElSwitch, type FormRules } from 'element-plus';

import { useLogger } from '../../../common';
import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import { RouteNames } from '../devices-modbus.constants';
import type { IModbusConfigEditForm } from '../schemas/config.types';

import type { IModbusConfigFormProps } from './modbus-config-form.types';
import ModbusTemplatesCatalog from './modbus-templates-catalog.vue';

defineOptions({
	name: 'ModbusConfigForm',
});

const props = withDefaults(defineProps<IModbusConfigFormProps>(), {
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
const router = useRouter();
const logger = useLogger();

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IModbusConfigEditForm>({
	config: props.config,
	messages: {
		success: t('devicesModbusPlugin.config.messages.edited'),
		error: t('devicesModbusPlugin.config.messages.notEdited'),
	},
});

const rangeRule = (field: 'defaultConnectTimeoutMs' | 'defaultRequestTimeoutMs' | 'defaultPollIntervalMs', min: number, max: number) => [
	{ required: true, message: t(`devicesModbusPlugin.config.${field}.required`), trigger: 'change' },
	{
		type: 'integer' as const,
		message: t(`devicesModbusPlugin.config.${field}.range`),
		validator: (_rule: unknown, value: number): boolean => Number.isInteger(value) && value >= min && value <= max,
		trigger: 'change',
	},
];

const rules = reactive<FormRules<IModbusConfigEditForm>>({
	defaultConnectTimeoutMs: rangeRule('defaultConnectTimeoutMs', 1, 60_000),
	defaultRequestTimeoutMs: rangeRule('defaultRequestTimeoutMs', 1, 60_000),
	defaultPollIntervalMs: rangeRule('defaultPollIntervalMs', 100, 86_400_000),
});

const onOpenEndpoints = async (): Promise<void> => {
	// Leaving unmounts the form, so unsaved defaults would be lost without a word: ask first, as the settings page does.
	if (formChanged.value) {
		try {
			await ElMessageBox.confirm(t('configModule.texts.misc.confirmDiscard'), t('configModule.headings.misc.discard'), {
				confirmButtonText: t('configModule.buttons.yes.title'),
				cancelButtonText: t('configModule.buttons.no.title'),
				type: 'warning',
			});
		} catch {
			return;
		}
	}

	router.push({ name: RouteNames.ENDPOINTS }).catch((err: unknown): void => logger.error('Failed to open the Modbus endpoints page', err));
};

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
