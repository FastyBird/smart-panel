<template>
	<el-collapse
		v-model="activeStep"
		accordion
		expand-icon-position="left"
	>
		<el-collapse-item
			:title="t('devicesShellyNgPlugin.headings.device.deviceConnection')"
			name="one"
		>
			<template #icon>
				<el-icon :size="20">
					<icon icon="mdi:connection" />
				</el-icon>
			</template>

			<el-form
				ref="stepOneFormEl"
				:model="model"
				:rules="stepOneFormElRules"
				label-position="top"
				status-icon
			>
				<el-form-item
					:label="t('devicesShellyNgPlugin.fields.devices.hostname.title')"
					prop="hostname"
				>
					<el-input
						v-model="model.hostname"
						:placeholder="t('devicesShellyNgPlugin.fields.devices.hostname.placeholder')"
						name="hostname"
					/>
				</el-form-item>

				<el-form-item
					:label="t('devicesShellyNgPlugin.fields.devices.password.title')"
					prop="password"
					class="mb-0!"
				>
					<el-input
						v-model="model.password"
						:placeholder="t('devicesShellyNgPlugin.fields.devices.password.placeholder')"
						name="password"
					/>
				</el-form-item>
			</el-form>
		</el-collapse-item>

		<el-collapse-item
			:title="t('devicesShellyNgPlugin.headings.device.information')"
			name="two"
			:disabled="deviceInfo === null"
		>
			<template #icon>
				<el-icon :size="20">
					<icon icon="mdi:devices" />
				</el-icon>
			</template>

			<el-alert
				:type="deviceGroup ? 'success' : 'error'"
				:title="deviceGroup ? t('devicesShellyNgPlugin.headings.device.supported') : t('devicesShellyNgPlugin.headings.device.notSupported')"
				:closable="false"
				show-icon
			>
				<dl class="grid grid-cols-[auto_1fr] gap-x-4 my-0">
					<dt>{{ t('devicesShellyNgPlugin.headings.device.model') }}:</dt>
					<dd class="m-0 inline-block font-bold">
						{{ deviceGroup !== null ? deviceGroup.name : 'unknown' }}
					</dd>
					<dt>{{ t('devicesShellyNgPlugin.headings.device.firmware') }}:</dt>
					<dd class="m-0 inline-block font-bold">
						{{ deviceInfo?.firmware }}
					</dd>
				</dl>
			</el-alert>

			<el-form
				ref="stepTwoFormEl"
				:model="model"
				:rules="stepTwoFormElRules"
				label-position="top"
				status-icon
				class="mt-4"
			>
				<el-form-item
					:label="t('devicesShellyNgPlugin.fields.devices.name.title')"
					prop="name"
				>
					<el-input
						v-model="model.name"
						:placeholder="t('devicesShellyNgPlugin.fields.devices.name.placeholder')"
						name="name"
					/>
				</el-form-item>

				<el-divider />

				<el-form-item
					:label="t('devicesShellyNgPlugin.fields.devices.category.title')"
					prop="category"
				>
					<el-select
						v-model="model.category"
						:placeholder="t('devicesShellyNgPlugin.fields.devices.category.placeholder')"
						name="category"
						filterable
					>
						<el-option
							v-for="item in categoriesOptions"
							:key="item.value"
							:label="item.label"
							:value="item.value"
						/>
					</el-select>
				</el-form-item>

				<el-alert
					v-if="model.category"
					type="info"
					:title="t('devicesModule.fields.devices.category.description')"
					:description="t(`devicesModule.texts.devices.description.${model.category}`)"
					:closable="false"
					show-icon
				/>

				<el-divider />

				<el-form-item
					:label="t('devicesShellyNgPlugin.fields.devices.description.title')"
					prop="description"
				>
					<el-input
						v-model="model.description"
						:placeholder="t('devicesShellyNgPlugin.fields.devices.description.placeholder')"
						:rows="4"
						type="textarea"
						name="description"
					/>
				</el-form-item>

				<el-form-item
					:label="t('devicesShellyNgPlugin.fields.devices.enabled.title')"
					prop="enabled"
					label-position="left"
				>
					<el-switch
						v-model="model.enabled"
						name="enabled"
					/>
				</el-form-item>
			</el-form>
		</el-collapse-item>
	</el-collapse>

	<teleport
		v-if="activeStep === 'one'"
		defer
		:to="`#${SUBMIT_FORM_SM}`"
	>
		<el-button
			:loading="formResult === FormResult.WORKING"
			:disabled="formResult !== FormResult.NONE"
			type="primary"
			@click="onProcessStep"
		>
			<template
				v-if="formResult === FormResult.ERROR"
				#icon
			>
				<icon icon="mdi:cross-circle" />
			</template>
			{{ t('devicesShellyNgPlugin.buttons.next.title') }}
		</el-button>
	</teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCollapse,
	ElCollapseItem,
	ElDivider,
	ElForm,
	ElFormItem,
	ElIcon,
	ElInput,
	ElOption,
	ElSelect,
	ElSwitch,
	type FormRules,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import { SUBMIT_FORM_SM, router, useFlashMessage } from '../../../common';
import { RouteNames as DevicesRouteNames, FormResult, type FormResultType, useDevices } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { useDeviceAddForm } from '../composables/useDeviceAddForm';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
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

const { devices, loaded: devicesLoaded, fetchDevices } = useDevices();

const { model, stepOneFormEl, stepTwoFormEl, activeStep, categoriesOptions, supportedDevices, formChanged, deviceInfo, submitStep, formResult } =
	useDeviceAddForm({
		id: props.id,
	});

const deviceGroup = computed<IShellyNgSupportedDevice | null>((): IShellyNgSupportedDevice | null => {
	if (deviceInfo.value === null) {
		return null;
	}

	return supportedDevices.value.find((group) => group.models.includes(deviceInfo.value!.model.toUpperCase())) || null;
});

const stepOneFormElRules = reactive<FormRules<IShellyNgDeviceAddForm>>({
	hostname: [{ required: true, message: t('devicesShellyNgPlugin.fields.devices.hostname.validation.required'), trigger: 'change' }],
});

const stepTwoFormElRules = reactive<FormRules<IShellyNgDeviceAddForm>>({
	name: [{ required: true, message: t('devicesShellyNgPlugin.fields.devices.name.validation.required'), trigger: 'change' }],
	category: [{ required: true, message: t('devicesShellyNgPlugin.fields.devices.category.validation.required'), trigger: 'change' }],
	hostname: [{ required: true, message: t('devicesShellyNgPlugin.fields.devices.hostname.validation.required'), trigger: 'change' }],
});

const onProcessStep = async (): Promise<void> => {
	if (activeStep.value === 'one') {
		submitStep('one').catch(() => {
			// The form is not valid
		});
	} else if (activeStep.value === 'two') {
		submitStep('two').catch(() => {
			// The form is not valid
		});
	}
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

			if (activeStep.value === 'one') {
				submitStep('one').catch(() => {
					// The form is not valid
				});
			} else if (activeStep.value === 'two') {
				submitStep('two').catch(() => {
					// The form is not valid
				});
			}
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remote-form-reset', false);

		if (val) {
			stepOneFormEl.value?.resetFields();
			stepTwoFormEl.value?.resetFields();
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
		if (val.length > 0 && val[0]) {
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

		model.name = val.name || model.name;

		const device = devices.value.find((d) => d.identifier === val.id && d.type === DEVICES_SHELLY_NG_TYPE);

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
