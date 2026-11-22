<template>
	<!-- One form (spec section 7): General first, the connection with its test, no steps. Save tests the device first
	     when it was not tested -->
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
			mode="add"
			:show-id="false"
		>
			<plugin-form-section :title="t('devicesShellyNgPlugin.sections.connection')">
				<el-form-item
					:label="t('devicesShellyNgPlugin.fields.devices.hostname.title')"
					prop="hostname"
				>
					<el-input
						v-model="model.hostname"
						:placeholder="t('devicesShellyNgPlugin.fields.devices.hostname.placeholder')"
						inputmode="url"
						autocapitalize="off"
						autocorrect="off"
						name="hostname"
					/>
				</el-form-item>

				<el-form-item
					:label="t('devicesShellyNgPlugin.fields.devices.password.title')"
					prop="password"
				>
					<el-input
						v-model="model.password"
						:placeholder="t('devicesShellyNgPlugin.fields.devices.password.placeholder')"
						type="password"
						show-password
						autocomplete="new-password"
						name="password"
					/>
				</el-form-item>

				<!-- A result belongs to the hostname and password it was read with: changing either starts a fresh test -->
				<test-connection
					:key="`${model.hostname}\u0000${model.password ?? ''}`"
					:run="onTestConnection"
				/>
			</plugin-form-section>
		</device-form-frame>
	</el-form>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, type FormRules } from 'element-plus';

import { PluginFormSection, TestConnection, type TestConnectionResult, router, useFlashMessage } from '../../../common';
import { DeviceFormFrame, RouteNames as DevicesRouteNames, FormResult, type FormResultType, useDevices } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { useDeviceAddForm } from '../composables/useDeviceAddForm';
import type { IShellyNgDeviceAddForm, IShellyNgDeviceInfo, IShellyNgSupportedDevice } from '../schemas/devices.types';

import type { IShellyNgDeviceAddFormProps } from './shelly-ng-device-add-form.types';

defineOptions({
	name: 'ShellyNgDeviceAddForm',
});

const props = withDefaults(defineProps<IShellyNgDeviceAddFormProps>(), {
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

const flashMessage = useFlashMessage();

const { loaded: devicesLoaded, fetchDevices } = useDevices();

const {
	model,
	formEl,
	categoriesOptions,
	supportedDevices,
	supportedDevicesLoaded,
	loadSupportedDevices,
	findRegistered,
	formChanged,
	deviceInfo,
	checkDevice,
	submit,
	formResult,
} = useDeviceAddForm({
	id: props.id,
});

const deviceGroup = computed<IShellyNgSupportedDevice | null>((): IShellyNgSupportedDevice | null => {
	if (deviceInfo.value === null) {
		return null;
	}

	return supportedDevices.value.find((group) => group.models.includes(deviceInfo.value!.model.toUpperCase())) || null;
});

const rules = reactive<FormRules<IShellyNgDeviceAddForm>>({
	name: [{ required: true, message: t('devicesShellyNgPlugin.fields.devices.name.validation.required'), trigger: 'change' }],
	category: [{ required: true, message: t('devicesShellyNgPlugin.fields.devices.category.validation.required'), trigger: 'change' }],
	hostname: [{ required: true, message: t('devicesShellyNgPlugin.fields.devices.hostname.validation.required'), trigger: 'change' }],
});

// Test connection: the result names the model and firmware, or why the device could not be read
const onTestConnection = async (): Promise<TestConnectionResult> => {
	try {
		await checkDevice();
	} catch (error: unknown) {
		return { ok: false, message: error instanceof Error ? error.message : t('devicesShellyNgPlugin.fields.devices.hostname.validation.required') };
	}

	// Not supported is a fact about the device only once the list of supported devices is here
	if (!supportedDevicesLoaded.value) {
		await loadSupportedDevices().catch((): void => {
			// Reported below
		});
	}

	if (!supportedDevicesLoaded.value) {
		return { ok: false, message: t('devicesShellyNgPlugin.messages.devices.failedLoadSupportedDevices') };
	}

	if (deviceGroup.value === null) {
		return { ok: false, message: t('devicesShellyNgPlugin.headings.device.notSupported') };
	}

	return {
		ok: true,
		message: `${deviceGroup.value.name} · ${t('devicesShellyNgPlugin.headings.device.firmware')} ${deviceInfo.value?.firmware ?? ''}`.trim(),
	};
};

onMounted((): void => {
	if (!devicesLoaded.value) {
		fetchDevices().catch(() => {
			// Could be ignored
		});
	}
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
				// The form is not valid, or the device could not be read or added
			});
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remote-form-reset', false);

		if (val) {
			formEl.value?.resetFields();
		}
	}
);

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);

watch(
	(): { value: DevicesModuleDeviceCategory; label: string }[] => categoriesOptions.value,
	(val: { value: DevicesModuleDeviceCategory; label: string }[]): void => {
		// A repeated test rebuilds the options: a category that is still offered stays chosen
		if (val.length > 0 && val[0] && !val.some((option) => option.value === model.category)) {
			model.category = val[0].value;
		}
	}
);

watch(
	(): IShellyNgDeviceInfo | null => deviceInfo.value,
	(val: IShellyNgDeviceInfo | null): void => {
		if (val === null) {
			return;
		}

		// The device's own name fills an empty field only: a name the user entered stays
		if (!model.name?.trim() && val.name) {
			model.name = val.name;
		}

		// Hidden devices too: Save stops for the same ones (findRegistered)
		const device = findRegistered(val);

		if (typeof device !== 'undefined') {
			flashMessage.success(
				t('devicesShellyNgPlugin.messages.devices.exists', {
					device: device.name,
				})
			);

			router.push({
				name: DevicesRouteNames.DEVICES_EDIT,
				params: {
					id: device.id,
				},
				state: {
					prefills: { hostname: model.hostname, password: model.password },
				},
			});
		}
	}
);
</script>
