<template>
	<div class="flex flex-row items-center justify-center h-full w-full p-2 gap-2 overflow-hidden">
		<el-icon
			:size="iconSize"
			color="var(--el-color-warning)"
		>
			<icon icon="mdi:weather-sunny" />
		</el-icon>
		<div class="flex flex-col min-w-0">
			<el-text
				class="font-bold leading-none"
				style="font-size: clamp(14px, 2.5vw, 24px)"
			>
				22°C
			</el-text>
			<el-text
				type="info"
				size="small"
				class="truncate"
			>
				Sunny
			</el-text>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ElIcon, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { ITilePreviewProps } from './tile-preview.types';

defineOptions({
	name: 'DayWeatherTilePreview',
});

const props = defineProps<ITilePreviewProps>();

const iconSize = computed<number>((): number => {
	return props.tile.rowSpan >= 2 ? 36 : 24;
});
</script>
