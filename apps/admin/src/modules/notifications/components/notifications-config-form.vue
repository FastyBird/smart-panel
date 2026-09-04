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
			:title="t('notificationsModule.headings.aboutConfig')"
			:description="t('notificationsModule.texts.aboutConfig')"
			:closable="false"
		/>

		<!--
			The unit sits beside each number input, never inside it: `el-input-number` has no suffix
			slot of its own, so slot content handed to it lands in the inner `el-input` and squeezes the
			editable area to nothing.
		-->
		<el-form-item
			:label="t('notificationsModule.fields.config.retentionDays.title')"
			prop="retentionDays"
			class="mt-3"
		>
			<el-input-number
				v-model="model.retentionDays"
				:min="1"
				:max="365"
				:placeholder="t('notificationsModule.fields.config.retentionDays.placeholder')"
				name="retentionDays"
			/>
			<el-text class="ml-2!">{{ t('notificationsModule.fields.config.retentionDays.unit') }}</el-text>
		</el-form-item>

		<el-form-item
			:label="t('notificationsModule.fields.config.maxNotifications.title')"
			prop="maxNotifications"
		>
			<el-input-number
				v-model="model.maxNotifications"
				:min="50"
				:max="5000"
				:step="50"
				:placeholder="t('notificationsModule.fields.config.maxNotifications.placeholder')"
				name="maxNotifications"
			/>
			<el-text class="ml-2!">{{ t('notificationsModule.fields.config.maxNotifications.unit') }}</el-text>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInputNumber, ElText, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, type LayoutType, useConfigModuleEditForm } from '../../config';
import type { IConfigModule } from '../../config/store/config-modules.store.types';
import type { INotificationsConfigEditForm } from '../schemas/config.schemas';

defineOptions({
	name: 'NotificationsConfigForm',
});

const props = withDefaults(
	defineProps<{
		config: IConfigModule;
		remoteFormSubmit?: boolean;
		remoteFormResult?: FormResultType;
		remoteFormReset?: boolean;
		remoteFormChanged?: boolean;
		layout?: LayoutType;
	}>(),
	{
		remoteFormResult: FormResult.NONE,
		remoteFormReset: false,
		remoteFormChanged: false,
		layout: Layout.DEFAULT,
	}
);

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const { formEl, model, formChanged, submit, formResult } = useConfigModuleEditForm<INotificationsConfigEditForm>({
	config: props.config,
	messages: {
		success: t('notificationsModule.messages.config.edited'),
		error: t('notificationsModule.messages.config.notEdited'),
	},
});

const rules = reactive<FormRules<INotificationsConfigEditForm>>({
	retentionDays: [
		{ required: true, message: t('notificationsModule.fields.config.retentionDays.validation.required'), trigger: 'change' },
		{ type: 'number', min: 1, max: 365, message: t('notificationsModule.fields.config.retentionDays.validation.range'), trigger: 'change' },
	],
	maxNotifications: [
		{ required: true, message: t('notificationsModule.fields.config.maxNotifications.validation.required'), trigger: 'change' },
		{ type: 'number', min: 50, max: 5000, message: t('notificationsModule.fields.config.maxNotifications.validation.range'), trigger: 'change' },
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
