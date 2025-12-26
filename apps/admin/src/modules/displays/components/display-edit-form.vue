<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('displaysModule.fields.displays.id.title')"
			:prop="['id']"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('displaysModule.fields.displays.id.placeholder')"
				name="id"
				readonly
				disabled
			/>
		</el-form-item>

		<el-form-item
			:label="t('displaysModule.fields.displays.name.title')"
			:prop="['name']"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('displaysModule.fields.displays.name.placeholder')"
				name="name"
			/>
		</el-form-item>

		<el-divider />

		<el-form-item
			:label="t('displaysModule.fields.displays.unitSize.title')"
			:prop="['unitSize']"
		>
			<el-input-number
				v-model="model.unitSize"
				:min="1"
				name="unitSize"
			/>
			<span class="ml-2 text-gray-500">{{ t('displaysModule.fields.displays.unitSize.unit') }}</span>
		</el-form-item>

		<el-form-item
			:label="t('displaysModule.fields.displays.rows.title')"
			:prop="['rows']"
		>
			<el-input-number
				v-model="model.rows"
				:min="1"
				name="rows"
			/>
		</el-form-item>

		<el-form-item
			:label="t('displaysModule.fields.displays.cols.title')"
			:prop="['cols']"
		>
			<el-input-number
				v-model="model.cols"
				:min="1"
				name="cols"
			/>
		</el-form-item>

		<el-divider />

		<el-form-item
			:label="t('displaysModule.fields.displays.brightness.title')"
			:prop="['brightness']"
		>
			<el-slider
				v-model="model.brightness"
				:min="0"
				:max="100"
				show-input
			/>
		</el-form-item>

		<el-form-item
			:label="t('displaysModule.fields.displays.screenLockDuration.title')"
			:prop="['screenLockDuration']"
		>
			<el-input-number
				v-model="model.screenLockDuration"
				:min="0"
				:max="3600"
			/>
			<span class="ml-2 text-gray-500">{{ t('displaysModule.fields.displays.screenLockDuration.unit') }}</span>
		</el-form-item>

		<el-form-item
			:label="t('displaysModule.fields.displays.darkMode.title')"
			:prop="['darkMode']"
			label-position="left"
		>
			<el-switch
				v-model="model.darkMode"
				name="darkMode"
			/>
		</el-form-item>

		<el-form-item
			:label="t('displaysModule.fields.displays.screenSaver.title')"
			:prop="['screenSaver']"
			label-position="left"
		>
			<el-switch
				v-model="model.screenSaver"
				name="screenSaver"
			/>
		</el-form-item>

		<!-- Home Page Configuration -->
		<el-divider>{{ t('displaysModule.fields.displays.homeMode.title') }}</el-divider>

		<el-form-item
			:label="t('displaysModule.fields.displays.homeMode.title')"
			:prop="['homeMode']"
		>
			<el-select
				v-model="model.homeMode"
				name="homeMode"
			>
				<el-option
					value="auto_space"
					:label="t('displaysModule.fields.displays.homeMode.options.autoSpace')"
				/>
				<el-option
					value="explicit"
					:label="t('displaysModule.fields.displays.homeMode.options.explicit')"
				/>
				<el-option
					value="first_page"
					:label="t('displaysModule.fields.displays.homeMode.options.firstPage')"
				/>
			</el-select>
			<div class="text-gray-500 text-sm mt-1">
				{{ t('displaysModule.fields.displays.homeMode.description') }}
			</div>
		</el-form-item>

		<el-form-item
			v-if="model.homeMode === 'explicit'"
			:label="t('displaysModule.fields.displays.homePageId.title')"
			:prop="['homePageId']"
		>
			<el-select
				v-model="model.homePageId"
				:placeholder="t('displaysModule.fields.displays.homePageId.placeholder')"
				name="homePageId"
				clearable
			>
				<el-option
					v-for="page in pages"
					:key="page.id"
					:value="page.id"
					:label="page.title"
				/>
			</el-select>
			<div class="text-gray-500 text-sm mt-1">
				{{ t('displaysModule.fields.displays.homePageId.description') }}
			</div>
		</el-form-item>

		<!-- Audio Settings (Speaker) - Only shown if audio output is supported -->
		<template v-if="display.audioOutputSupported">
			<el-divider>{{ t('displaysModule.fields.displays.audio.speaker.title') }}</el-divider>

			<el-form-item
				:label="t('displaysModule.fields.displays.speaker.title')"
				:prop="['speaker']"
				label-position="left"
			>
				<el-switch
					v-model="model.speaker"
					name="speaker"
				/>
			</el-form-item>

			<el-form-item
				:label="t('displaysModule.fields.displays.speakerVolume.title')"
				:prop="['speakerVolume']"
			>
				<el-slider
					v-model="model.speakerVolume"
					:min="0"
					:max="100"
					:disabled="!model.speaker"
					show-input
				/>
			</el-form-item>
		</template>

		<!-- Audio Settings (Microphone) - Only shown if audio input is supported -->
		<template v-if="display.audioInputSupported">
			<el-divider>{{ t('displaysModule.fields.displays.audio.microphone.title') }}</el-divider>

			<el-form-item
				:label="t('displaysModule.fields.displays.microphone.title')"
				:prop="['microphone']"
				label-position="left"
			>
				<el-switch
					v-model="model.microphone"
					name="microphone"
				/>
			</el-form-item>

			<el-form-item
				:label="t('displaysModule.fields.displays.microphoneVolume.title')"
				:prop="['microphoneVolume']"
			>
				<el-slider
					v-model="model.microphoneVolume"
					:min="0"
					:max="100"
					:disabled="!model.microphone"
					show-input
				/>
			</el-form-item>
		</template>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElDivider, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElSlider, ElSwitch, type FormRules } from 'element-plus';

