<template>
	<div
		class="local-action-content"
		:class="{ 'has-missing-resource': isMissingResource }"
	>
		<div class="flex items-center gap-1 min-w-0">
			<el-tooltip
				v-if="isMissingResource"
				:content="t('scenesLocalPlugin.actionCard.missingResource')"
				placement="top"
			>
				<el-icon
					class="warning-icon flex-shrink-0"
					:size="14"
				>
					<icon icon="mdi:alert-circle" />
				</el-icon>
			</el-tooltip>

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
						<span
							class="detail-value"
							:class="{ 'text-danger': isDeviceMissing }"
						>
							{{ deviceName }}
						</span>
					</div>
					<div class="detail-row">
						<span class="detail-label">{{ t('scenesLocalPlugin.actionCard.channel') }}:</span>
						<span
							class="detail-value"
							:class="{ 'text-danger': isChannelMissing }"
						>
							{{ channelName }}
						</span>
					</div>
					<div class="detail-row">
						<span class="detail-label">{{ t('scenesLocalPlugin.actionCard.property') }}:</span>
						<span
							class="detail-value"
							:class="{ 'text-danger': isPropertyMissing }"
						>
							{{ propertyName }}
						</span>
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
				:class="{ 'text-danger': isDeviceMissing }"
				truncated
			>
				{{ deviceName }}
			</el-text>
			<template v-if="showChannel">
				<span class="text-gray-400 flex-shrink-0">›</span>
				<el-text
					class="flex-shrink-1 min-w-0"
					:class="isChannelMissing ? 'text-danger' : 'text-gray-600'"
					truncated
				>
					{{ channelName }}
				</el-text>
			</template>
			<span class="text-gray-400 flex-shrink-0">›</span>
			<el-text
				class="flex-shrink-1 min-w-0"
				:class="isPropertyMissing ? 'text-danger' : 'text-gray-600'"
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

import { ElIcon, ElPopover, ElTag, ElText, ElTooltip } from 'element-plus';

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

const device = computed(() => devices.value.find((d) => d.id === deviceId.value));
const channel = computed(() => channels.value.find((c) => c.id === channelId.value));
const property = computed(() => properties.value.find((p) => p.id === propertyId.value));

const isDeviceMissing = computed<boolean>(() => !device.value && !!deviceId.value);
const isChannelMissing = computed<boolean>(() => !channel.value && !!channelId.value);
const isPropertyMissing = computed<boolean>(() => !property.value && !!propertyId.value);
const isMissingResource = computed<boolean>(() => isDeviceMissing.value || isChannelMissing.value || isPropertyMissing.value);

const deviceName = computed<string>(() => {
	return device.value?.name ?? t('scenesLocalPlugin.actionCard.unknownDevice');
});

const channelName = computed<string>(() => {
	return channel.value?.name ?? t('scenesLocalPlugin.actionCard.unknownChannel');
});

const propertyName = computed<string>(() => {
	if (!property.value) return t('scenesLocalPlugin.actionCard.unknownProperty');
	return property.value.name ?? t(`devicesModule.categories.channelsProperties.${property.value.category}`);
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

	// Check if device exists before fetching channels
	const device = devices.value.find((d) => d.id === deviceId.value);
	if (!device) {
		// Device was deleted, skip fetching channels/properties
		return;
	}

	if (deviceId.value) {
		try {
			await fetchChannels();
		} catch {
			// Device or channels may have been deleted, ignore error
			return;
		}
	}

	if (channelId.value) {
		try {
			await fetchProperties();
		} catch {
			// Channel or properties may have been deleted, ignore error
		}
	}
});
</script>

<style scoped>
.local-action-content {
	font-size: 13px;
	overflow: hidden;
}

.local-action-content.has-missing-resource {
	opacity: 0.8;
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

.warning-icon {
	color: var(--el-color-danger);
	margin-right: 4px;
}

.text-danger {
	color: var(--el-color-danger) !important;
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
