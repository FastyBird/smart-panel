<template>
	<!-- Template 1: one card with the filter bar, the table (a row list on phone) and the pagination -->
	<el-card
		shadow="never"
		class="flex flex-col flex-grow min-h-0 overflow-hidden"
		body-class="p-0! flex flex-col flex-grow min-h-0 overflow-hidden"
	>
		<list-filter-bar
			ref="filterBar"
			v-model:search="search"
			:search-placeholder="t('weatherModule.fields.locations.search.placeholder')"
			:quick-filters="quickFilters"
			:active-count="activeCount"
			:selected-count="isPhone ? 0 : selectedItems.length"
			@quick-filter="onQuickFilter"
			@reset="emit('reset-filters')"
			@clear-selection="onClearSelection"
		>
			<template #filters>
				<list-locations-adjust v-model:filters="innerFilters" />
			</template>

			<template #bulk>
				<el-button
					type="danger"
					plain
					size="small"
					data-test-id="bulk-delete"
					@click="emit('bulk-action', 'delete', selectedItems)"
				>
					{{ t('application.bulkActions.delete') }}
				</el-button>
			</template>
		</list-filter-bar>

		<!-- The rows scroll inside the card, so the pagination below stays reachable -->
		<div
			v-if="isPhone"
			class="flex-grow min-h-0 overflow-y-auto"
			data-test-id="locations-row-list-scroll"
		>
			<locations-row-list
				:items="props.items"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				:primary-location-id="props.primaryLocationId"
				:weather-by-location="props.weatherByLocation"
				:temperature-unit="props.temperatureUnit"
				:weather-fetch-completed="props.weatherFetchCompleted"
				:provider-name="providerName"
				@detail="(id: IWeatherLocation['id']) => emit('detail', id)"
				@edit="(id: IWeatherLocation['id']) => emit('edit', id)"
				@remove="(id: IWeatherLocation['id']) => emit('remove', id)"
				@reset-filters="emit('reset-filters')"
			/>
		</div>

		<div
			v-else
			ref="wrapper"
			class="flex-grow min-h-0 overflow-hidden"
		>
			<locations-table
				ref="table"
				v-model:filters="innerFilters"
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				:items="props.items"
				:total-rows="props.totalRows"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				:table-height="tableHeight"
				:primary-location-id="props.primaryLocationId"
				:weather-by-location="props.weatherByLocation"
				:temperature-unit="props.temperatureUnit"
				:weather-fetch-completed="props.weatherFetchCompleted"
				:provider-name="providerName"
				@detail="(id: IWeatherLocation['id']) => emit('detail', id)"
				@edit="(id: IWeatherLocation['id']) => emit('edit', id)"
				@remove="(id: IWeatherLocation['id']) => emit('remove', id)"
				@reset-filters="emit('reset-filters')"
				@selected-changes="(selected: IWeatherLocation[]) => (selectedItems = selected)"
			/>
		</div>

		<div class="flex flex-wrap justify-end w-full box-border px-4 py-2.5 border-t border-t-solid border-light overflow-hidden">
			<el-pagination
				v-model:current-page="paginatePage"
				v-model:page-size="paginateSize"
				:layout="isPhone ? 'prev, pager, next' : 'total, sizes, prev, pager, next'"
				:total="props.allItems.length"
				@size-change="(size: number) => emit('update:paginate-size', size)"
				@current-change="(page: number) => emit('update:paginate-page', page)"
			/>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElPagination } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { ListFilterBar, type ListFilterBarQuickFilter, useSizeClass } from '../../../common';
import { type IWeatherLocationsFilter, useWeatherLocationsPlugins } from '../composables/composables';
import type { IWeatherLocation } from '../store/locations.store.types';

import ListLocationsAdjust from './list-locations-adjust.vue';
import type { IListLocationsProps } from './list-locations.types';
import LocationsRowList from './locations-row-list.vue';
import LocationsTable from './locations-table.vue';

defineOptions({
	name: 'ListLocations',
});

const props = defineProps<IListLocationsProps>();

