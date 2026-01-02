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

// Extract values from root level (camelCase) with fallback to configuration (snake_case) for backwards compatibility
const deviceId = computed(
	() => (props.action.deviceId as string | undefined) ?? (props.action.configuration?.device_id as string) ?? ''
);
const channelId = computed(
	() => (props.action.channelId as string | undefined) ?? (props.action.configuration?.channel_id as string | null) ?? null
);
const propertyId = computed(
	() => (props.action.propertyId as string | undefined) ?? (props.action.configuration?.property_id as string) ?? ''
);
const value = computed(() => props.action.value ?? props.action.configuration?.value);

const { devices, fetchDevices, loaded: devicesLoaded } = useDevices();
const { channels, fetchChannels } = useChannels({
	deviceId,
});
const { properties, fetchProperties } = useChannelsProperties({
	channelId: computed(() => channelId.value ?? undefined),
});

const deviceName = computed<string>(() => {
	const device = devices.value.find((d) => d.id === deviceId.value);
	return device?.name ?? 'Unknown device';
});

const channelName = computed<string>(() => {
	const channel = channels.value.find((c) => c.id === channelId.value);
	return channel?.name ?? 'Unknown channel';
});

const propertyName = computed<string>(() => {
	const property = properties.value.find((p) => p.id === propertyId.value);
	return property?.name ?? property?.identifier ?? 'Unknown property';
});

const formattedValue = computed<string>(() => {
	const v = value.value;
	if (typeof v === 'boolean') {
		return v ? 'ON' : 'OFF';
	}
	return String(v ?? '');
});

const valueTagType = computed<'success' | 'danger' | 'info'>(() => {
	const v = value.value;
	if (typeof v === 'boolean') {
		return v ? 'success' : 'danger';
	}
	return 'info';
});

onBeforeMount(async (): Promise<void> => {
	if (!devicesLoaded.value) {
		await fetchDevices();
	}

	if (deviceId.value) {
		await fetchChannels();
	}

	if (channelId.value) {
		await fetchProperties();
	}
});
</script>

<style scoped>
.local-action-content {
	font-size: 13px;
}
</style>
