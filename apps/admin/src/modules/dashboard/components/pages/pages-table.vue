<template>
	<el-table
		ref="tableEl"
		v-loading="props.loading && props.items.length > 0"
		:element-loading-text="t('dashboardModule.texts.pages.loadingPages')"
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
			<pages-empty
				:loading="props.loading"
				:filters-active="props.filtersActive"
				@reset-filters="emit('reset-filters')"
			/>
		</template>

		<el-table-column
			type="selection"
			fixed="left"
			:width="40"
		/>

		<el-table-column
			:width="56"
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
		>
			<template #default="scope">
				<span class="block text-card-title truncate">{{ scope.row.title }}</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('dashboardModule.table.pages.columns.type.title')"
			prop="type"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="180"
		>
			<template #default="scope">
				<pages-table-column-plugin :page="scope.row" />
			</template>
		</el-table-column>

		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('dashboardModule.table.pages.columns.display.title')"
			prop="display"
			:width="200"
		>
			<template #default="scope">
				<table-column-display :row="scope.row" />
			</template>
		</el-table-column>

		<el-table-column
			:label="t('dashboardModule.table.pages.columns.order.title')"
			prop="order"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			align="center"
			:width="90"
		>
			<template #default="scope">
				<span class="text-body">{{ scope.row.order }}</span>
			</template>
		</el-table-column>

		<el-table-column
			:width="isTabletPortrait ? 96 : 210"
			align="right"
			fixed="right"
		>
			<template #default="scope">
				<pages-row-actions
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
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElTable, ElTableColumn, vLoading } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { useSizeClass } from '../../../../common';
import { TableColumnDisplay } from '../../../displays';
import type { IPagesFilter } from '../../composables/types';
import type { IPage } from '../../store/pages.store.types';

import PagesEmpty from './pages-empty.vue';
import PagesRowActions from './pages-row-actions.vue';
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
	(e: 'update:sort-by', by: 'title' | 'type' | 'order' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { t } = useI18n();

// Tablet portrait keeps the title, type and order; the displays a page shows on are on its detail page
const { isTabletPortrait } = useSizeClass();

const tableEl = ref<InstanceType<typeof ElTable> | null>(null);

const tableHeight = computed<number>((): number => props.tableHeight ?? 400);

useVModel(props, 'filters', emit);

const onSortData = ({ prop, order }: { prop: 'title' | 'type' | 'order'; order: 'ascending' | 'descending' | null }): void => {
	emit('update:sort-by', order === null ? undefined : prop);
	emit('update:sort-dir', order === 'descending' ? 'desc' : order === 'ascending' ? 'asc' : null);
};

const onSelectionChange = (selected: IPage[]): void => {
	emit('selected-changes', selected);
};

const onRowClick = (row: IPage): void => {
	emit('detail', row.id);
};

// The filter bar's Clear selection
const clearSelection = (): void => {
	tableEl.value?.clearSelection();
};

defineExpose({ clearSelection });
</script>
