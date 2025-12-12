<template>
	<el-card>
		<template #header>
			<div class="flex items-center justify-between">
				<span class="font-semibold">{{ t('weatherModule.headings.locations.add') }}</span>
			</div>
		</template>

		<openweathermap-location-form
			:id="newLocationId"
			@added="onLocationAdded"
			@cancel="onCancel"
		/>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { v4 as uuid } from 'uuid';

import { ElCard } from 'element-plus';

import OpenweathermapLocationForm from '../components/openweathermap-location-form.vue';
import { RouteNames } from '../weather.constants';

defineOptions({
	name: 'ViewLocationAdd',
});

const router = useRouter();
const { t } = useI18n();

const newLocationId = computed(() => uuid());

const onCancel = (): void => {
	router.push({ name: RouteNames.WEATHER_LOCATIONS });
};

const onLocationAdded = (): void => {
	router.push({ name: RouteNames.WEATHER_LOCATIONS });
};
</script>
