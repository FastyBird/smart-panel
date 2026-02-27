<template>
	<div class="flex flex-row items-center justify-around h-full w-full p-2 gap-1 overflow-hidden">
		<div
			v-for="day in forecastDays"
			:key="day.label"
			class="flex flex-col items-center min-w-0"
		>
			<el-text
				size="small"
				type="info"
				class="truncate"
			>
				{{ day.label }}
			</el-text>
			<el-icon
				:size="18"
				:color="day.color"
			>
				<icon :icon="day.icon" />
			</el-icon>
			<el-text size="small">
				{{ day.temp }}
			</el-text>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElIcon, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { ITilePreviewProps } from './tile-preview.types';

defineOptions({
	name: 'ForecastWeatherTilePreview',
});

defineProps<ITilePreviewProps>();

const { t } = useI18n();

const forecastDays = computed(() => [
	{ label: t('tilesWeatherPlugin.preview.forecast.mon'), icon: 'mdi:weather-sunny', color: 'var(--el-color-warning)', temp: '22°' },
	{ label: t('tilesWeatherPlugin.preview.forecast.tue'), icon: 'mdi:weather-partly-cloudy', color: 'var(--el-color-info)', temp: '19°' },
	{ label: t('tilesWeatherPlugin.preview.forecast.wed'), icon: 'mdi:weather-rainy', color: 'var(--el-color-primary)', temp: '16°' },
	{ label: t('tilesWeatherPlugin.preview.forecast.thu'), icon: 'mdi:weather-sunny', color: 'var(--el-color-warning)', temp: '21°' },
]);
</script>
