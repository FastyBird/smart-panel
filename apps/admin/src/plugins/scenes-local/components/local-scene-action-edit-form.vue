<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<!-- Empty state when no devices available -->
		<el-alert
			v-if="!loadingDevices && devicesOptions.length === 0"
			type="info"
			:closable="false"
			show-icon
			style="margin-bottom: 16px"
		>
			{{ t('scenesLocalPlugin.messages.noDevices') }}
		</el-alert>

		<el-form-item
			:label="t('scenesLocalPlugin.fields.device.title')"
			prop="deviceId"
		>
			<el-select
				v-model="model.deviceId"
				:placeholder="t('scenesLocalPlugin.fields.device.placeholder')"
				name="deviceId"
				:loading="loadingDevices"
				:disabled="devicesOptions.length === 0"
				filterable
				style="width: 100%"
				@change="onDeviceChange"
			>
				<el-option
					v-for="item in devicesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('scenesLocalPlugin.fields.channel.title')"
			prop="channelId"
		>
			<el-select
				v-model="model.channelId"
				:placeholder="channelsOptions.length === 0 && model.deviceId ? t('scenesLocalPlugin.fields.channel.noChannels') : t('scenesLocalPlugin.fields.channel.placeholder')"
				name="channelId"
				:loading="loadingChannels"
				:disabled="!model.deviceId || channelsOptions.length === 0"
				filterable
				style="width: 100%"
				@change="onChannelChange"
			>
				<el-option
					v-for="item in channelsOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('scenesLocalPlugin.fields.property.title')"
			prop="propertyId"
		>
			<el-select
				v-model="model.propertyId"
				:placeholder="propertiesOptions.length === 0 && model.channelId ? t('scenesLocalPlugin.fields.property.noProperties') : t('scenesLocalPlugin.fields.property.placeholder')"
				name="propertyId"
				:loading="loadingProperties"
				:disabled="!model.channelId || propertiesOptions.length === 0"
				filterable
				style="width: 100%"
				@change="onPropertyChange"
			>
				<el-option
					v-for="item in propertiesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('scenesLocalPlugin.fields.value.title')"
			prop="value"
		>
			<template v-if="selectedPropertyType === 'boolean'">
				<el-switch v-model="booleanValue" />
			</template>
			<template v-else-if="selectedPropertyType === 'enum' && selectedPropertyFormat">
				<el-select
					v-model="model.value"
					:placeholder="t('scenesLocalPlugin.fields.value.placeholder')"
					name="value"
					style="width: 100%"
				>
					<el-option
						v-for="item in enumOptions"
						:key="item"
						:label="item"
						:value="item"
					/>
				</el-select>
			</template>
			<template v-else-if="selectedPropertyType === 'number'">
				<el-input-number
					v-model="numberValue"
					:placeholder="t('scenesLocalPlugin.fields.value.placeholder')"
					name="value"
					:min="numberMin"
					:max="numberMax"
					:step="numberStep"
					style="width: 100%"
				/>
			</template>
			<template v-else>
				<el-input
					v-model="stringValue"
					:placeholder="t('scenesLocalPlugin.fields.value.placeholder')"
					name="value"
				/>
			</template>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch, type FormInstance, type FormRules } from 'element-plus';
import { orderBy } from 'natural-orderby';

import {
	DevicesException,
	type IChannel,
	type IChannelProperty,
	type IDevice,
	useChannels,
	useChannelsProperties,
	useDevices,
} from '../../../modules/devices';
import { DevicesModuleChannelPropertyDataType, DevicesModuleChannelPropertyPermissions } from '../../../openapi.constants';
import type { ISceneActionEditFormProps } from '../../../modules/scenes/components/actions/scene-action-edit-form.types';
import { FormResult, type FormResultType } from '../../../modules/scenes/scenes.constants';
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
	(e: 'submit', data: ILocalSceneActionEditForm): void;
}>();

const { t } = useI18n();

const formEl = ref<FormInstance | undefined>(undefined);
const formResult = ref<FormResultType>(FormResult.NONE);
const formChanged = ref<boolean>(false);

const model = reactive<ILocalSceneActionEditForm>({
	id: props.action.id,
	type: SCENES_LOCAL_TYPE,
	deviceId: props.action.deviceId,
	channelId: props.action.channelId,
	propertyId: props.action.propertyId,
	value: props.action.value,
	enabled: props.action.enabled,
});

const selectedChannelId = computed<string | undefined>(() => model.channelId ?? undefined);
const selectedPropertyId = ref<string | null>(model.propertyId || null);

const { devices, fetchDevices, areLoading: loadingDevices } = useDevices();
const { channels, fetchChannels, areLoading: loadingChannels } = useChannels({
	deviceId: computed<string>((): string => model.deviceId ?? ''),
});
const { properties, fetchProperties, areLoading: loadingProperties } = useChannelsProperties({
	channelId: selectedChannelId,
});

const selectedProperty = computed<IChannelProperty | undefined>(() => {
	if (!model.propertyId) return undefined;
	return properties.value.find((p) => p.id === model.propertyId);
});

