<template>
	<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
		<el-card
			v-for="(day, index) in props.forecast"
			:key="index"
			shadow="hover"
			body-class="p-3! text-center"
		>
			<div class="font-medium mb-2">
				{{ formatDayName(day.dayTime) }}
			</div>
			<el-icon :size="40">
				<icon :icon="getWeatherIcon(day.weather.code, day.sunrise, day.sunset)" />
			</el-icon>
			<div class="mt-2 flex justify-center gap-2">
				<span class="font-bold">
					{{ formatTemp(day.temperature.max) }}°{{ temperatureUnit }}
				</span>
				<span class="text-gray-400">
					{{ formatTemp(day.temperature.min) }}°{{ temperatureUnit }}
				</span>
			</div>
			<div class="text-xs text-gray-500 mt-1 truncate">
				{{ day.weather.description }}
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ElCard, ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

import { formatNumber } from '../../../common';
import { useConfigModule } from '../../config';
import { WEATHER_MODULE_NAME } from '../weather.constants';
import { getWeatherIcon } from '../utils/utils';

import type { ILocationForecastProps } from './location-forecast.types';

defineOptions({
	name: 'LocationForecast',
});

const props = defineProps<ILocationForecastProps>();

const { configModule: weatherConfig } = useConfigModule({ type: WEATHER_MODULE_NAME });

const temperatureUnit = computed<string>(() => {
	const config = weatherConfig.value as { unit?: string } | null;
	return config?.unit === 'fahrenheit' ? 'F' : 'C';
});

const formatDayName = (date: Date): string => {
	return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
};

const formatTemp = (temp: number | null | undefined): string => {
	if (temp === null || temp === undefined) {
		return '-';
	}
	return formatNumber(temp, { maximumFractionDigits: 0 });
};
</script>
