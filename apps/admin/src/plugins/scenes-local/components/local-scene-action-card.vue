<template>
	<div class="local-action-content">
		<div class="flex items-center gap-1 min-w-0">
			<el-popover
				placement="top"
				:width="300"
				trigger="click"
			>
				<template #reference>
					<el-icon
						class="info-icon flex-shrink-0"
						:size="14"
					>
						<icon icon="mdi:information-outline" />
					</el-icon>
				</template>

				<div class="action-detail-popover">
					<div class="detail-row">
						<span class="detail-label">{{ t('scenesLocalPlugin.actionCard.device') }}:</span>
						<span class="detail-value">{{ deviceName }}</span>
					</div>
					<div class="detail-row">
						<span class="detail-label">{{ t('scenesLocalPlugin.actionCard.channel') }}:</span>
						<span class="detail-value">{{ channelName }}</span>
					</div>
					<div class="detail-row">
						<span class="detail-label">{{ t('scenesLocalPlugin.actionCard.property') }}:</span>
						<span class="detail-value">{{ propertyName }}</span>
					</div>
					<div class="detail-row">
						<span class="detail-label">{{ t('scenesLocalPlugin.actionCard.value') }}:</span>
						<el-tag
							size="small"
							:type="valueTagType"
						>
							{{ formattedValue }}
						</el-tag>
					</div>
				</div>
			</el-popover>

			<el-text
				class="font-medium flex-shrink-1 min-w-0"
				truncated
			>
				{{ deviceName }}
			</el-text>
			<template v-if="showChannel">
				<span class="text-gray-400 flex-shrink-0">›</span>
				<el-text
					class="text-gray-600 flex-shrink-1 min-w-0"
					truncated
				>
					{{ channelName }}
				</el-text>
			</template>
			<span class="text-gray-400 flex-shrink-0">›</span>
			<el-text
				class="text-gray-600 flex-shrink-1 min-w-0"
				truncated
			>
				{{ propertyName }}
			</el-text>
			<span class="text-gray-400 flex-shrink-0 mx-1">→</span>
			<el-tag
				size="small"
				:type="valueTagType"
				class="flex-shrink-0"
			>
				{{ formattedValue }}
			</el-tag>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElIcon, ElPopover, ElTag, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useChannels, useChannelsProperties, useDevices } from '../../../modules/devices';
import type { ISceneActionCardProps } from '../../../modules/scenes/components/actions/scene-action-card.types';

defineOptions({
	name: 'LocalSceneActionCard',
});

const props = defineProps<ISceneActionCardProps>();

const { t } = useI18n();

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
	if (!property) return t('scenesLocalPlugin.actionCard.unknownProperty');
	return property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`);
});

// Hide channel if it has the same name as the device (common pattern)
const showChannel = computed<boolean>(() => {
	return deviceName.value.toLowerCase() !== channelName.value.toLowerCase();
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
	overflow: hidden;
}

.info-icon {
	color: var(--el-text-color-secondary);
	cursor: pointer;
	transition: color 0.2s;
	margin-right: 4px;
}

.info-icon:hover {
	color: var(--el-color-primary);
}

.action-detail-popover {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.detail-row {
	display: flex;
	align-items: center;
	gap: 8px;
}

.detail-label {
	color: var(--el-text-color-secondary);
	min-width: 70px;
	flex-shrink: 0;
}

.detail-value {
	font-weight: 500;
	word-break: break-word;
}
</style>
