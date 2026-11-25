<template>
	<el-table
		ref="tableEl"
		v-loading="props.loading && props.items.length > 0"
		:element-loading-text="t('weatherModule.texts.misc.loadingLocations')"
		:data="props.items"
		:default-sort="props.sortDir !== null ? { prop: props.sortBy, order: props.sortDir } : undefined"
		table-layout="fixed"
		row-key="id"
		class="flex-grow"
		:style="{ maxHeight: props.tableHeight + 'px' }"
		:max-height="props.tableHeight"
		@sort-change="onSortData"
		@selection-change="onSelectionChange"
		@row-click="onRowClick"
	>
		<template #empty>
			<locations-empty
				:loading="props.loading"
				:filters-active="props.filtersActive"
				@reset-filters="emit('reset-filters')"
			/>
		</template>

		<el-table-column
			type="selection"
			fixed="left"
			:width="40"
			:selectable="isSelectable"
		/>

		<el-table-column
			:width="56"
			align="center"
		>
			<template #default>
				<icon
					icon="mdi:map-marker"
					width="24"
					height="24"
					class="text-secondary"
					aria-hidden="true"
				/>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('weatherModule.table.columns.name.title')"
			prop="name"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="200"
		>
			<template #default="scope">
				<span class="block text-card-title truncate">{{ scope.row.name }}</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('weatherModule.table.columns.weather.title')"
			:width="120"
		>
			<template #default="scope">
				<locations-table-column-weather
					:location-id="scope.row.id"
					:weather-by-location="props.weatherByLocation"
					:temperature-unit="props.temperatureUnit"
					:fetch-completed="props.weatherFetchCompleted"
				/>
			</template>
		</el-table-column>

		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('weatherModule.table.columns.type.title')"
			prop="type"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="180"
		>
			<template #default="scope">
				<span class="block text-body truncate">{{ props.providerName(scope.row.type) }}</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('weatherModule.table.columns.primary.title')"
			:width="110"
		>
			<template #default="scope">
				<status-tag
					v-if="scope.row.id === props.primaryLocationId"
					status="ok"
					:label="t('weatherModule.table.columns.primary.values.yes')"
				/>
				<span
					v-else
					class="text-help"
				>
					—
				</span>
			</template>
		</el-table-column>

		<el-table-column
			:width="96"
			align="right"
			fixed="right"
		>
			<template #default="scope">
				<locations-row-actions
					:location="scope.row"
					:primary="scope.row.id === props.primaryLocationId"
					@detail="(id: IWeatherLocation['id']) => emit('detail', id)"
					@edit="(id: IWeatherLocation['id']) => emit('edit', id)"
					@remove="(id: IWeatherLocation['id']) => emit('remove', id)"
				/>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElTable, ElTableColumn, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { StatusTag, useSizeClass } from '../../../common';
import type { IWeatherLocationsFilter } from '../composables/types';
import type { IWeatherLocation } from '../store/locations.store.types';

import LocationsEmpty from './locations-empty.vue';
import LocationsRowActions from './locations-row-actions.vue';
import LocationsTableColumnWeather from './locations-table-column-weather.vue';
import type { ILocationsTableProps } from './locations-table.types';

defineOptions({
	name: 'LocationsTable',
});

const props = defineProps<ILocationsTableProps>();

const emit = defineEmits<{
	(e: 'detail', id: IWeatherLocation['id']): void;
	(e: 'edit', id: IWeatherLocation['id']): void;
	(e: 'remove', id: IWeatherLocation['id']): void;
	(e: 'reset-filters'): void;
	(e: 'selected-changes', selected: IWeatherLocation[]): void;
	(e: 'update:sort-by', by: 'name' | 'type'): void;
	(e: 'update:sort-dir', dir: 'ascending' | 'descending' | null): void;
	(e: 'update:filters', filters: IWeatherLocationsFilter): void;
}>();

const { t } = useI18n();

// Tablet portrait keeps the name, the weather and the primary tag; the provider stays on the detail page
const { isTabletPortrait } = useSizeClass();

const tableEl = ref<InstanceType<typeof ElTable> | null>(null);

/**
 * The backend refuses to delete the primary location - it says to reassign the
 * primary first - so offering it for selection only produces a failure the
 * operator can do nothing about, and "select all" would always report one.
 */
const isSelectable = (row: IWeatherLocation): boolean => row.id !== props.primaryLocationId;

useVModel(props, 'filters', emit);

const onSortData = ({ prop, order }: { prop: 'name' | 'type'; order: 'ascending' | 'descending' | null }): void => {
	emit('update:sort-by', prop);
	emit('update:sort-dir', order);
};

const onRowClick = (row: IWeatherLocation): void => {
	emit('detail', row.id);
};

const onSelectionChange = (selected: IWeatherLocation[]): void => {
	emit('selected-changes', selected);
};

// The filter bar's Clear selection
const clearSelection = (): void => {
	tableEl.value?.clearSelection();
};

defineExpose({ clearSelection });
</script>
