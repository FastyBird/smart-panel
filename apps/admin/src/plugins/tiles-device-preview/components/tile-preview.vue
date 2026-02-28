<template>
	<div class="flex h-full w-full p-2 gap-2 overflow-hidden" :class="layoutClass">
		<div
			class="flex items-center justify-center rounded-full shrink-0"
			:class="iconContainerClass"
			:style="{ backgroundColor: 'var(--el-color-primary-light-9)' }"
		>
			<el-icon
				:size="iconSize"
				color="var(--el-color-primary)"
			>
				<icon :icon="deviceIcon" />
			</el-icon>
		</div>
		<div
			v-if="!isButton"
			class="flex flex-col justify-center min-w-0"
		>
			<el-text
				size="small"
				class="font-bold truncate"
			>
				{{ deviceName }}
			</el-text>
			<el-text
				type="info"
				size="small"
				class="truncate"
			>
				{{ deviceStatus }}
			</el-text>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElIcon, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useDevice, useDeviceIcon } from '../../../modules/devices';

import type { ITilePreviewProps } from './tile-preview.types';

defineOptions({
	name: 'DevicePreviewTilePreview',
});

const props = defineProps<ITilePreviewProps>();

const { t } = useI18n();

const deviceId = (props.tile as { device?: string }).device ?? null;

const { device, fetchDevice } = useDevice({ id: deviceId ?? '' });
const { icon: categoryIcon } = useDeviceIcon({ id: deviceId ?? '' });

const tileIcon = computed<string | null>((): string | null => {
	return (props.tile as { icon?: string | null }).icon ?? null;
});

const deviceIcon = computed<string>((): string => {
	return tileIcon.value ?? categoryIcon.value ?? 'mdi:devices';
});

const deviceName = computed<string>((): string => {
	return (device.value?.name as string | undefined) ?? t('tilesDevicePreviewPlugin.preview.defaultName');
});

const deviceStatus = computed<string>((): string => {
	if (!device.value) {
		return '';
	}

	const status = device.value.status as { online?: boolean } | undefined;

	return status?.online ? t('tilesDevicePreviewPlugin.preview.statusOnline') : t('tilesDevicePreviewPlugin.preview.statusOffline');
});

const isButton = computed<boolean>((): boolean => {
	return props.tile.rowSpan === 1 && props.tile.colSpan === 1;
});

const isSquare = computed<boolean>((): boolean => {
	return props.tile.rowSpan === props.tile.colSpan;
});

const layoutClass = computed<string>((): string => {
	if (isSquare.value) {
		return 'flex-col items-center justify-center';
	}
	return 'flex-row items-center';
});

const iconContainerClass = computed<string>((): string => {
	return props.tile.rowSpan >= 2 ? 'w-10 h-10' : 'w-7 h-7';
});

const iconSize = computed<number>((): number => {
	return props.tile.rowSpan >= 2 ? 22 : 16;
});

onBeforeMount((): void => {
	if (deviceId) {
		fetchDevice().catch((): void => {
			// Silently fail - preview will show fallback
		});
	}
});
</script>
