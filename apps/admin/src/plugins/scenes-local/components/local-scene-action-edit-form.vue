<template>
	<!-- Empty state when no devices available -->
	<el-result
		v-if="!loadingDevices && !hasDevices"
		class="h-full w-full"
	>
		<template #icon>
			<icon-with-child :size="80">
				<template #primary>
					<icon icon="mdi:devices" />
				</template>
				<template #secondary>
					<icon icon="mdi:information" />
				</template>
			</icon-with-child>
		</template>

		<template #title>
			{{ t('scenesLocalPlugin.messages.noDevices') }}
		</template>
	</el-result>

	<el-form
		v-else
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<device-property-picker
			v-model:device-id="model.deviceId"
			v-model:channel-id="model.channelId"
			v-model:property-id="model.propertyId"
			:property-filter="isPropertyWritable"
			:texts="pickerTexts"
			@change="onPickerChange"
		/>

		<el-alert
			v-if="groupControls.isGroup.value"
			:title="t('devicesVirtualPlugin.lightGroup.commonOnly')"
			:description="groupControls.diagnostics.value.join('; ')"
			type="info"
			:closable="false"
		/>
		<el-form-item
			:label="t('scenesLocalPlugin.fields.value.title')"
			prop="value"
		>
			<property-value-input
				:model-value="model.value"
				:property="selectedProperty"
				:option-filter="isValueAllowed"
				:placeholder="t('scenesLocalPlugin.fields.value.placeholder')"
				@update:model-value="onValueUpdate"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElResult, type FormInstance, type FormRules } from 'element-plus';

import { Icon } from '@iconify/vue';

import { IconWithChild } from '../../../common';
import {
	DevicePropertyPicker,
	DevicesException,
	type IChannelProperty,
	type IDevicePropertyPickerField,
	type IDevicePropertyPickerTexts,
	PropertyValueInput,
	useChannels,
	useChannelsProperties,
	useDevices,
} from '../../../modules/devices';
import type { ISceneActionEditFormProps } from '../../../modules/scenes/components/actions/scene-action-edit-form.types';
import { FormResult, type FormResultType } from '../../../modules/scenes/scenes.constants';
import type { ISceneActionEditForm } from '../../../modules/scenes/schemas/scenes.types';
import { DevicesModuleChannelPropertyDataType } from '../../../openapi.constants';
import { useGroupSceneControls } from '../../devices-virtual/composables/useGroupSceneControls';
import { SCENES_LOCAL_TYPE } from '../scenes-local.constants';
import type { ILocalSceneActionEditForm } from '../schemas/actions.types';

defineOptions({
	name: 'LocalSceneActionEditForm',
});

const props = withDefaults(defineProps<ISceneActionEditFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
	(e: 'submit', data: ISceneActionEditForm & { type: string }): void;
}>();

const { t } = useI18n();

const formEl = ref<FormInstance | undefined>(undefined);
const formResult = ref<FormResultType>(FormResult.NONE);
const formChanged = ref<boolean>(false);

// Read values from root level (camelCase) with fallback to configuration (snake_case) for backwards compatibility
const model = reactive<ILocalSceneActionEditForm>({
	id: props.action.id,
	type: SCENES_LOCAL_TYPE,
	deviceId: (props.action.deviceId as string | undefined) ?? (props.action.configuration?.device_id as string) ?? '',
	channelId: (props.action.channelId as string | undefined) ?? (props.action.configuration?.channel_id as string | null) ?? null,
	propertyId: (props.action.propertyId as string | undefined) ?? (props.action.configuration?.property_id as string) ?? '',
	value: (props.action.value as string | number | boolean | undefined) ?? (props.action.configuration?.value as string | number | boolean) ?? '',
	enabled: props.action.enabled,
});

const selectedChannelId = computed<string | undefined>(() => model.channelId ?? undefined);

