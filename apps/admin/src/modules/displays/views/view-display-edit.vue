<template>
	<div class="p-4">
		<h3 class="text-lg font-semibold mb-4">
			{{ t('displaysModule.form.edit.title') }}
		</h3>

		<el-form
			v-if="display"
			ref="formRef"
			:model="form"
			:rules="rules"
			label-position="top"
			@submit.prevent="onSubmit"
		>
			<el-form-item
				:label="t('displaysModule.detail.settings.name')"
				prop="name"
			>
				<el-input
					v-model="form.name"
					placeholder="Display name"
				/>
			</el-form-item>

			<el-form-item
				:label="t('displaysModule.detail.settings.brightness')"
				prop="brightness"
			>
				<el-slider
					v-model="form.brightness"
					:min="0"
					:max="100"
					show-input
				/>
			</el-form-item>

			<el-form-item
				:label="t('displaysModule.detail.settings.screenLockDuration')"
				prop="screenLockDuration"
			>
				<el-input-number
					v-model="form.screenLockDuration"
					:min="0"
					:max="3600"
				/>
				<span class="ml-2 text-gray-500">seconds</span>
			</el-form-item>

			<el-form-item
				:label="t('displaysModule.detail.settings.darkMode')"
				prop="darkMode"
			>
				<el-switch v-model="form.darkMode" />
			</el-form-item>

			<el-form-item
				:label="t('displaysModule.detail.settings.screenSaver')"
				prop="screenSaver"
			>
				<el-switch v-model="form.screenSaver" />
			</el-form-item>

			<div class="flex justify-end gap-2 mt-6">
				<el-button @click="onCancel">
					Cancel
				</el-button>
				<el-button
					type="primary"
					:loading="isSaving"
					@click="onSubmit"
				>
					Save
				</el-button>
			</div>
		</el-form>

		<div
			v-else-if="!isLoading"
			class="text-center py-8 text-gray-500"
		>
			{{ t('displaysModule.messages.notFound') }}
		</div>

		<div
			v-else
			v-loading="true"
			class="min-h-[200px]"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElForm, ElFormItem, ElInput, ElInputNumber, ElMessage, ElSlider, ElSwitch, type FormInstance, type FormRules } from 'element-plus';

import { useDisplay } from '../composables/composables';
import { RouteNames } from '../displays.constants';
import { displaysStoreKey } from '../store/keys';

import type { IViewDisplayEditProps } from './view-display-edit.types';

defineOptions({
	name: 'ViewDisplayEdit',
});

const props = defineProps<IViewDisplayEditProps>();

const router = useRouter();
const { t } = useI18n();

const displaysStore = inject(displaysStoreKey);

const displayId = computed(() => props.id);
const { display, isLoading } = useDisplay(displayId);

const formRef = ref<FormInstance>();
const isSaving = ref(false);

const form = reactive({
	name: '',
	brightness: 100,
	screenLockDuration: 30,
	darkMode: false,
	screenSaver: true,
});

const rules: FormRules = {
	name: [{ max: 100, message: 'Name must be less than 100 characters', trigger: 'blur' }],
	brightness: [{ type: 'number', min: 0, max: 100, message: 'Brightness must be between 0 and 100', trigger: 'blur' }],
	screenLockDuration: [{ type: 'number', min: 0, message: 'Screen lock duration must be positive', trigger: 'blur' }],
};

// Watch for display changes and update form
watch(
	() => display.value,
	(newDisplay) => {
		if (newDisplay) {
			form.name = newDisplay.name || '';
			form.brightness = newDisplay.brightness;
			form.screenLockDuration = newDisplay.screenLockDuration;
			form.darkMode = newDisplay.darkMode;
			form.screenSaver = newDisplay.screenSaver;
		}
	},
	{ immediate: true }
);

const onCancel = (): void => {
	router.back();
};

const onSubmit = async (): Promise<void> => {
	if (!formRef.value) return;

	await formRef.value.validate(async (valid) => {
		if (!valid) return;

		isSaving.value = true;

		try {
			await displaysStore?.edit({
				id: props.id,
				data: {
					name: form.name || null,
					brightness: form.brightness,
					screenLockDuration: form.screenLockDuration,
					darkMode: form.darkMode,
					screenSaver: form.screenSaver,
				},
			});

			ElMessage.success(t('displaysModule.messages.updateSuccess'));

			router.push({
				name: RouteNames.DISPLAY,
				params: { id: props.id },
			});
		} catch {
			ElMessage.error(t('displaysModule.messages.updateError'));
		} finally {
			isSaving.value = false;
		}
	});
};
</script>
