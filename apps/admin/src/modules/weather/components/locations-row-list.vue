<template>
	<locations-empty
		v-if="props.items.length === 0"
		:loading="props.loading"
		:filters-active="props.filtersActive"
		@reset-filters="emit('reset-filters')"
	/>

	<ul
		v-else
		class="m-0 p-0 list-none"
		data-test-id="locations-row-list"
	>
		<!-- Phone (template 1): a list of rows instead of the table; a row opens the location -->
		<li
			v-for="location in props.items"
			:key="location.id"
			class="flex items-center gap-2 min-h-14 px-3 py-2 border-b border-b-solid border-light last:border-b-0"
		>
			<button
				class="flex items-center gap-3 flex-1 min-w-0 p-0 border-0 bg-transparent text-left font-inherit text-inherit cursor-pointer"
				type="button"
				data-test-id="locations-row"
				@click="emit('detail', location.id)"
			>
				<icon
					icon="mdi:map-marker"
					width="24"
					height="24"
					class="shrink-0 text-secondary"
					aria-hidden="true"
				/>
				<span class="flex flex-col items-start gap-0.5 flex-1 min-w-0">
					<span class="max-w-full text-card-title truncate">{{ location.name }}</span>
					<span class="max-w-full text-help truncate">{{ providerName(location.type) }}</span>
					<status-tag
						v-if="location.id === props.primaryLocationId"
						status="ok"
						:label="t('weatherModule.table.columns.primary.values.yes')"
					/>
				</span>

				<locations-table-column-weather
					:location-id="location.id"
					:weather-by-location="props.weatherByLocation"
					:temperature-unit="props.temperatureUnit"
					:fetch-completed="props.weatherFetchCompleted"
				/>
			</button>

			<locations-row-actions
				:location="location"
				:primary="location.id === props.primaryLocationId"
				@detail="(id: IWeatherLocation['id']) => emit('detail', id)"
				@edit="(id: IWeatherLocation['id']) => emit('edit', id)"
				@remove="(id: IWeatherLocation['id']) => emit('remove', id)"
			/>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';

import { StatusTag } from '../../../common';
import type { ILocationWeatherData } from '../composables/useLocationsWeather';
import type { IWeatherLocation } from '../store/locations.store.types';

import LocationsEmpty from './locations-empty.vue';
import LocationsRowActions from './locations-row-actions.vue';
import LocationsTableColumnWeather from './locations-table-column-weather.vue';

defineOptions({
	name: 'LocationsRowList',
});

const props = defineProps<{
	items: IWeatherLocation[];
	loading: boolean;
	filtersActive: boolean;
	primaryLocationId: string | null;
	weatherByLocation: Record<string, ILocationWeatherData>;
	temperatureUnit: 'celsius' | 'fahrenheit';
	weatherFetchCompleted: boolean;
	providerName: (type: string) => string;
}>();

const emit = defineEmits<{
	(e: 'detail', id: IWeatherLocation['id']): void;
	(e: 'edit', id: IWeatherLocation['id']): void;
	(e: 'remove', id: IWeatherLocation['id']): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();
</script>
