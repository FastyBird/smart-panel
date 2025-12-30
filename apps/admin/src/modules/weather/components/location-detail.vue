<template>
	<dl class="grid m-0">
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('weatherModule.texts.locationDetail.provider') }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
			<el-text>
				{{ providerName }}
			</el-text>
		</dd>
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('weatherModule.texts.locationDetail.temperature') }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
			<div class="flex items-center gap-2">
				<el-icon :size="32">
					<icon :icon="weatherIcon" />
				</el-icon>
				<el-text class="text-xl font-bold">
					{{ formatNumber(props.current.temperature, { maximumFractionDigits: 1 }) }}{{ temperatureUnit }}
				</el-text>
				<el-text class="text-gray-500">
					{{ t('weatherModule.texts.locationDetail.feelsLike', { temp: `${formatNumber(props.current.feelsLike, { maximumFractionDigits: 1 })}${temperatureUnit}` }) }}
				</el-text>
			</div>
		</dd>
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('weatherModule.texts.locationDetail.conditions') }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
			<el-text>
				{{ props.current.weather.description }}
			</el-text>
		</dd>
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('weatherModule.texts.locationDetail.humidity') }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
			<el-text>
				{{ props.current.humidity }}%
			</el-text>
		</dd>
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('weatherModule.texts.locationDetail.wind') }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
			<el-text>
				{{ formatNumber(props.current.wind.speed, { maximumFractionDigits: 1 }) }} m/s
			</el-text>
		</dd>
		<dt
			class="b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('weatherModule.texts.locationDetail.pressure') }}
		</dt>
		<dd class="col-start-2 m-0 p-2 flex items-center min-w-[8rem]">
			<el-text>
				{{ props.current.pressure }} hPa
			</el-text>
		</dd>
	</dl>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElIcon, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { formatNumber } from '../../../common';
import { useConfigModule } from '../../config';
import { WEATHER_MODULE_NAME } from '../weather.constants';
import { getWeatherIcon } from '../utils/utils';

import type { ILocationDetailProps } from './location-detail.types';

defineOptions({
	name: 'LocationDetail',
});

const props = defineProps<ILocationDetailProps>();

const { t } = useI18n();

const { configModule: weatherConfig } = useConfigModule({ type: WEATHER_MODULE_NAME });

const temperatureUnit = computed<string>(() => {
	const config = weatherConfig.value as { unit?: string } | null;
	return config?.unit === 'fahrenheit' ? '°F' : '°C';
});

const providerName = computed<string>(() => {
	// Extract provider name from type (e.g., 'openweathermap-onecall' -> 'OpenWeatherMap')
	const type = props.location.type;
	if (type.startsWith('openweathermap')) {
		return 'OpenWeatherMap';
	}
	return type;
});

const weatherIcon = computed<string>(() => {
	return getWeatherIcon(props.current.weather.code, props.current.sunrise, props.current.sunset);
});
</script>
