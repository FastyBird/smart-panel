<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:weather-partly-cloudy"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('weatherModule.headings.weather') }}
		</template>

		<template #subtitle>
			{{ t('weatherModule.subHeadings.weather') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="router.push('/')"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>

		<span class="uppercase">{{ t('application.buttons.home.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('weatherModule.headings.weather')"
		:sub-heading="t('weatherModule.subHeadings.weather')"
		icon="mdi:weather-partly-cloudy"
	/>

	<router-view class="p-2" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router';

import { ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { RouteNames } from '../weather.constants';

defineOptions({
	name: 'LayoutWeather',
});

const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const breadcrumbs = computed<{ label: string; route: RouteLocationRaw }[]>((): { label: string; route: RouteLocationRaw }[] => {
	const items = [
		{
			label: t('weatherModule.breadcrumbs.weather'),
			route: router.resolve({ name: RouteNames.WEATHER }),
		},
	];

	if (route.name === RouteNames.WEATHER_LOCATIONS) {
		items.push({
			label: t('weatherModule.breadcrumbs.locations'),
			route: router.resolve({ name: RouteNames.WEATHER_LOCATIONS }),
		});
	}

	if (route.name === RouteNames.WEATHER_LOCATION_ADD) {
		items.push({
			label: t('weatherModule.breadcrumbs.locations'),
			route: router.resolve({ name: RouteNames.WEATHER_LOCATIONS }),
		});
		items.push({
			label: t('weatherModule.breadcrumbs.addLocation'),
			route: router.resolve({ name: RouteNames.WEATHER_LOCATION_ADD }),
		});
	}

	if (route.name === RouteNames.WEATHER_LOCATION_EDIT) {
		items.push({
			label: t('weatherModule.breadcrumbs.locations'),
			route: router.resolve({ name: RouteNames.WEATHER_LOCATIONS }),
		});
		items.push({
			label: t('weatherModule.breadcrumbs.editLocation'),
			route: route,
		});
	}

	return items;
});
</script>
