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
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';

import { useLocationEditForm } from '../composables/useLocationEditForm';
import type { IWeatherLocation } from '../store/locations.store.types';
import { FormResult, type FormResultType } from '../weather.constants';

defineOptions({
	name: 'LocationEditForm',
});

interface ILocationEditFormProps {
	id: IWeatherLocation['id'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

const props = withDefaults(defineProps<ILocationEditFormProps>(), {
	remoteFormSubmit: false,
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
});

const emit = defineEmits<{
	(e: 'update:remoteFormSubmit', submit: boolean): void;
	(e: 'update:remoteFormResult', result: FormResultType): void;
	(e: 'update:remoteFormReset', reset: boolean): void;
	(e: 'update:remoteFormChanged', changed: boolean): void;
}>();

const { t } = useI18n();

const { model, formEl: composableFormEl, formChanged, submit } = useLocationEditForm({
	id: computed(() => props.id),
});

const formEl = ref<FormInstance | undefined>(composableFormEl.value);

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

	emit('update:remoteFormResult', FormResult.WORKING);

	const valid = await formEl.value.validate().catch(() => false);
	if (!valid) {
		emit('update:remoteFormResult', FormResult.NONE);
		return;
	}

	try {
		await submit();
		emit('update:remoteFormResult', FormResult.OK);
	} catch {
		emit('update:remoteFormResult', FormResult.ERROR);

		setTimeout(() => {
			emit('update:remoteFormResult', FormResult.NONE);
		}, 2000);
	}
};

// Watch for remote form submit trigger
watch(
	() => props.remoteFormSubmit,
	(val) => {
		if (val) {
			emit('update:remoteFormSubmit', false);
			onSubmit();
		}
	}
);

// Watch for remote form reset trigger
watch(
	() => props.remoteFormReset,
	(val) => {
		if (val) {
			emit('update:remoteFormReset', false);
			formEl.value?.resetFields();
		}
	}
);

// Watch for form changes
watch(
	() => formChanged.value,
	(value) => {
		emit('update:remoteFormChanged', value);
	}
);
</script>
