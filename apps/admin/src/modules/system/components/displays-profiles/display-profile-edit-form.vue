<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
		class="pt-4"
	>
		<el-alert
			:title="t('systemModule.headings.displaysProfiles.layout')"
			:description="t('systemModule.texts.displaysProfiles.layout')"
			:closable="false"
			show-icon
			type="info"
		/>

		<el-divider />

		<el-form-item
			:label="t('systemModule.fields.displaysProfiles.unitSize.title')"
			:prop="['unitSize']"
		>
			<el-slider
				v-model="model.unitSize"
				name="unitSize"
				:step="5"
				:min="40"
				:max="200"
				show-stops
				show-input
				:placeholder="t('systemModule.fields.displaysProfiles.unitSize.placeholder')"
			/>
		</el-form-item>

		<el-alert
			type="info"
			:description="t('systemModule.texts.displaysProfiles.unitSize')"
			:closable="false"
			show-icon
		/>

		<el-divider />

		<el-form-item
			:label="t('systemModule.fields.displaysProfiles.cols.title')"
			:prop="['cols']"
		>
			<el-slider
				v-model="model.cols"
				name="cols"
				:step="1"
				:min="1"
				:max="12"
				show-stops
				show-input
				:placeholder="t('systemModule.fields.displaysProfiles.cols.placeholder')"
			/>
		</el-form-item>

		<el-alert
			type="info"
			:description="t('systemModule.texts.displaysProfiles.displayCols')"
			:closable="false"
			show-icon
		/>

		<el-divider />

		<el-form-item
			:label="t('systemModule.fields.displaysProfiles.rows.title')"
			:prop="['rows']"
		>
			<el-slider
				v-model="model.rows"
				name="rows"
				:step="1"
				:min="1"
				:max="12"
				show-stops
				show-input
				:placeholder="t('systemModule.fields.displaysProfiles.rows.placeholder')"
			/>
		</el-form-item>

		<el-alert
			type="info"
			:description="t('systemModule.texts.displaysProfiles.displayRows')"
			:closable="false"
			show-icon
		/>

		<el-divider />

		<el-alert
			type="warning"
			:title="t('systemModule.headings.displaysProfiles.profileTip')"
			:description="t('systemModule.texts.displaysProfiles.profileTip')"
			:closable="false"
			show-icon
		>
			<template #icon>
				<icon icon="mdi:lightbulb-on" />
			</template>
		</el-alert>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElSlider, type FormRules } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useDisplayProfileEditForm } from '../../composables/composables';
import type { IDisplayProfileEditForm } from '../../schemas/displays-profiles.types';
import { FormResult, type FormResultType } from '../../system.constants';

import type { IDisplayProfileEditFormProps } from './display-profile-edit-form.types';

defineOptions({
	name: 'DisplayProfileEditForm',
});

const props = withDefaults(defineProps<IDisplayProfileEditFormProps>(), {
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

const { model, formEl, formChanged, submit, formResult } = useDisplayProfileEditForm({ display: props.display });

const rules = reactive<FormRules<IDisplayProfileEditForm>>({
	unitSize: [{ required: true, message: t('systemModule.fields.displaysProfiles.unitSize.validation.required'), trigger: 'change' }],
	rows: [{ required: true, message: t('systemModule.fields.displaysProfiles.rows.validation.required'), trigger: 'change' }],
	cols: [{ required: true, message: t('systemModule.fields.displaysProfiles.cols.validation.required'), trigger: 'change' }],
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
