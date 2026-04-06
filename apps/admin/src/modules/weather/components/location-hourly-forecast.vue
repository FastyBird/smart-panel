<template>
	<el-scrollbar>
		<div class="flex gap-3 pb-2">
			<div
				v-for="(hour, index) in props.hourlyForecast"
				:key="index"
				class="flex flex-col items-center gap-1 min-w-[4rem] text-center"
			>
				<div class="text-xs text-gray-500">
					{{ formatHour(hour.dateTime) }}
				</div>
				<el-icon :size="28">
					<icon :icon="getWeatherIcon(hour.weather.code, props.sunrise, props.sunset, hour.dateTime)" />
				</el-icon>
				<div class="font-bold text-sm">
					{{ formatTemp(hour.temperature) }}°{{ temperatureUnit }}
				</div>
				<div class="text-xs text-gray-400">
					{{ hour.humidity }}%
				</div>
			</div>
		</div>
	</el-scrollbar>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ElIcon, ElScrollbar } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useNumberFormat } from '../../../common/composables/useNumberFormat';
import { useConfigModule } from '../../config';
import { WEATHER_MODULE_NAME } from '../weather.constants';
import { getWeatherIcon } from '../utils/utils';

import type { ILocationHourlyForecastProps } from './location-hourly-forecast.types';

defineOptions({
	name: 'LocationHourlyForecast',
});

const props = defineProps<ILocationHourlyForecastProps>();

const { configModule: weatherConfig } = useConfigModule({ type: WEATHER_MODULE_NAME });
const { format } = useNumberFormat();

const temperatureUnit = computed<string>(() => {
	const config = weatherConfig.value as { unit?: string } | null;
	return config?.unit === 'fahrenheit' ? 'F' : 'C';
});

const formatHour = (date: Date): string => {
	return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
};

const formatTemp = (temp: number): string => {
	return format(temp, { maximumFractionDigits: 0 });
};
</script>
