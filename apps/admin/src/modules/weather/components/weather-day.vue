<template>
	<el-card
		v-loading="isLoading"
		shadow="never"
		header-class="px-3! py-3! font-bold"
	>
		<template #header>
			{{ t('weatherModule.headings.weather') }}
		</template>

		<div class="flex flex-col items-center gap-3">
			<el-icon
				class="mr-2"
				:size="80"
			>
				<icon :icon="iconType" />
			</el-icon>

			<span class="font-bold text-2xl">{{ description }}</span>

			<span class="flex flex-row items-start gap-1">
				<span class="font-bold text-4xl">
					{{ temperature !== null ? formatNumber(temperature, { maximumFractionDigits: 1 }) : '-' }}
				</span>
				<span class="text-lg text-gray-400">
					{{ unit }}
				</span>
			</span>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, ElIcon, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { formatNumber } from '../../../common';
import { useConfigModule } from '../../config';
import { WEATHER_MODULE_NAME } from '../weather.constants';
import { useWeatherDay } from '../composables/useWeatherDay';
import { WeatherException } from '../weather.exceptions';

defineOptions({
	name: 'WeatherDay',
});

const { t } = useI18n();

const { weatherDay, fetchWeatherDay, isLoading } = useWeatherDay();
const { configModule: configWeather, fetchConfigModule: fetchConfigWeather } = useConfigModule({ type: WEATHER_MODULE_NAME });

const temperature = computed<number | null>((): number | null => {
	return weatherDay.value?.temperature || null;
});

const unit = computed<string>((): string => {
	// Weather config is now accessed via modules - unit field should be in the module config
	const weatherUnit = (configWeather.value as { unit?: string })?.unit;
	return weatherUnit === 'fahrenheit' ? '°F' : '°C';
});

const iconType = computed<string>((): string => {
	if (weatherDay.value === null) {
		return 'wi:na';
	}

	const isNight = isNightTime(weatherDay.value.sunrise, weatherDay.value.sunset);

	if (weatherDay.value.weather.code >= 200 && weatherDay.value.weather.code < 300) {
		return isNight ? 'wi:night-thunderstorm' : 'wi:day-thunderstorm';
	} else if (weatherDay.value.weather.code >= 300 && weatherDay.value.weather.code < 400) {
		return isNight ? 'wi:night-showers' : 'wi:day-showers';
	} else if (weatherDay.value.weather.code >= 500 && weatherDay.value.weather.code <= 504) {
		return isNight ? 'wi:night-rain' : 'wi:day-rain';
	} else if (weatherDay.value.weather.code == 511) {
		return isNight ? 'wi:night-snow' : 'wi:day-snow';
	} else if (weatherDay.value.weather.code > 520 && weatherDay.value.weather.code < 600) {
		return isNight ? 'wi:night-showers' : 'wi:day-showers';
	} else if (weatherDay.value.weather.code >= 600 && weatherDay.value.weather.code < 700) {
		return isNight ? 'wi:night-snow' : 'wi:day-snow';
	} else if (weatherDay.value.weather.code >= 700 && weatherDay.value.weather.code < 800) {
		return isNight ? 'wi:night-fog' : 'wi:day-fog';
	} else if (weatherDay.value.weather.code == 800) {
		return isNight ? 'wi:night-clear' : 'wi:day-sunny';
	} else if (weatherDay.value.weather.code == 801) {
		return 'wi:cloud';
	} else if (weatherDay.value.weather.code == 802) {
		return isNight ? 'wi:night-cloudy' : 'wi:day-cloudy';
	} else if (weatherDay.value.weather.code == 803 || weatherDay.value.weather.code == 804) {
		return isNight ? 'wi:night-cloudy-windy' : 'wi:day-cloudy-windy';
	}

	return 'wi:na';
});

