<template>
	<el-form
		ref="formEl"
		:model="model"
		:label-position="props.layout === Layout.PHONE ? 'top' : 'right'"
		:label-width="180"
		status-icon
	>
		<el-form-item
			:label="t('configModule.fields.darkMode.title')"
			prop="darkMode"
		>
			<el-switch
				v-model="model.darkMode"
				name="darkMode"
				:active-text="t('configModule.fields.darkMode.values.dark').toLowerCase()"
				:inactive-text="t('configModule.fields.darkMode.values.light').toLowerCase()"
			>
				<template #active-action>
					<icon icon="mdi:moon-and-stars" />
				</template>
				<template #inactive-action>
					<icon icon="mdi:weather-sunny" />
				</template>
			</el-switch>
		</el-form-item>

		<el-form-item
			:label="t('configModule.fields.brightness.title')"
			prop="brightness"
		>
			<el-slider
				v-model="model.brightness"
				:min="0"
				:max="100"
				:step="1"
				name="brightness"
			/>
		</el-form-item>

		<el-form-item
			:label="t('configModule.fields.screenLockDuration.title')"
			prop="screenLockDuration"
		>
			<el-select
				v-model="model.screenLockDuration"
				:placeholder="t('configModule.fields.screenLockDuration.placeholder')"
				name="screenLockDuration"
				filterable
				class="md:max-w-50"
			>
				<el-option
					v-for="item in screenLockDurationOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('configModule.fields.screenSaver.title')"
			prop="screenSaver"
		>
			<el-switch
				v-model="model.screenSaver"
				name="screenSaver"
				:active-text="t('configModule.fields.screenSaver.values.enabled').toLowerCase()"
				:inactive-text="t('configModule.fields.screenSaver.values.disabled').toLowerCase()"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElOption, ElSelect, ElSlider, ElSwitch } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useConfigDisplayEditForm } from '../composables/composables';
import { FormResult, type FormResultType, Layout } from '../config.constants';

import type { IConfigDisplayFormProps } from './config-display-form.types';

defineOptions({
	name: 'ConfigDisplayForm',
});

const props = withDefaults(defineProps<IConfigDisplayFormProps>(), {
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

const { screenLockDurationOptions, model, formEl, formChanged, submit, formResult } = useConfigDisplayEditForm({ config: props.config });

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
