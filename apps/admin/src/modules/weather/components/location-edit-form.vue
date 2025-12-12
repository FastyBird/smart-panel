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

		<div class="flex justify-end gap-2 mt-4">
			<el-button @click="$emit('cancel')">
				{{ t('weatherModule.buttons.cancel.title') }}
			</el-button>
			<el-button
				type="primary"
				native-type="submit"
				:loading="isSubmitting"
				:disabled="!formChanged"
			>
				{{ t('weatherModule.buttons.save.title') }}
			</el-button>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormRules } from 'element-plus';

import { useLocationEditForm } from '../composables/useLocationEditForm';
import type { IWeatherLocation } from '../store/locations.store.types';

defineOptions({
	name: 'LocationEditForm',
});

interface ILocationEditFormProps {
	id: IWeatherLocation['id'];
}

const props = defineProps<ILocationEditFormProps>();

const emit = defineEmits<{
	(e: 'cancel'): void;
	(e: 'updated'): void;
	(e: 'update:remoteFormChanged', value: boolean): void;
}>();

const { t } = useI18n();

const { model, formEl, formChanged, submit } = useLocationEditForm({
	id: computed(() => props.id),
});

const isSubmitting = ref(false);

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
	isSubmitting.value = true;

	try {
		await submit();
		emit('updated');
	} catch {
		// Error handled in composable
	} finally {
		isSubmitting.value = false;
	}
};

watch(
	() => formChanged.value,
	(value) => {
		emit('update:remoteFormChanged', value);
	}
);
</script>