// The picker loads the channels and properties; the form only reads them from the stores
const { devices, fetchDevices, areLoading: loadingDevices, loaded: devicesLoaded } = useDevices();
const { channels } = useChannels({
	deviceId: computed<string>((): string => model.deviceId ?? ''),
});
const { properties } = useChannelsProperties({
	channelId: selectedChannelId,
});

// Hidden devices are never offered by the picker — the backend refuses a scene action targeting one
const hasDevices = computed<boolean>(() => devices.value.some((device) => !device.hidden));

const groupControls = useGroupSceneControls(
	computed(() => devices.value.find((device) => device.id === model.deviceId)),
	channels
);
// Only writable properties are offered
const isPropertyWritable = (property: IChannelProperty): boolean => groupControls.allowed(property);

const selectedProperty = computed<IChannelProperty | undefined>(() => {
	if (!model.propertyId) return undefined;
	return properties.value.find((p) => p.id === model.propertyId);
});

const isValueAllowed = (value: string): boolean => !selectedProperty.value || groupControls.allowed(selectedProperty.value, value);

const pickerTexts = computed<Partial<IDevicePropertyPickerTexts>>(() => ({
	deviceTitle: t('scenesLocalPlugin.fields.device.title'),
	devicePlaceholder: t('scenesLocalPlugin.fields.device.placeholder'),
	channelTitle: t('scenesLocalPlugin.fields.channel.title'),
	channelPlaceholder: t('scenesLocalPlugin.fields.channel.placeholder'),
	channelEmpty: t('scenesLocalPlugin.fields.channel.noChannels'),
	propertyTitle: t('scenesLocalPlugin.fields.property.title'),
	propertyPlaceholder: t('scenesLocalPlugin.fields.property.placeholder'),
	propertyEmpty: t('scenesLocalPlugin.fields.property.noProperties'),
}));

const rules = reactive<FormRules<ILocalSceneActionEditForm>>({
	deviceId: [{ required: true, message: t('scenesLocalPlugin.fields.device.validation.required'), trigger: 'change' }],
	channelId: [{ required: true, message: t('scenesLocalPlugin.fields.channel.validation.required'), trigger: 'change' }],
	propertyId: [{ required: true, message: t('scenesLocalPlugin.fields.property.validation.required'), trigger: 'change' }],
	value: [{ required: true, message: t('scenesLocalPlugin.fields.value.validation.required'), trigger: 'change' }],
});

const onPickerChange = (field: IDevicePropertyPickerField): void => {
	// Set default value based on property type
	if (field === 'property' && selectedProperty.value?.dataType === DevicesModuleChannelPropertyDataType.bool) {
		model.value = false;
	} else {
		model.value = '';
	}
	formChanged.value = true;
};

const onValueUpdate = (value: string | number | boolean): void => {
	model.value = value;
	formChanged.value = true;
};

const submit = async (): Promise<void> => {
	formResult.value = FormResult.WORKING;

	if (!formEl.value) {
		formResult.value = FormResult.ERROR;
		return;
	}

	formEl.value.clearValidate();

	const valid = await formEl.value.validate().catch(() => false);

	if (!valid || (selectedProperty.value && !groupControls.allowed(selectedProperty.value, model.value))) {
		formResult.value = FormResult.ERROR;
		throw new Error('Form not valid');
	}

	// Emit with plugin-specific fields at root level (using camelCase for form model)
	emit('submit', {
		id: model.id,
		type: model.type,
		configuration: {},
		deviceId: model.deviceId,
		channelId: model.channelId,
		propertyId: model.propertyId,
		value: model.value,
		order: model.order,
		enabled: model.enabled,
	});
	formResult.value = FormResult.OK;
};

// The picker is not rendered in the empty state, so the devices are loaded here
onBeforeMount(async (): Promise<void> => {
	if (!devicesLoaded.value) {
		await fetchDevices().catch((error: unknown): void => {
			throw new DevicesException('Something went wrong', error as Error);
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
