<template>
	<!-- Template 3: the summary card above the tabs -->
	<el-card
		shadow="never"
		body-class="flex flex-wrap items-start gap-4 p-4!"
		data-test-id="device-summary"
	>
		<div
			class="flex items-center justify-center shrink-0 w-14 h-14 rounded-lg bg-fill-light text-regular"
			aria-hidden="true"
		>
			<icon
				:icon="deviceIcon"
				width="32"
				height="32"
			/>
		</div>

		<div class="flex flex-col gap-1 min-w-[200px]">
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-section">{{ props.device.name }}</span>
				<status-tag
					:status="deviceStatusTag(props.device.status?.status)"
					:label="t(`devicesModule.states.${String(props.device.status?.status ?? DevicesModuleDeviceConnectionStatus.unknown).toLowerCase()}`)"
				/>
			</div>
			<span
				v-if="props.device.description"
				class="text-help"
			>
				{{ props.device.description }}
			</span>
		</div>

		<kv-grid
			:items="items"
			:cols="4"
			class="flex-1 min-w-[280px]"
		/>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard } from 'element-plus';

import { Icon } from '@iconify/vue';

import { KvGrid, type KvGridItem, StatusTag } from '../../../../common';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleDeviceConnectionStatus,
} from '../../../../openapi.constants';
import { useChannels, useChannelsProperties, useDeviceIcon, useDevicesPlugin } from '../../composables/composables';
import { deviceStatusTag } from '../../devices.status';
import type { IChannel } from '../../store/channels.store.types';

import type { IDeviceDetailProps } from './device-detail.types';

defineOptions({
	name: 'DeviceDetail',
});

const props = defineProps<IDeviceDetailProps>();

const { t } = useI18n();

const { icon: deviceIcon } = useDeviceIcon({ id: props.device.id });

const { plugin } = useDevicesPlugin({ type: props.device.type });

const { channels } = useChannels({ deviceId: props.device.id });

const deviceInfoChannel = computed<IChannel | undefined>((): IChannel | undefined => {
	return channels.value.find((channel) => channel.category === DevicesModuleChannelCategory.device_information);
});

const { properties: deviceInfoProperties } = useChannelsProperties({
	channelId: computed(() => deviceInfoChannel.value?.id),
});

// The status is in the tag next to the name, and the link quality belongs to the channel
const hiddenCategories: DevicesModuleChannelPropertyCategory[] = [
	DevicesModuleChannelPropertyCategory.status,
	DevicesModuleChannelPropertyCategory.link_quality,
];

const propertyValue = (value: unknown): string | number | null => {
	if (value !== null && typeof value === 'object' && 'value' in value) {
		return propertyValue((value as { value: unknown }).value);
	}

	if (typeof value === 'string' || typeof value === 'number') {
		return value;
	}

	return value === null || value === undefined ? null : String(value);
};

const items = computed<KvGridItem[]>((): KvGridItem[] => [
	{ label: t('devicesModule.texts.devices.category'), value: t(`devicesModule.categories.devices.${props.device.category}`) },
	{ label: t('devicesModule.table.devices.columns.type.title'), value: plugin.value?.name ?? props.device.type },
	// Only the device information channel: without one, the property list is not limited to a channel at all
	...(deviceInfoChannel.value ? deviceInfoProperties.value : [])
		.filter((property) => !hiddenCategories.includes(property.category))
		.map(
			(property): KvGridItem => ({
				label: t(`devicesModule.categories.channelsProperties.${property.category}`),
				value: propertyValue(property.value),
			})
		),
]);
</script>
