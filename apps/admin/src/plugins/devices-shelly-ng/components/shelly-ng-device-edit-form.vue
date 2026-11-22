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
			<plugin-form-section :title="t('devicesShellyNgPlugin.sections.connection')">
				<el-form-item
					v-if="hasEthernet"
					:label="t('devicesShellyNgPlugin.fields.devices.ethernetAddress.title')"
					prop="ethernetAddress"
				>
					<el-input
						v-model="model.ethernetAddress"
						:placeholder="t('devicesShellyNgPlugin.fields.devices.ethernetAddress.placeholder')"
						name="ethernetAddress"
					/>
				</el-form-item>

				<el-form-item
					:label="t('devicesShellyNgPlugin.fields.devices.wifiAddress.title')"
					prop="wifiAddress"
				>
					<el-input
						v-model="model.wifiAddress"
						:placeholder="t('devicesShellyNgPlugin.fields.devices.wifiAddress.placeholder')"
						name="wifiAddress"
					/>
				</el-form-item>

				<el-form-item
					:label="t('devicesShellyNgPlugin.fields.devices.password.title')"
					prop="password"
				>
					<!-- The saved password is never shown: Replace reveals an empty field for a new one -->
					<secret-input
						v-model="newPassword"
						:saved-hint="savedPassword ? '' : null"
						:placeholder="t('devicesShellyNgPlugin.fields.devices.password.placeholder')"
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
import type { IShellyNgDeviceEditForm } from '../schemas/devices.types';
import type { IShellyNgDevice } from '../store/devices.store.types';

import type { IShellyNgDeviceEditFormProps } from './shelly-ng-device-edit-form.types';

defineOptions({
	name: 'ShellyNgDeviceEditForm',
});

const props = withDefaults(defineProps<IShellyNgDeviceEditFormProps>(), {
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

const { categoriesOptions, hasEthernet, model, formEl, formChanged, submit, formResult } = useDeviceEditForm({
	device: props.device as IShellyNgDevice,
});

// Restore prefills from add-form navigation (device already exists → redirect to edit)
const pre = (window.history.state?.prefills ?? null) as { hostname?: string; password?: string } | null;

if (pre) {
	// The add form probed via hostname — use it as the wifi address if not already set
	if (pre.hostname && !model.wifiAddress) {
		model.wifiAddress = pre.hostname;
	}

	if (pre.password) {
		model.password = pre.password;
	}

	// Clear immediately so it doesn't linger on further nav
	const s = { ...window.history.state };

	delete s.prefills;

	history.replaceState(s, '');
}

// The password the device has now, and a new one while the user replaces it: no new one keeps the saved password,
// an empty one removes it
const savedPassword = ref<string | null>(model.password ?? null);
const newPassword = ref<string | undefined>(undefined);

watch(newPassword, (value: string | undefined): void => {
	model.password = value === undefined ? savedPassword.value : value.trim() || null;
});

const rules = reactive<FormRules<IShellyNgDeviceEditForm>>({
	name: [{ required: true, message: t('devicesShellyNgPlugin.fields.devices.name.validation.required'), trigger: 'change' }],
	category: [{ required: true, message: t('devicesShellyNgPlugin.fields.devices.category.validation.required'), trigger: 'change' }],
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
