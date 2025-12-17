<template>
	<div class="h-full w-full flex flex-col">
		<el-card
			shadow="never"
			class="px-1 py-2 mt-2"
			body-class="p-0!"
		>
			<locations-filter
				v-model:filters="innerFilters"
				:filters-active="props.filtersActive"
				@reset-filters="emit('reset-filters')"
				@adjust-list="emit('adjust-list')"
			/>
		</el-card>

		<div
			ref="wrapper"
			class="flex-grow overflow-hidden"
		>
			<el-card
				shadow="never"
				class="mt-2 max-h-full"
				body-class="p-0! max-h-full overflow-hidden flex flex-col"
			>
				<locations-table
					v-model:sort-by="sortBy"
					v-model:sort-dir="sortDir"
					v-model:filters="innerFilters"
					:items="props.items"
					:total-rows="props.totalRows"
					:loading="props.loading"
					:filters-active="props.filtersActive"
					:table-height="tableHeight"
					:primary-location-id="props.primaryLocationId"
					:weather-by-location="props.weatherByLocation"
					:temperature-unit="props.temperatureUnit"
					:weather-fetch-completed="props.weatherFetchCompleted"
					@detail="onDetail"
					@edit="onEdit"
					@remove="onRemove"
					@reset-filters="onResetFilters"
				/>

				<div
					ref="paginator"
					class="flex justify-center w-full py-4"
				>
					<el-pagination
						v-model:current-page="paginatePage"
						v-model:page-size="paginateSize"
						:layout="isMDDevice ? 'total, sizes, prev, pager, next, jumper' : 'total, sizes, prev, pager, next'"
						:total="props.allItems.length"
						@size-change="onPaginatePageSize"
						@current-change="onPaginatePage"
					/>
				</div>
			</el-card>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { ElCard, ElPagination } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { useBreakpoints } from '../../../common';
import type { IWeatherLocationsFilter } from '../composables/types';
import type { IWeatherLocation } from '../store/locations.store.types';

import LocationsFilter from './locations-filter.vue';
import LocationsTable from './locations-table.vue';
import type { IListLocationsProps } from './list-locations.types';

defineOptions({
	name: 'ListLocations',
});

const props = defineProps<IListLocationsProps>();

const emit = defineEmits<{
	(e: 'detail', id: IWeatherLocation['id']): void;
	(e: 'edit', id: IWeatherLocation['id']): void;
	(e: 'remove', id: IWeatherLocation['id']): void;
	(e: 'reset-filters'): void;
	(e: 'adjust-list'): void;
	(e: 'update:filters', filters: IWeatherLocationsFilter): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', dir: 'name' | 'type'): void;
	(e: 'update:sort-dir', dir: 'ascending' | 'descending' | null): void;
}>();

const { isMDDevice } = useBreakpoints();

let observer: ResizeObserver | null = null;

const wrapper = ref<HTMLElement | null>(null);
const paginator = ref<HTMLElement | null>(null);

const innerFilters = useVModel(props, 'filters', emit);

const sortBy = ref<'name' | 'type'>(props.sortBy);

const sortDir = ref<'ascending' | 'descending' | null>(props.sortDir);

const paginatePage = ref<number>(props.paginatePage);

const paginateSize = ref<number>(props.paginateSize);

const tableHeight = ref<number>(250);

const onDetail = (id: IWeatherLocation['id']): void => {
	emit('detail', id);
};

const onEdit = (id: IWeatherLocation['id']): void => {
	emit('edit', id);
};

const onRemove = (id: IWeatherLocation['id']): void => {
	emit('remove', id);
};

const onResetFilters = (): void => {
	emit('reset-filters');
};

const onPaginatePageSize = (size: number): void => {
	emit('update:paginate-size', size);
};

const onPaginatePage = (page: number): void => {
	emit('update:paginate-page', page);
};

onMounted((): void => {
	if (!wrapper.value) {
		return;
	}

	const updateHeight = () => {
		tableHeight.value = wrapper.value!.clientHeight - paginator.value!.clientHeight;
	};

	if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
		observer = new ResizeObserver(updateHeight);
		observer.observe(wrapper.value);
	}

	updateHeight();
});

onBeforeUnmount((): void => {
	if (observer && wrapper.value) {
		observer.unobserve(wrapper.value);
	}
});

watch(
	(): 'name' | 'type' => sortBy.value,
	(val: 'name' | 'type'): void => {
		emit('update:sort-by', val);
	}
);

watch(
	(): 'ascending' | 'descending' | null => sortDir.value,
	(val: 'ascending' | 'descending' | null): void => {
		emit('update:sort-dir', val);
	}
);

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

watch(
	(): 'ascending' | 'descending' | null => props.sortDir,
	(val: 'ascending' | 'descending' | null): void => {
		sortDir.value = val;
	}
);

watch(
	(): 'name' | 'type' => props.sortBy,
	(val: 'name' | 'type'): void => {
		sortBy.value = val;
	}
);
</script>
