<template>
	<el-table
		v-loading="props.loading"
		:element-loading-text="t('dashboardModule.texts.dataSources.loadingDataSources')"
		:data="props.items"
		:default-sort="
			typeof props.sortBy !== 'undefined' && props.sortDir !== null
				? { prop: props.sortBy, order: props.sortDir === 'desc' ? 'descending' : 'ascending' }
				: undefined
		"
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
								<icon icon="mdi:database-cog-outline" />
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
								<icon icon="mdi:database-cog-outline" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('dashboardModule.texts.dataSources.noDataSources') }}
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
								<icon icon="mdi:database-cog-outline" />
							</template>
							<template #secondary>
								<icon icon="mdi:filter-multiple" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						<el-text class="block">
							{{ t('dashboardModule.texts.dataSources.noFilteredDataSources') }}
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

							{{ t('dashboardModule.buttons.resetFilters.title') }}
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
			<el-avatar :size="32">
				<icon
					icon="mdi:database-cog-outline"
					class="w[20px] h[20px]"
				/>
			</el-avatar>
		</el-table-column>

		<el-table-column
			:label="t('dashboardModule.table.dataSources.columns.type.title')"
			prop="type"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
		>
			<template #default="scope">
				<data-sources-table-column-plugin
					:data-source="scope.row"
					:filters="innerFilters"
					@filter-by="(value: string, add: boolean) => onFilterBy('type', value, add)"
				/>
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
					class="ml-1!"
					data-test-id="edit-page"
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
					data-test-id="remove-page"
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

import { ElAvatar, ElButton, ElResult, ElTable, ElTableColumn, ElText, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { IconWithChild, useBreakpoints } from '../../../../common';
import type { IDataSourcesFilter } from '../../composables/types';
import type { IDataSource } from '../../store/data-sources.store.types';

import DataSourcesTableColumnPlugin from './data-sources-table-column-plugin.vue';
import type { IDataSourcesTableProps } from './data-sources-table.types';

defineOptions({
	name: 'DataSourcesTable',
});

const props = defineProps<IDataSourcesTableProps>();

const emit = defineEmits<{
	(e: 'detail', id: IDataSource['id']): void;
	(e: 'edit', id: IDataSource['id']): void;
	(e: 'remove', id: IDataSource['id']): void;
	(e: 'reset-filters'): void;
	(e: 'selected-changes', selected: IDataSource[]): void;
	(e: 'update:filters', filters: IDataSourcesFilter): void;
	(e: 'update:sort-by', by: 'type' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const noResults = computed<boolean>((): boolean => props.totalRows === 0);

const innerFilters = useVModel(props, 'filters', emit);

const onSortData = ({ prop, order }: { prop: 'type'; order: 'ascending' | 'descending' | null }): void => {
	emit('update:sort-by', prop);
	emit('update:sort-dir', order === 'descending' ? 'desc' : order === 'ascending' ? 'asc' : null);
};

const onSelectionChange = (selected: IDataSource[]): void => {
	emit('selected-changes', selected);
};

const onRowClick = (row: IDataSource): void => {
	emit('detail', row.id);
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