const emit = defineEmits<{
	(e: 'detail', id: IWeatherLocation['id']): void;
	(e: 'edit', id: IWeatherLocation['id']): void;
	(e: 'remove', id: IWeatherLocation['id']): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: IWeatherLocationsFilter): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', by: 'name' | 'type'): void;
	(e: 'update:sort-dir', dir: 'ascending' | 'descending' | null): void;
	(e: 'bulk-action', action: string, items: IWeatherLocation[]): void;
}>();

const { t } = useI18n();
const { isPhone } = useSizeClass();

const { options: providerOptions } = useWeatherLocationsPlugins();

const innerFilters = useVModel(props, 'filters', emit);

const filterBar = ref<InstanceType<typeof ListFilterBar> | null>(null);
const table = ref<InstanceType<typeof LocationsTable> | null>(null);
const wrapper = ref<HTMLElement | null>(null);

const selectedItems = ref<IWeatherLocation[]>([]);

const sortBy = ref<'name' | 'type'>(props.sortBy);
const sortDir = ref<'ascending' | 'descending' | null>(props.sortDir);
const paginatePage = ref<number>(props.paginatePage);
const paginateSize = ref<number>(props.paginateSize);

const tableHeight = ref<number>(250);

const providerName = (type: string): string => providerOptions.value.find((option) => option.value === type)?.label ?? type;

const search = computed<string>({
	get: (): string => innerFilters.value.search ?? '',
	set: (value: string): void => {
		innerFilters.value.search = value === '' ? undefined : value;
	},
});

// The bar keeps one quick filter, Primary or not; the providers live in the filters drawer
const quickFilters = computed<ListFilterBarQuickFilter[]>((): ListFilterBarQuickFilter[] => [
	{
		id: 'primary',
		label: t('weatherModule.filters.locations.primary.title'),
		options: [
			{ value: 'primary', label: t('weatherModule.filters.locations.primary.values.primary') },
			{ value: 'secondary', label: t('weatherModule.filters.locations.primary.values.secondary') },
		],
		value: innerFilters.value.primary === 'all' ? null : innerFilters.value.primary,
	},
]);

// Active filters, the search excluded: it is visible in the bar on its own
const activeCount = computed<number>((): number => (innerFilters.value.primary !== 'all' ? 1 : 0) + (innerFilters.value.types.length > 0 ? 1 : 0));

const onQuickFilter = (id: string, value: string | null): void => {
	if (id === 'primary') {
		innerFilters.value.primary = (value ?? 'all') as IWeatherLocationsFilter['primary'];
	}
};

const onClearSelection = (): void => {
	table.value?.clearSelection();
	selectedItems.value = [];
};

// The phone app bar's Search action moves focus to the search field
const focusSearch = (): void => {
	filterBar.value?.focusSearch();
};

defineExpose({ focusSearch });

// The table, and its checked rows, go away on phone; a selection kept here would act on rows nobody can see
watch(isPhone, (phone: boolean): void => {
	if (phone) {
		selectedItems.value = [];
	}
});

let observer: ResizeObserver | null = null;

const updateHeight = (): void => {
	if (wrapper.value) {
		tableHeight.value = wrapper.value.clientHeight;
	}
};

// The table is not rendered on phone, so the wrapper comes and goes with the size class
watch(
	wrapper,
	(element: HTMLElement | null, previous: HTMLElement | null | undefined): void => {
		if (observer && previous) {
			observer.unobserve(previous);
		}

		if (!element) {
			return;
		}

		if (observer === null && typeof window !== 'undefined' && 'ResizeObserver' in window) {
			observer = new ResizeObserver(updateHeight);
		}

		observer?.observe(element);

		updateHeight();
	},
	{ flush: 'post' }
);

onBeforeUnmount((): void => {
	observer?.disconnect();
	observer = null;
});

watch(sortBy, (val): void => emit('update:sort-by', val));
watch(sortDir, (val): void => emit('update:sort-dir', val));
watch(
	(): number => props.paginatePage,
	(val: number): void => {
		paginatePage.value = val;
	}
);
watch(
	(): number => props.paginateSize,
	(val: number): void => {
		paginateSize.value = val;
	}
);
</script>
