<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<device-form-frame
			:model="model"
			:categories-options="categoriesOptions"
			mode="edit"
		>
			<plugin-form-section :title="t('devicesShellyV1Plugin.sections.connection')">
				<el-form-item
					:label="t('devicesShellyV1Plugin.fields.devices.hostname.title')"
					prop="hostname"
				>
					<el-input
						v-model="model.hostname"
						:placeholder="t('devicesShellyV1Plugin.fields.devices.hostname.placeholder')"
						name="hostname"
					/>
				</el-form-item>

				<el-form-item
					:label="t('devicesShellyV1Plugin.fields.devices.password.title')"
					prop="password"
				>
					<!-- The saved password is never shown: Replace reveals an empty field for a new one -->
					<secret-input
						v-model="newPassword"
						:saved-hint="savedPassword ? '' : null"
						:placeholder="t('devicesShellyV1Plugin.fields.devices.password.placeholder')"
						name="password"
					/>
				</el-form-item>
			</plugin-form-section>
		</device-form-frame>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, type FormRules } from 'element-plus';

import { PluginFormSection, SecretInput } from '../../../common';
import { DeviceFormFrame, FormResult, type FormResultType } from '../../../modules/devices';
import { useDeviceEditForm } from '../composables/useDeviceEditForm';
import type { IShellyV1DeviceEditForm } from '../schemas/devices.types';
import type { IShellyV1Device } from '../store/devices.store.types';

import type { IShellyV1DeviceEditFormProps } from './shelly-v1-device-edit-form.types';

defineOptions({
	name: 'ShellyV1DeviceEditForm',
});

const props = withDefaults(defineProps<IShellyV1DeviceEditFormProps>(), {
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

const { categoriesOptions, model, formEl, formChanged, submit, formResult } = useDeviceEditForm({
	device: props.device as IShellyV1Device,
});

const pre = (window.history.state?.prefills ?? null) as { hostname?: string; password?: string } | null;

if (pre) {
	model.hostname = pre.hostname ?? model.hostname;
	model.password = pre.password ?? model.password;

	// Clear immediately so it doesn't linger on further nav
	// (replacing state with a copy without prefills)
	const s = { ...window.history.state };

	delete s.prefills;

	history.replaceState(s, '');
}

// The password the device has now, and a new one while the user replaces it: no new one keeps the saved password,
// an empty one removes it. A password is sent exactly as typed, spaces included
const savedPassword = ref<string | null>(model.password ?? null);
const newPassword = ref<string | undefined>(undefined);

watch(newPassword, (value: string | undefined): void => {
	model.password = value === undefined ? savedPassword.value : value === '' ? null : value;
});

const rules = reactive<FormRules<IShellyV1DeviceEditForm>>({
	name: [{ required: true, message: t('devicesShellyV1Plugin.fields.devices.name.validation.required'), trigger: 'change' }],
	category: [{ required: true, message: t('devicesShellyV1Plugin.fields.devices.category.validation.required'), trigger: 'change' }],
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
			// The replacement goes with the rest of the draft: the field shows the saved password again
			newPassword.value = undefined;

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
