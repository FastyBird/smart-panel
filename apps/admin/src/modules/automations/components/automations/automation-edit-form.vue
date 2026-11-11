<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
		@submit.prevent
	>
		<el-alert
			v-if="props.automation.status !== AutomationStatus.ok"
			:title="t(`automations.statuses.${props.automation.status}.title`)"
			:type="props.automation.status === AutomationStatus.invalid ? 'error' : 'warning'"
			:closable="false"
			show-icon
			class="mb-4!"
		>
			{{ t(`automations.statuses.${props.automation.status}.description`) }}
		</el-alert>

		<el-form-item
			:label="t('automations.form.name.title')"
			prop="name"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('automations.form.name.placeholder')"
				:maxlength="AUTOMATION_NAME_MAX_LENGTH"
				name="name"
			/>
		</el-form-item>

		<el-form-item
			:label="t('automations.form.description.title')"
			prop="description"
		>
			<el-input
				v-model="model.description"
				:placeholder="t('automations.form.description.placeholder')"
				:maxlength="AUTOMATION_DESCRIPTION_MAX_LENGTH"
				:rows="3"
				type="textarea"
				name="description"
			/>
		</el-form-item>

		<el-form-item
			:label="t('automations.form.space.title')"
			prop="spaceId"
		>
			<el-select
				v-model="model.spaceId"
				:placeholder="t('automations.fields.wholeHome')"
				:loading="loadingSpaces"
				name="spaceId"
				filterable
				clearable
				:value-on-clear="null"
			>
				<el-option
					v-for="space in spacesOptions"
					:key="space.value"
					:label="space.label"
					:value="space.value"
				>
					<div class="flex items-center gap-2">
						<icon
							:icon="space.icon"
							class="text-lg"
						/>
						<span>{{ space.label }}</span>
					</div>
				</el-option>
			</el-select>
			<el-text
				size="small"
				type="info"
			>
				{{ t('automations.form.space.hint') }}
			</el-text>
		</el-form-item>

		<el-form-item
			:label="t('automations.form.mode.title')"
			prop="mode"
		>
			<el-select
				v-model="model.mode"
				name="mode"
			>
				<el-option
					v-for="mode in modeOptions"
					:key="mode.value"
					:label="mode.label"
					:value="mode.value"
				/>
			</el-select>
			<el-text
				size="small"
				type="info"
			>
				{{ modeOptions.find((mode) => mode.value === model.mode)?.description }}
			</el-text>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElText, type FormRules } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AUTOMATION_DESCRIPTION_MAX_LENGTH,
	AUTOMATION_NAME_MAX_LENGTH,
	AutomationStatus,
	FormResult,
	type FormResultType,
} from '../../automations.constants';
import { useAutomationEditForm } from '../../composables/useAutomationEditForm';
import { useAutomationSpaces } from '../../composables/useAutomationSpaces';
import type { IAutomationEditForm } from '../../schemas/automations.types';

import type { IAutomationEditFormProps } from './automation-edit-form.types';

defineOptions({
	name: 'AutomationEditForm',
});

const props = withDefaults(defineProps<IAutomationEditFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const { modeOptions, model, formEl, formChanged, submit, formResult } = useAutomationEditForm({ automation: props.automation });

const { spacesOptions, loadingSpaces, fetchSpaces } = useAutomationSpaces();

const rules = reactive<FormRules<IAutomationEditForm>>({
	name: [{ required: true, whitespace: true, message: t('automations.form.name.validation.required'), trigger: 'change' }],
});

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

onMounted((): void => {
	fetchSpaces().catch((): void => {
		// The space is optional; the form works without the list
	});
});
</script>