import { injectStoresManager } from '../../../common';
import { pagesStoreKey } from '../../dashboard/store/keys';
import { useDisplayEditForm } from '../composables/useDisplayEditForm';
import { FormResult, type FormResultType } from '../displays.constants';
import type { IDisplayEditForm } from '../composables/types';

import type { IDisplayEditFormProps } from './display-edit-form.types';

defineOptions({
	name: 'DisplayEditForm',
});

const props = withDefaults(defineProps<IDisplayEditFormProps>(), {
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

const storesManager = injectStoresManager();
const pagesStore = storesManager.getStore(pagesStoreKey);

const { model, formEl, formChanged, submit, formResult } = useDisplayEditForm({ display: props.display });

// Get pages for home page selection (exclude drafts to prevent selecting unpublished pages)
const pages = computed(() => pagesStore.findAll().filter((page) => !page.draft));

const rules = reactive<FormRules<IDisplayEditForm>>({
	name: [{ max: 100, message: t('displaysModule.fields.displays.name.validation.maxLength'), trigger: 'blur' }],
	unitSize: [{ type: 'number', min: 1, message: t('displaysModule.fields.displays.unitSize.validation.min'), trigger: 'blur' }],
	rows: [{ type: 'number', min: 1, message: t('displaysModule.fields.displays.rows.validation.min'), trigger: 'blur' }],
	cols: [{ type: 'number', min: 1, message: t('displaysModule.fields.displays.cols.validation.min'), trigger: 'blur' }],
	brightness: [{ type: 'number', min: 0, max: 100, message: t('displaysModule.fields.displays.brightness.validation.range'), trigger: 'blur' }],
	screenLockDuration: [{ type: 'number', min: 0, message: t('displaysModule.fields.displays.screenLockDuration.validation.min'), trigger: 'blur' }],
	speakerVolume: [{ type: 'number', min: 0, max: 100, message: t('displaysModule.fields.displays.speakerVolume.validation.range'), trigger: 'blur' }],
	microphoneVolume: [
		{ type: 'number', min: 0, max: 100, message: t('displaysModule.fields.displays.microphoneVolume.validation.range'), trigger: 'blur' },
	],
});

watch(
	(): FormResultType => formResult.value,
	(val: FormResultType): void => {
		emit('update:remote-form-result', val);
	}
);

watch(
	(): boolean => props.remoteFormSubmit ?? false,
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
	(): boolean => props.remoteFormReset ?? false,
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
