<template>
	<div
		v-if="weatherData"
		class="flex items-center gap-2"
	>
		<el-icon :size="24">
			<icon :icon="iconType" />
		</el-icon>
		<span class="font-medium">
			{{ temperature !== null ? formatNumber(temperature, { maximumFractionDigits: 1 }) : '-' }}{{ unit }}
		</span>
	</div>
	<el-tooltip
		v-else-if="props.fetchCompleted"
		:content="t('weatherModule.table.columns.weather.error')"
		placement="top"
	>
		<div
			class="flex items-center gap-1 text-red-500 cursor-help"
			@click.stop
		>
			<el-icon :size="16">
				<icon icon="mdi:alert-circle" />
			</el-icon>
			<span class="text-xs">{{ t('weatherModule.table.columns.weather.failed') }}</span>
		</div>
	</el-tooltip>
	<div
		v-else
		class="text-gray-400"
	>
		-
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElIcon, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { formatNumber } from '../../../common';
import type { ILocationWeatherData } from '../composables/useLocationsWeather';
import { getWeatherIcon } from '../utils/utils';

import type { ILocationsTableColumnWeatherProps } from './locations-table-column-weather.types';

defineOptions({
	name: 'LocationsTableColumnWeather',
});

const props = defineProps<ILocationsTableColumnWeatherProps>();

const { t } = useI18n();

const weatherData = computed<ILocationWeatherData | null>(() => {
	return props.weatherByLocation[props.locationId] ?? null;
});

const temperature = computed<number | null>(() => {
	return weatherData.value?.current.temperature ?? null;
});

const iconType = computed<string>(() => {
	if (!weatherData.value) {
		return 'wi:na';
	}

	return getWeatherIcon(
		weatherData.value.current.weather.code,
		weatherData.value.current.sunrise,
		weatherData.value.current.sunset
	);
});

const unit = computed<string>(() => {
	return props.temperatureUnit === 'fahrenheit' ? '°F' : '°C';
});
</script>
