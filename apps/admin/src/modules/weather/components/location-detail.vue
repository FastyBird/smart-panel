<template>
	<!-- Template 3: the current weather card -->
	<div
		class="flex flex-col gap-4"
		data-test-id="location-current"
	>
		<div class="flex items-center gap-3">
			<icon
				:icon="weatherIcon"
				width="48"
				height="48"
				aria-hidden="true"
			/>
			<span class="flex flex-col gap-0.5 min-w-0">
				<span class="text-title">{{ format(props.current.temperature, { maximumFractionDigits: 1 }) }}{{ temperatureUnit }}</span>
				<span class="text-secondary truncate">{{ props.current.weather.description }}</span>
			</span>
		</div>

		<kv-grid
			:items="items"
			:cols="2"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';

import { KvGrid, type KvGridItem, useNumberFormat } from '../../../common';
import { useConfigModule } from '../../config';
import { getWeatherIcon } from '../utils/utils';
import { WEATHER_MODULE_NAME } from '../weather.constants';

import type { ILocationDetailProps } from './location-detail.types';

defineOptions({
	name: 'LocationDetail',
});

const props = defineProps<ILocationDetailProps>();

const { t } = useI18n();

const { configModule: weatherConfig } = useConfigModule({ type: WEATHER_MODULE_NAME });
const { format } = useNumberFormat();

const temperatureUnit = computed<string>((): string => {
	const config = weatherConfig.value as { unit?: string } | null;
	return config?.unit === 'fahrenheit' ? '°F' : '°C';
});

const weatherIcon = computed<string>((): string => getWeatherIcon(props.current.weather.code, props.current.sunrise, props.current.sunset));

const items = computed<KvGridItem[]>((): KvGridItem[] => [
	{
		label: t('weatherModule.texts.locationDetail.feelsLike'),
		value: `${format(props.current.feelsLike, { maximumFractionDigits: 1 })}${temperatureUnit.value}`,
	},
	{ label: t('weatherModule.texts.locationDetail.humidity'), value: `${props.current.humidity} %` },
	{ label: t('weatherModule.texts.locationDetail.wind'), value: `${format(props.current.wind.speed, { maximumFractionDigits: 1 })} m/s` },
	{ label: t('weatherModule.texts.locationDetail.pressure'), value: `${props.current.pressure} hPa` },
]);
</script>