const description = computed<string>(() => {
	if (weatherDay.value === null) {
		return t('weatherModule.conditions.unknown');
	}

	switch (weatherDay.value.weather.code) {
		case 200:
			return t('weatherModule.conditions.thunderstormWithLightRain');
		case 201:
			return t('weatherModule.conditions.thunderstormWithRain');
		case 202:
			return t('weatherModule.conditions.thunderstormWithHeavyRain');
		case 210:
			return t('weatherModule.conditions.lightThunderstorm');
		case 211:
			return t('weatherModule.conditions.thunderstorm');
		case 212:
			return t('weatherModule.conditions.heavyThunderstorm');
		case 221:
			return t('weatherModule.conditions.raggedThunderstorm');
		case 230:
			return t('weatherModule.conditions.thunderstormWithLightDrizzle');
		case 231:
			return t('weatherModule.conditions.thunderstormWithDrizzle');
		case 232:
			return t('weatherModule.conditions.thunderstormWithHeavyDrizzle');
		case 300:
			return t('weatherModule.conditions.lightIntensityDrizzle');
		case 301:
			return t('weatherModule.conditions.drizzle');
		case 302:
			return t('weatherModule.conditions.heavyIntensityDrizzle');
		case 310:
			return t('weatherModule.conditions.lightIntensityDrizzleRain');
		case 311:
			return t('weatherModule.conditions.drizzleRain');
		case 312:
			return t('weatherModule.conditions.heavyIntensityDrizzleRain');
		case 313:
			return t('weatherModule.conditions.showerRainAndDrizzle');
		case 314:
			return t('weatherModule.conditions.heavyShowerRainAndDrizzle');
		case 321:
			return t('weatherModule.conditions.showerDrizzle');
		case 500:
			return t('weatherModule.conditions.lightRain');
		case 501:
			return t('weatherModule.conditions.moderateRain');
		case 502:
			return t('weatherModule.conditions.heavyIntensityRain');
		case 503:
			return t('weatherModule.conditions.veryHeavyRain');
		case 504:
			return t('weatherModule.conditions.extremeRain');
		case 511:
			return t('weatherModule.conditions.freezingRain');
		case 520:
			return t('weatherModule.conditions.lightIntensityShowerRain');
		case 521:
			return t('weatherModule.conditions.showerRain');
		case 522:
			return t('weatherModule.conditions.heavyIntensityShowerRain');
		case 531:
			return t('weatherModule.conditions.raggedShowerRain');
		case 600:
			return t('weatherModule.conditions.lightSnow');
		case 601:
			return t('weatherModule.conditions.snow');
		case 602:
			return t('weatherModule.conditions.heavySnow');
		case 611:
			return t('weatherModule.conditions.sleet');
		case 612:
			return t('weatherModule.conditions.lightShowerSleet');
		case 613:
			return t('weatherModule.conditions.showerSleet');
		case 615:
			return t('weatherModule.conditions.lightRainAndSnow');
		case 616:
			return t('weatherModule.conditions.rainAndSnow');
		case 620:
			return t('weatherModule.conditions.lightShowerSnow');
		case 621:
			return t('weatherModule.conditions.showerSnow');
		case 622:
			return t('weatherModule.conditions.heavyShowerSnow');
		case 701:
			return t('weatherModule.conditions.mist');
		case 711:
			return t('weatherModule.conditions.smoke');
		case 721:
			return t('weatherModule.conditions.haze');
		case 731:
			return t('weatherModule.conditions.dust');
		case 741:
			return t('weatherModule.conditions.fog');
		case 751:
			return t('weatherModule.conditions.sand');
		case 761:
			return t('weatherModule.conditions.dust');
		case 762:
			return t('weatherModule.conditions.volcanicAsh');
		case 771:
			return t('weatherModule.conditions.squalls');
		case 781:
			return t('weatherModule.conditions.tornado');
		case 800:
			return t('weatherModule.conditions.clearSky');
		case 801:
			return t('weatherModule.conditions.fewClouds');
		case 802:
			return t('weatherModule.conditions.scatteredClouds');
		case 803:
			return t('weatherModule.conditions.brokenClouds');
		case 804:
			return t('weatherModule.conditions.overcastClouds');
		default:
			return t('weatherModule.conditions.unknown');
	}
});

const isNightTime = (sunrise: Date | string, sunset: Date | string): boolean => {
	const now = new Date();

	const sr = sunrise instanceof Date ? sunrise : new Date(sunrise);
	const ss = sunset instanceof Date ? sunset : new Date(sunset);

	return now <= sr || now >= ss;
};

onBeforeMount(async (): Promise<void> => {
	fetchConfigWeather().catch((error: unknown): void => {
		const err = error as Error;

		throw new WeatherException('Something went wrong', err);
	});

	fetchWeatherDay().catch((error: unknown): void => {
		const err = error as Error;

		throw new WeatherException('Something went wrong', err);
	});
});
</script>
