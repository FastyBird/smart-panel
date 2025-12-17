<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
		@submit.prevent="onSubmit"
	>
		<el-form-item
			:label="t('weatherModule.fields.locations.name.title')"
			prop="name"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('weatherModule.fields.locations.name.placeholder')"
			/>
		</el-form-item>

		<slot name="extra-fields" />
	</el-form>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput } from 'element-plus';
import type { FormRules } from 'element-plus';

import { useLocationEditForm } from '../composables/useLocationEditForm';
import { FormResult } from '../weather.constants';

import type { ILocationEditFormProps } from './location-edit-form.types';
import { locationEditFormEmits } from './location-edit-form.types';

defineOptions({
	name: 'LocationEditForm',
});

const props = withDefaults(defineProps<ILocationEditFormProps>(), {
	remoteFormSubmit: false,
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
});

const emit = defineEmits(locationEditFormEmits);

const { t } = useI18n();

const { model, formEl, formChanged, submit } = useLocationEditForm({
	id: computed(() => props.location.id),
});

const rules: FormRules = {
	name: [
		{
			required: true,
			message: t('weatherModule.fields.locations.name.validation.required'),
			trigger: 'blur',
		},
	],
};

const onSubmit = async (): Promise<void> => {
	if (!formEl.value) return;

	emit('update:remote-form-result', FormResult.WORKING);

	const valid = await formEl.value.validate().catch(() => false);
	if (!valid) {
		emit('update:remote-form-result', FormResult.NONE);
		return;
	}

	try {
		await submit();
		emit('update:remote-form-result', FormResult.OK);
	} catch {
		emit('update:remote-form-result', FormResult.ERROR);

		setTimeout(() => {
			emit('update:remote-form-result', FormResult.NONE);
		}, 2000);
	}
};

// Watch for remote form submit trigger
watch(
	() => props.remoteFormSubmit,
	(val) => {
		if (val) {
			emit('update:remote-form-submit', false);
			onSubmit();
		}
	}
);

// Watch for remote form reset trigger
watch(
	() => props.remoteFormReset,
	(val) => {
		if (val) {
			emit('update:remote-form-reset', false);
			formEl.value?.resetFields();
		}
	}
);

// Watch for form changes
watch(
	() => formChanged.value,
	(value) => {
		emit('update:remote-form-changed', value);
	}
);
</script>
