<template>
	<el-form-item
		:class="[ns.e('device'), { [ns.em('device', 'custom-label')]: !!slots['device-label'] }]"
		:prop="deviceProp"
	>
		<template #label>
			<slot name="device-label">
				{{ pickerTexts.deviceTitle }}
			</slot>
		</template>

		<el-select
			:model-value="deviceId"
			:placeholder="pickerTexts.devicePlaceholder"
			:name="deviceProp"
			:loading="loadingDevices"
			:disabled="devicesOptions.length === 0"
			filterable
			class="w-full"
			@update:model-value="onDeviceUpdate"
			@change="onDeviceChange"
		>
			<template v-if="!showAllDevices && hasRecommendedCategories && recommendedDevicesOptions.length > 0">
				<el-option
					v-for="item in recommendedDevicesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</template>

			<template v-else-if="hasRecommendedCategories">
				<el-option-group
					v-if="recommendedDevicesOptions.length > 0"
					:label="pickerTexts.deviceGroupRecommended"
				>
					<el-option
						v-for="item in recommendedDevicesOptions"
						:key="item.value"
						:label="item.label"
						:value="item.value"
					/>
				</el-option-group>
				<el-option-group
					v-if="otherDevicesOptions.length > 0"
					:label="pickerTexts.deviceGroupOther"
				>
					<el-option
						v-for="item in otherDevicesOptions"
						:key="item.value"
						:label="item.label"
						:value="item.value"
					/>
				</el-option-group>
			</template>
			<template v-else>
				<el-option
					v-for="item in devicesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</template>
		</el-select>
	</el-form-item>

	<el-form-item
		:label="pickerTexts.channelTitle"
		:prop="channelProp"
	>
		<el-select
			:model-value="channelId"
			:placeholder="channelsOptions.length === 0 && deviceId && !loadingChannels ? pickerTexts.channelEmpty : pickerTexts.channelPlaceholder"
			:name="channelProp"
			:loading="loadingChannels"
			:disabled="!deviceId || channelsOptions.length === 0"
			filterable
			class="w-full"
			@update:model-value="onChannelUpdate"
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
		:label="pickerTexts.propertyTitle"
		:prop="propertyProp"
	>
		<el-select
			:model-value="propertyId"
			:placeholder="propertiesOptions.length === 0 && channelId && !loadingProperties ? pickerTexts.propertyEmpty : pickerTexts.propertyPlaceholder"
			:name="propertyProp"
			:loading="loadingProperties"
			:disabled="!channelId || propertiesOptions.length === 0"
			filterable
			class="w-full"
			@update:model-value="onPropertyUpdate"
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
</template>

<script setup lang="ts">
import { computed, onBeforeMount, useSlots, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElFormItem, ElOption, ElOptionGroup, ElSelect, useNamespace } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { DevicesModuleChannelPropertyPermissions } from '../../../../openapi.constants';
import { useChannels, useChannelsProperties, useDevices } from '../../composables/composables';
import { DevicesException } from '../../devices.exceptions';
import type { IChannelProperty } from '../../store/channels.properties.store.types';
import type { IChannel } from '../../store/channels.store.types';
import type { IDevice } from '../../store/devices.store.types';

import type { IDevicePropertyPickerField, IDevicePropertyPickerProps, IDevicePropertyPickerTexts } from './device-property-picker.types';

defineOptions({
	name: 'DevicePropertyPicker',
});

const props = withDefaults(defineProps<IDevicePropertyPickerProps>(), {
	access: undefined,
	dataTypes: undefined,
	propertyFilter: undefined,
	recommendedCategories: null,
	showAllDevices: false,
	deviceProp: 'deviceId',
	channelProp: 'channelId',
	propertyProp: 'propertyId',
	texts: undefined,
});

const emit = defineEmits<{
	(e: 'update:deviceId', deviceId: IDevice['id']): void;
	(e: 'update:channelId', channelId: IChannel['id'] | null): void;
	(e: 'update:propertyId', propertyId: IChannelProperty['id'] | null): void;
	(e: 'change', field: IDevicePropertyPickerField): void;
}>();

const slots = useSlots();

const ns = useNamespace('device-property-picker');

const { t } = useI18n();

const { devices, fetchDevices, areLoading: loadingDevices, loaded: devicesLoaded } = useDevices();
const {
	channels,
	fetchChannels,
	areLoading: loadingChannels,
} = useChannels({
	deviceId: computed<IDevice['id']>((): IDevice['id'] => props.deviceId ?? ''),
});
const {
	properties,
	fetchProperties,
	areLoading: loadingProperties,
} = useChannelsProperties({
	channelId: computed<IChannel['id'] | undefined>((): IChannel['id'] | undefined => props.channelId || undefined),
});

const pickerTexts = computed<IDevicePropertyPickerTexts>(
	(): IDevicePropertyPickerTexts => ({
		deviceTitle: t('devicesModule.fields.propertyPicker.device.title'),
		devicePlaceholder: t('devicesModule.fields.propertyPicker.device.placeholder'),
		deviceGroupRecommended: t('devicesModule.fields.propertyPicker.device.groups.recommended'),
		deviceGroupOther: t('devicesModule.fields.propertyPicker.device.groups.other'),
		channelTitle: t('devicesModule.fields.propertyPicker.channel.title'),
		channelPlaceholder: t('devicesModule.fields.propertyPicker.channel.placeholder'),
		channelEmpty: t('devicesModule.fields.propertyPicker.channel.empty'),
		propertyTitle: t('devicesModule.fields.propertyPicker.property.title'),
		propertyPlaceholder: t('devicesModule.fields.propertyPicker.property.placeholder'),
		propertyEmpty: t('devicesModule.fields.propertyPicker.property.empty'),
		...props.texts,
	})
);

