<template>
	<el-card
		class="mt-2"
		shadow="never"
		body-class="p-0!"
	>
		<dl class="grid grid-cols-[auto_1fr_auto_1fr] m-0">
			<!-- Row 1: Category | Status -->
			<dt
				class="b-r b-r-solid py-3 px-2 flex items-center justify-end"
				:class="{ 'b-b b-b-solid': hasDeviceInfoProperties }"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('devicesModule.texts.devices.category') }}
			</dt>
			<dd
				class="b-r b-r-solid m-0 p-2 flex items-center min-w-[8rem]"
				:class="{ 'b-b b-b-solid': hasDeviceInfoProperties }"
			>
				<el-text>
					{{ t(`devicesModule.categories.devices.${device.category}`) }}
				</el-text>
			</dd>
			<dt
				class="b-r b-r-solid py-3 px-2 flex items-center justify-end"
				:class="{ 'b-b b-b-solid': hasDeviceInfoProperties }"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('devicesModule.texts.devices.status') }}
			</dt>
			<dd
				class="m-0 p-2 flex items-center min-w-[8rem]"
				:class="{ 'b-b b-b-solid': hasDeviceInfoProperties }"
			>
				<el-text>
					<el-tag
						:type="stateColor"
						size="small"
					>
						{{ t(`devicesModule.states.${String(device.status?.status ?? DevicesModuleDeviceConnectionStatus.unknown).toLowerCase()}`) }}
					</el-tag>
				</el-text>
			</dd>

			<!-- Device information properties -->
			<device-detail-description
				v-if="hasDeviceInfoProperties && deviceInfoChannel"
				:device="device"
				:channel="deviceInfoChannel"
			/>
		</dl>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, ElTag, ElText } from 'element-plus';

import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory, DevicesModuleDeviceConnectionStatus } from '../../../../openapi.constants';
import { useChannels, useChannelsProperties } from '../../composables/composables';
import { type StateColor } from '../../devices.constants';
import type { IChannel } from '../../store/channels.store.types';

import DeviceDetailDescription from './device-detail-description.vue';
import type { IDeviceDetailProps } from './device-detail.types';

defineOptions({
	name: 'DeviceDetail',
});

const props = defineProps<IDeviceDetailProps>();

const { t } = useI18n();

const { channels } = useChannels({ deviceId: props.device.id });

const deviceInfoChannel = computed<IChannel | undefined>((): IChannel | undefined => {
	return channels.value.find((channel) => channel.category === DevicesModuleChannelCategory.device_information);
});

// Check if device_information channel has visible properties (matching the child filter)
const hiddenCategories: DevicesModuleChannelPropertyCategory[] = [
	DevicesModuleChannelPropertyCategory.status,
	DevicesModuleChannelPropertyCategory.link_quality,
];
const { properties: deviceInfoProperties } = useChannelsProperties({
	channelId: computed(() => deviceInfoChannel.value?.id),
});
const hasDeviceInfoProperties = computed<boolean>(
	() => !!deviceInfoChannel.value && deviceInfoProperties.value.some((p) => !hiddenCategories.includes(p.category)),
);

const stateColor = computed<StateColor>((): StateColor => {
	if ([DevicesModuleDeviceConnectionStatus.unknown].includes(props.device.status.status)) {
		return undefined;
	}

	if (
		[DevicesModuleDeviceConnectionStatus.connected, DevicesModuleDeviceConnectionStatus.ready, DevicesModuleDeviceConnectionStatus.running].includes(
			props.device.status.status
		)
	) {
		return 'success';
	} else if ([DevicesModuleDeviceConnectionStatus.init].includes(props.device.status.status)) {
		return 'info';
	} else if (
		[
			DevicesModuleDeviceConnectionStatus.disconnected,
			DevicesModuleDeviceConnectionStatus.stopped,
			DevicesModuleDeviceConnectionStatus.sleeping,
		].includes(props.device.status.status)
	) {
		return 'warning';
	}

	return 'danger';
});
</script>
