<template>
	<el-table
		v-loading="props.loading"
		:element-loading-text="t('dashboardModule.texts.pages.loadingPages')"
		:data="props.items"
		:default-sort="{ prop: props.sortBy, order: props.sortDir || 'ascending' }"
		table-layout="fixed"
		class="flex-grow"
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
								<icon icon="mdi:monitor-dashboard" />
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
								<icon icon="mdi:monitor-dashboard" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('dashboardModule.texts.pages.noPages') }}
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
								<icon icon="mdi:monitor-dashboard" />
							</template>
							<template #secondary>
								<icon icon="mdi:filter-multiple" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						<el-text class="block">
							{{ t('dashboardModule.texts.pages.noFilteredPages') }}
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
			<template #default="scope">
				<pages-table-column-icon :page="scope.row" />
			</template>
		</el-table-column>

		<el-table-column
			:label="t('dashboardModule.table.pages.columns.title.title')"
			prop="title"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="200"
			class-name="py-0!"
		>
			<template #default="scope">
				{{ scope.row.title }}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('dashboardModule.table.pages.columns.type.title')"
			prop="type"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="200"
		>
			<template #default="scope">
				<pages-table-column-plugin
					:page="scope.row"
					:filters="innerFilters"
					@filter-by="(value: string, add: boolean) => onFilterBy('type', value, add)"
				/>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('dashboardModule.table.pages.columns.order.title')"
			prop="order"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			align="center"
			:width="200"
		>
			<template #default="scope">
				{{ scope.row.order }}
			</template>
		</el-table-column>

		<el-table-column
			:width="280"
			align="right"
		>
			<template #default="scope">
				<pages-table-column-actions
					:page="scope.row"
					@detail="(id: IPage['id']) => emit('detail', id)"
					@edit="(id: IPage['id']) => emit('edit', id)"
					@remove="(id: IPage['id']) => emit('remove', id)"
				/>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElResult, ElTable, ElTableColumn, ElText, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { IconWithChild, useBreakpoints } from '../../../../common';
import type { IPagesFilter } from '../../composables/types';
import type { IPage } from '../../store/pages.store.types';

import PagesTableColumnActions from './pages-table-column-actions.vue';
import PagesTableColumnIcon from './pages-table-column-icon.vue';
import PagesTableColumnPlugin from './pages-table-column-plugin.vue';
import type { IPagesTableProps } from './pages-table.types';

defineOptions({
	name: 'PagesTable',
});

const props = defineProps<IPagesTableProps>();

const emit = defineEmits<{
	(e: 'detail', id: IPage['id']): void;
	(e: 'edit', id: IPage['id']): void;
	(e: 'remove', id: IPage['id']): void;
	(e: 'reset-filters'): void;
	(e: 'selected-changes', selected: IPage[]): void;
	(e: 'update:filters', filters: IPagesFilter): void;
	(e: 'update:sort-by', by: 'title' | 'type' | 'order'): void;
	(e: 'update:sort-dir', dir: 'ascending' | 'descending' | null): void;
}>();

const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const noResults = computed<boolean>((): boolean => props.totalRows === 0);

const innerFilters = useVModel(props, 'filters', emit);

const onSortData = ({ prop, order }: { prop: 'title' | 'type' | 'order'; order: 'ascending' | 'descending' | null }): void => {
	emit('update:sort-by', prop);
	emit('update:sort-dir', order);
};

const onSelectionChange = (selected: IPage[]): void => {
	emit('selected-changes', selected);
};

const onRowClick = (row: IPage): void => {
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
