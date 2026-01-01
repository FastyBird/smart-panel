<template>
	<div class="local-action-content">
		<div class="flex items-center gap-2">
			<span class="font-medium">{{ deviceName }}</span>
			<span class="text-gray-400">/</span>
			<span class="text-gray-600">{{ channelName }}</span>
			<span class="text-gray-400">/</span>
			<span class="text-gray-600">{{ propertyName }}</span>
			<span class="text-gray-400">→</span>
			<el-tag size="small" :type="valueTagType">
				{{ formattedValue }}
			</el-tag>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';

import { ElTag } from 'element-plus';

import { useChannels, useChannelsProperties, useDevices } from '../../../modules/devices';
import type { ISceneActionCardProps } from '../../../modules/scenes/components/actions/scene-action-card.types';

defineOptions({
	name: 'LocalSceneActionCard',
});

const props = defineProps<ISceneActionCardProps>();

const { devices, fetchDevices, loaded: devicesLoaded } = useDevices();
const { channels, fetchChannels } = useChannels({
	deviceId: computed(() => props.action.deviceId ?? ''),
});
const { properties, fetchProperties } = useChannelsProperties({
	channelId: computed(() => props.action.channelId ?? undefined),
});

const deviceName = computed<string>(() => {
	const device = devices.value.find((d) => d.id === props.action.deviceId);
	return device?.name ?? 'Unknown device';
});

const channelName = computed<string>(() => {
	const channel = channels.value.find((c) => c.id === props.action.channelId);
	return channel?.name ?? 'Unknown channel';
});

const propertyName = computed<string>(() => {
	const property = properties.value.find((p) => p.id === props.action.propertyId);
	return property?.name ?? property?.identifier ?? 'Unknown property';
});

const formattedValue = computed<string>(() => {
	const value = props.action.value;
	if (typeof value === 'boolean') {
		return value ? 'ON' : 'OFF';
	}
	return String(value);
});

const valueTagType = computed<'success' | 'danger' | 'info'>(() => {
	const value = props.action.value;
	if (typeof value === 'boolean') {
		return value ? 'success' : 'danger';
	}
	return 'info';
});

onBeforeMount(async (): Promise<void> => {
	if (!devicesLoaded.value) {
		await fetchDevices();
	}

	if (props.action.deviceId) {
		await fetchChannels();
	}

	if (props.action.channelId) {
		await fetchProperties();
	}
});
</script>

<style scoped>
.local-action-content {
	font-size: 13px;
}
</style>