const selectedPropertyType = computed<'string' | 'number' | 'boolean' | 'enum'>(() => {
	if (!selectedProperty.value) return 'string';
	const dataType = selectedProperty.value.dataType;
	if (dataType === DevicesModuleChannelPropertyDataType.bool) return 'boolean';
	if (dataType === DevicesModuleChannelPropertyDataType.enum) return 'enum';
	if (
		[
			DevicesModuleChannelPropertyDataType.int,
			DevicesModuleChannelPropertyDataType.uint,
			DevicesModuleChannelPropertyDataType.float,
			DevicesModuleChannelPropertyDataType.char,
			DevicesModuleChannelPropertyDataType.uchar,
			DevicesModuleChannelPropertyDataType.short,
			DevicesModuleChannelPropertyDataType.ushort,
		].includes(dataType)
	) {
		return 'number';
	}
	return 'string';
});

const selectedPropertyFormat = computed<string[] | null>(() => {
	if (!selectedProperty.value) return null;
	const format = selectedProperty.value.format;
	if (!Array.isArray(format)) return null;
	// Filter to only string values for enum options
	const stringValues = format.filter((v): v is string => typeof v === 'string');
	return stringValues.length > 0 ? stringValues : null;
});

const enumOptions = computed<string[]>(() => selectedPropertyFormat.value || []);

// Helper to check if a property is writable
const isPropertyWritable = (property: IChannelProperty): boolean => {
	return property.permissions.includes(DevicesModuleChannelPropertyPermissions.rw) || property.permissions.includes(DevicesModuleChannelPropertyPermissions.wo);
};

// Filter properties to only writable ones
const writableProperties = computed<IChannelProperty[]>(() => {
	return properties.value.filter(isPropertyWritable);
});

const numberMin = computed<number | undefined>(() => {
	if (!selectedProperty.value) return undefined;
	const format = selectedProperty.value.format;
	if (!Array.isArray(format) || format.length < 1) return undefined;
	const min = format[0];
	return typeof min === 'number' ? min : undefined;
});

const numberMax = computed<number | undefined>(() => {
	if (!selectedProperty.value) return undefined;
	const format = selectedProperty.value.format;
	if (!Array.isArray(format) || format.length < 2) return undefined;
	const max = format[1];
	return typeof max === 'number' ? max : undefined;
});

const numberStep = computed<number>(() => {
	if (!selectedProperty.value) return 1;
	// Use step property from the channel property if available
	if (selectedProperty.value.step !== null && selectedProperty.value.step !== undefined) {
		return selectedProperty.value.step;
	}
	return 1;
});

const booleanValue = computed<boolean>({
	get: () => model.value === true || model.value === 'true' || model.value === 1,
	set: (val: boolean) => {
		model.value = val;
		formChanged.value = true;
	},
});

const numberValue = computed<number>({
	get: () => (typeof model.value === 'number' ? model.value : parseFloat(String(model.value)) || 0),
	set: (val: number) => {
		model.value = val;
		formChanged.value = true;
	},
});

const stringValue = computed<string>({
	get: () => String(model.value),
	set: (val: string) => {
		model.value = val;
		formChanged.value = true;
	},
});

const devicesOptions = computed<{ value: IDevice['id']; label: string }[]>(() => {
	const sorted = orderBy<IDevice>(devices.value, [(device: IDevice) => device.name.toLowerCase()], ['asc']);
	return sorted.map((device) => ({
		value: device.id,
		label: device.name,
	}));
});

const channelsOptions = computed<{ value: IChannel['id']; label: string }[]>(() => {
	const sorted = orderBy<IChannel>(channels.value, [(channel: IChannel) => channel.name.toLowerCase()], ['asc']);
	return sorted.map((channel) => ({
		value: channel.id,
		label: channel.name,
	}));
});

const propertiesOptions = computed<{ value: IChannelProperty['id']; label: string }[]>(() => {
	const sorted = orderBy<IChannelProperty>(writableProperties.value, [(prop: IChannelProperty) => (prop.name ?? prop.identifier ?? '').toLowerCase()], ['asc']);
	return sorted.map((prop) => ({
		value: prop.id,
		label: prop.name ?? prop.identifier ?? prop.id,
	}));
});

const rules = reactive<FormRules<ILocalSceneActionEditForm>>({
	deviceId: [{ required: true, message: t('scenesLocalPlugin.fields.device.validation.required'), trigger: 'change' }],
	channelId: [{ required: true, message: t('scenesLocalPlugin.fields.channel.validation.required'), trigger: 'change' }],
	propertyId: [{ required: true, message: t('scenesLocalPlugin.fields.property.validation.required'), trigger: 'change' }],
	value: [{ required: true, message: t('scenesLocalPlugin.fields.value.validation.required'), trigger: 'change' }],
});

const onDeviceChange = async (): Promise<void> => {
	model.channelId = null;
	model.propertyId = '';
	model.value = '';
	formChanged.value = true;

	if (model.deviceId) {
		await fetchChannels();
	}
};

const onChannelChange = async (): Promise<void> => {
	model.propertyId = '';
	model.value = '';
	formChanged.value = true;

	if (model.channelId) {
		await fetchProperties();
	}
};

const onPropertyChange = (): void => {
	model.value = '';
	selectedPropertyId.value = model.propertyId || null;
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

	if (!valid) {
		formResult.value = FormResult.ERROR;
		throw new Error('Form not valid');
	}

	emit('submit', { ...model });
	formResult.value = FormResult.OK;
};

onBeforeMount(async (): Promise<void> => {
	if (!loadingDevices.value) {
		await fetchDevices().catch((error: unknown): void => {
			const err = error as Error;
			throw new DevicesException('Something went wrong', err);
		});
	}

	if (model.deviceId) {
		await fetchChannels();
	}

	if (model.channelId) {
		await fetchProperties();
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
