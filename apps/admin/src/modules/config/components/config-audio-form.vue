<template>
	<el-form
		ref="formEl"
		:model="model"
		:label-position="props.layout === Layout.PHONE ? 'top' : 'right'"
		:label-width="180"
		status-icon
	>
		<el-form-item
			:label="t('configModule.fields.speaker.title')"
			prop="speaker"
		>
			<el-switch
				v-model="model.speaker"
				name="speaker"
				:active-text="t('configModule.fields.speaker.values.enabled').toLowerCase()"
				:inactive-text="t('configModule.fields.speaker.values.disabled').toLowerCase()"
			/>
		</el-form-item>

		<el-form-item
			:label="t('configModule.fields.speakerVolume.title')"
			prop="speakerVolume"
		>
			<el-slider
				v-model="model.speakerVolume"
				:min="0"
				:max="100"
				:step="1"
				name="speakerVolume"
			/>
		</el-form-item>

		<el-form-item
			:label="t('configModule.fields.microphone.title')"
			prop="microphone"
		>
			<el-switch
				v-model="model.microphone"
				name="microphone"
				:active-text="t('configModule.fields.microphone.values.enabled').toLowerCase()"
				:inactive-text="t('configModule.fields.microphone.values.disabled').toLowerCase()"
			/>
		</el-form-item>

		<el-form-item
			:label="t('configModule.fields.microphoneVolume.title')"
			prop="microphoneVolume"
		>
			<el-slider
				v-model="model.microphoneVolume"
				:min="0"
				:max="100"
				:step="1"
				name="microphoneVolume"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElSlider, ElSwitch } from 'element-plus';

import { useConfigAudioEditForm } from '../composables';
import { FormResult, type FormResultType, Layout } from '../config.constants';

import type { IConfigAudioFormProps } from './config-audio-form.types';

defineOptions({
	name: 'ConfigAudioForm',
});

const props = withDefaults(defineProps<IConfigAudioFormProps>(), {
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

const { model, formEl, formChanged, submit, formResult } = useConfigAudioEditForm({ config: props.config });

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
				// Form is not valid
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
