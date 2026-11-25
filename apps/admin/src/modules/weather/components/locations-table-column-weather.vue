<template>
	<div
		v-if="weatherData"
		class="flex items-center gap-2"
	>
		<icon
			:icon="iconType"
			width="24"
			height="24"
			aria-hidden="true"
		/>
		<span class="text-body font-medium whitespace-nowrap">
			{{ temperature !== null ? format(temperature, { maximumFractionDigits: 1 }) : '—' }}{{ unit }}
		</span>
	</div>
	<el-tooltip
		v-else-if="props.fetchCompleted"
		:content="t('weatherModule.table.columns.weather.error')"
		placement="top"
	>
		<span
			class="inline-flex items-center gap-1 text-danger cursor-help"
			@click.stop
		>
			<icon
				icon="mdi:alert-circle"
				width="16"
				height="16"
				aria-hidden="true"
			/>
			<span class="text-help text-danger">{{ t('weatherModule.table.columns.weather.failed') }}</span>
		</span>
	</el-tooltip>
	<span
		v-else
		class="text-help"
	>
		—
	</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useNumberFormat } from '../../../common';
import type { ILocationWeatherData } from '../composables/useLocationsWeather';
import { getWeatherIcon } from '../utils/utils';

import type { ILocationsTableColumnWeatherProps } from './locations-table-column-weather.types';

defineOptions({
	name: 'LocationsTableColumnWeather',
});

const props = defineProps<ILocationsTableColumnWeatherProps>();

const { t } = useI18n();
const { format } = useNumberFormat();

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
