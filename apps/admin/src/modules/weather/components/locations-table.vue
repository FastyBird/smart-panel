<template>
	<el-table
		v-loading="props.loading"
		:element-loading-text="t('weatherModule.texts.misc.loadingLocations')"
		:data="props.items"
		:default-sort="{ prop: props.sortBy, order: props.sortDir || 'ascending' }"
		table-layout="fixed"
		row-key="id"
		class="flex-grow"
		:style="{ maxHeight: tableHeight + 'px' }"
		:max-height="tableHeight"
		@sort-change="onSortData"
		@selection-change="onSelectionChange"
		@row-click="onRowClick"
	>
		<template #empty>
			<div
				v-if="props.loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:map-marker-multiple" />
							</template>
							<template #secondary>
								<icon icon="mdi:database-refresh" />
							</template>
						</icon-with-child>
					</template>
				</el-result>
			</div>

			<div
				v-else-if="noResults && !props.loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:map-marker-multiple" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('weatherModule.texts.misc.noLocations') }}
					</template>
				</el-result>
			</div>

			<div
				v-else-if="props.filtersActive && !props.loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:map-marker-multiple" />
							</template>
							<template #secondary>
								<icon icon="mdi:filter-multiple" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						<el-text class="block">
							{{ t('weatherModule.texts.misc.noFilteredLocations') }}
						</el-text>

						<el-button
							type="primary"
							plain
							class="mt-4"
							@click="emit('reset-filters')"
						>
							<template #icon>
								<icon icon="mdi:filter-off" />
							</template>

							{{ t('weatherModule.buttons.resetFilters.title') }}
						</el-button>
					</template>
				</el-result>
			</div>
		</template>

		<el-table-column
			v-if="isMDDevice"
			type="selection"
			:width="30"
		/>

		<el-table-column
			:width="60"
			align="center"
		>
			<template #default>
				<el-avatar
					:size="32"
					class="bg-primary-light!"
				>
					<icon
						icon="mdi:map-marker"
						class="w-[20px] h-[20px]"
					/>
				</el-avatar>
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
				{{ scope.row.name }}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('weatherModule.table.columns.weather.title')"
			:width="120"
			align="center"
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
			:label="t('weatherModule.table.columns.type.title')"
			prop="type"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="200"
		>
			<template #default="scope">
				<locations-table-column-plugin
					:location="scope.row"
					:filters="innerFilters"
					@filter-by="(value: string, add: boolean) => onFilterBy('type', value, add)"
				/>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('weatherModule.table.columns.primary.title')"
			:width="100"
			align="center"
		>
			<template #default="scope">
				<el-tag
					v-if="scope.row.id === props.primaryLocationId"
					type="success"
					size="small"
				>
					{{ t('weatherModule.table.columns.primary.values.yes') }}
				</el-tag>
				<el-tag
					v-else
					type="info"
					size="small"
				>
					{{ t('weatherModule.table.columns.primary.values.no') }}
				</el-tag>
			</template>
		</el-table-column>

		<el-table-column
			:width="180"
			align="right"
		>
			<template #default="scope">
				<el-button
					size="small"
					plain
					data-test-id="detail-location"
					@click.stop="emit('detail', scope.row.id)"
				>
					<template #icon>
						<icon icon="mdi:file-search-outline" />
					</template>

					{{ t('weatherModule.buttons.detail.title') }}
				</el-button>
				<el-button
					size="small"
					plain
					class="ml-1!"
					data-test-id="edit-location"
					@click.stop="emit('edit', scope.row.id)"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
				</el-button>
				<el-button
					size="small"
					type="warning"
					plain
					class="ml-1!"
					data-test-id="remove-location"
					@click.stop="emit('remove', scope.row.id)"
				>
					<template #icon>
						<icon icon="mdi:trash" />
					</template>
				</el-button>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAvatar, ElButton, ElResult, ElTable, ElTableColumn, ElTag, ElText, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { IconWithChild, useBreakpoints } from '../../../common';
import type { IWeatherLocationsFilter } from '../composables/types';
import type { IWeatherLocation } from '../store/locations.store.types';

import LocationsTableColumnPlugin from './locations-table-column-plugin.vue';
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

const { isMDDevice } = useBreakpoints();

const innerFilters = useVModel(props, 'filters', emit);

const noResults = computed<boolean>((): boolean => props.totalRows === 0);

const onSortData = ({
	prop,
	order,
}: {
	prop: 'name' | 'type';
	order: 'ascending' | 'descending' | null;
}): void => {
	emit('update:sort-by', prop);
	emit('update:sort-dir', order);
};

const onRowClick = (row: IWeatherLocation): void => {
	emit('detail', row.id);
};

const onSelectionChange = (selected: IWeatherLocation[]): void => {
	emit('selected-changes', selected);
};

const onFilterBy = (column: string, data: string, add?: boolean): void => {
	if (column === 'type') {
		let filteredTypes = innerFilters.value.types;

		if (add === true) {
			filteredTypes.push(data);
		} else {
			filteredTypes = innerFilters.value.types.filter((item) => item !== data);
		}

		innerFilters.value.types = Array.from(new Set(filteredTypes));
	}
};
</script>