const hasRecommendedCategories = computed<boolean>((): boolean => {
	return props.recommendedCategories !== null && props.recommendedCategories.length > 0;
});

const hasPropertyFilter = computed<boolean>((): boolean => {
	return props.access !== undefined || (props.dataTypes?.length ?? 0) > 0 || props.propertyFilter !== undefined;
});

const isPropertyOffered = (property: IChannelProperty): boolean => {
	if (
		props.access === 'readable' &&
		!property.permissions.some(
			(permission) => permission === DevicesModuleChannelPropertyPermissions.ro || permission === DevicesModuleChannelPropertyPermissions.rw
		)
	) {
		return false;
	}

	if (
		props.access === 'writable' &&
		!property.permissions.some(
			(permission) => permission === DevicesModuleChannelPropertyPermissions.rw || permission === DevicesModuleChannelPropertyPermissions.wo
		)
	) {
		return false;
	}

	if (props.dataTypes && props.dataTypes.length > 0 && !props.dataTypes.includes(property.dataType)) {
		return false;
	}

	return props.propertyFilter ? props.propertyFilter(property) : true;
};

const propertyLabel = (property: IChannelProperty): string => {
	return property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`);
};

const toDevicesOptions = (items: IDevice[]): { value: IDevice['id']; label: string }[] => {
	return orderBy<IDevice>(items, [(device: IDevice) => device.name.toLowerCase()], ['asc']).map((device) => ({
		value: device.id,
		label: device.name,
	}));
};

// Hidden devices are never offered by this picker — the backend refuses to work with one,
// so filtering here keeps every derived option list (all/recommended/other) consistent.
const visibleDevices = computed<IDevice[]>((): IDevice[] => devices.value.filter((device) => !device.hidden));

const devicesOptions = computed<{ value: IDevice['id']; label: string }[]>(() => toDevicesOptions(visibleDevices.value));

const recommendedDevicesOptions = computed<{ value: IDevice['id']; label: string }[]>(() => {
	if (!hasRecommendedCategories.value || !props.recommendedCategories) {
		return devicesOptions.value;
	}

	return toDevicesOptions(visibleDevices.value.filter((device) => props.recommendedCategories!.includes(device.category)));
});

const otherDevicesOptions = computed<{ value: IDevice['id']; label: string }[]>(() => {
	if (!hasRecommendedCategories.value || !props.recommendedCategories) {
		return [];
	}

	return toDevicesOptions(visibleDevices.value.filter((device) => !props.recommendedCategories!.includes(device.category)));
});

const channelsOptions = computed<{ value: IChannel['id']; label: string }[]>(() => {
	// Offer only the channels with a property passing the filters (once the properties are loaded)
	const channelsToShow =
		hasPropertyFilter.value && properties.value.length > 0
			? channels.value.filter((channel) => properties.value.some((property) => property.channel === channel.id && isPropertyOffered(property)))
			: channels.value;

	return orderBy<IChannel>(channelsToShow, [(channel: IChannel) => channel.name.toLowerCase()], ['asc']).map((channel) => ({
		value: channel.id,
		label: channel.name,
	}));
});

const propertiesOptions = computed<{ value: IChannelProperty['id']; label: string }[]>(() => {
	return orderBy<IChannelProperty>(
		properties.value.filter(isPropertyOffered),
		[(property: IChannelProperty) => propertyLabel(property).toLowerCase()],
		['asc']
	).map((property) => ({
		value: property.id,
		label: propertyLabel(property),
	}));
});

const onDeviceUpdate = (value: IDevice['id']): void => {
	emit('update:deviceId', value);
};

const onDeviceChange = (): void => {
	emit('update:channelId', null);
	emit('update:propertyId', null);
	emit('change', 'device');
};

const onChannelUpdate = (value: IChannel['id']): void => {
	emit('update:channelId', value);
};

const onChannelChange = (): void => {
	emit('update:propertyId', null);
	emit('change', 'channel');
};

const onPropertyUpdate = (value: IChannelProperty['id']): void => {
	emit('update:propertyId', value);
};

const onPropertyChange = (): void => {
	emit('change', 'property');
};

const load = async (fetch: () => Promise<void>): Promise<void> => {
	try {
		await fetch();
	} catch (error: unknown) {
		throw new DevicesException('Something went wrong', error as Error);
	}
};

onBeforeMount(async (): Promise<void> => {
	if (!devicesLoaded.value) {
		await load(fetchDevices);
	}
});

watch(
	(): IDevice['id'] | null | undefined => props.deviceId,
	async (val: IDevice['id'] | null | undefined): Promise<void> => {
		if (val) {
			await load(fetchChannels);
		}
	},
	{ immediate: true }
);

watch(
	(): IChannel['id'] | null | undefined => props.channelId,
	async (val: IChannel['id'] | null | undefined): Promise<void> => {
		if (val) {
			await load(fetchProperties);
		}
	},
	{ immediate: true }
);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'device-property-picker.scss';
</style>
