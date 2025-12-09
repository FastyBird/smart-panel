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
			<!-- General Settings -->
			<el-divider content-position="left">
				{{ t('displaysModule.form.sections.general') }}
			</el-divider>

			<el-form-item
				:label="t('displaysModule.detail.settings.name')"
				prop="name"
			>
				<el-input
					v-model="form.name"
					:placeholder="t('displaysModule.form.placeholders.name')"
				/>
			</el-form-item>

			<!-- Display Settings -->
			<el-divider content-position="left">
				{{ t('displaysModule.form.sections.display') }}
			</el-divider>

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
				<span class="ml-2 text-gray-500">{{ t('displaysModule.form.units.seconds') }}</span>
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

			<!-- Audio Settings (Speaker) - Only shown if audio output is supported -->
			<template v-if="display.audioOutputSupported">
				<el-divider content-position="left">
					{{ t('displaysModule.form.sections.speaker') }}
				</el-divider>

				<el-form-item
					:label="t('displaysModule.detail.settings.speakerEnabled')"
					prop="speaker"
				>
					<el-switch v-model="form.speaker" />
				</el-form-item>

				<el-form-item
					:label="t('displaysModule.detail.settings.speakerVolume')"
					prop="speakerVolume"
				>
					<el-slider
						v-model="form.speakerVolume"
						:min="0"
						:max="100"
						:disabled="!form.speaker"
						show-input
					/>
				</el-form-item>
			</template>

			<!-- Audio Settings (Microphone) - Only shown if audio input is supported -->
			<template v-if="display.audioInputSupported">
				<el-divider content-position="left">
					{{ t('displaysModule.form.sections.microphone') }}
				</el-divider>

				<el-form-item
					:label="t('displaysModule.detail.settings.microphoneEnabled')"
					prop="microphone"
				>
					<el-switch v-model="form.microphone" />
				</el-form-item>

				<el-form-item
					:label="t('displaysModule.detail.settings.microphoneVolume')"
					prop="microphoneVolume"
				>
					<el-slider
						v-model="form.microphoneVolume"
						:min="0"
						:max="100"
						:disabled="!form.microphone"
						show-input
					/>
				</el-form-item>
			</template>

			<div class="flex justify-end gap-2 mt-6">
				<el-button @click="onCancel">
					{{ t('displaysModule.buttons.cancel.title') }}
				</el-button>
				<el-button
					type="primary"
					:loading="isSaving"
					@click="onSubmit"
				>
					{{ t('displaysModule.buttons.save.title') }}
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

import {
	ElButton,
	ElDivider,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElMessage,
	ElSlider,
	ElSwitch,
	type FormInstance,
	type FormRules,
} from 'element-plus';

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
	// Audio settings
	speaker: false,
	speakerVolume: 50,
	microphone: false,
	microphoneVolume: 50,
});

const rules: FormRules = {
	name: [{ max: 100, message: 'Name must be less than 100 characters', trigger: 'blur' }],
	brightness: [{ type: 'number', min: 0, max: 100, message: 'Brightness must be between 0 and 100', trigger: 'blur' }],
	screenLockDuration: [{ type: 'number', min: 0, message: 'Screen lock duration must be positive', trigger: 'blur' }],
	speakerVolume: [{ type: 'number', min: 0, max: 100, message: 'Volume must be between 0 and 100', trigger: 'blur' }],
	microphoneVolume: [{ type: 'number', min: 0, max: 100, message: 'Volume must be between 0 and 100', trigger: 'blur' }],
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
			// Audio settings
			form.speaker = newDisplay.speaker;
			form.speakerVolume = newDisplay.speakerVolume;
			form.microphone = newDisplay.microphone;
			form.microphoneVolume = newDisplay.microphoneVolume;
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
			const updateData: {
				name: string | null;
				brightness: number;
				screenLockDuration: number;
				darkMode: boolean;
				screenSaver: boolean;
				speaker?: boolean;
				speakerVolume?: number;
				microphone?: boolean;
				microphoneVolume?: number;
			} = {
				name: form.name || null,
				brightness: form.brightness,
				screenLockDuration: form.screenLockDuration,
				darkMode: form.darkMode,
				screenSaver: form.screenSaver,
			};

			// Only include audio settings if the display supports them
			if (display.value?.audioOutputSupported) {
				updateData.speaker = form.speaker;
				updateData.speakerVolume = form.speakerVolume;
			}

			if (display.value?.audioInputSupported) {
				updateData.microphone = form.microphone;
				updateData.microphoneVolume = form.microphoneVolume;
			}

			await displaysStore?.edit({
				id: props.id,
				data: updateData,
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
