<template>
	<div class="flex flex-row items-center justify-around h-full w-full p-2 gap-1 overflow-hidden">
		<div
			v-for="day in forecastDays"
			:key="day.label"
			class="flex flex-col items-center min-w-0"
		>
			<span class="display-text-caption truncate">
				{{ day.label }}
			</span>
			<icon
				:icon="day.icon"
				width="18"
				height="18"
				:class="day.iconClass"
				aria-hidden="true"
			/>
			<span class="display-text-body">
				{{ day.temp }}
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';

import type { ITilePreviewProps } from './tile-preview.types';

defineOptions({
	name: 'ForecastWeatherTilePreview',
});

defineProps<ITilePreviewProps>();

const { t } = useI18n();

const forecastDays = computed(() => [
	{ label: t('tilesWeatherPlugin.preview.forecast.mon'), icon: 'mdi:weather-sunny', iconClass: 'display-icon-warning', temp: '22°' },
	{ label: t('tilesWeatherPlugin.preview.forecast.tue'), icon: 'mdi:weather-partly-cloudy', iconClass: 'display-icon', temp: '19°' },
	{ label: t('tilesWeatherPlugin.preview.forecast.wed'), icon: 'mdi:weather-rainy', iconClass: 'display-icon-accent', temp: '16°' },
	{ label: t('tilesWeatherPlugin.preview.forecast.thu'), icon: 'mdi:weather-sunny', iconClass: 'display-icon-warning', temp: '21°' },
]);
</script>
