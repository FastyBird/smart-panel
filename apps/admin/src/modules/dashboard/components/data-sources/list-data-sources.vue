<template>
	<div class="h-full w-full flex flex-col">
		<el-card
			shadow="never"
			class="px-1 py-2 mt-2"
			body-class="p-0!"
		>
			<data-sources-filter
				v-model:filters="innerFilters"
				:filters-active="props.filtersActive"
				@reset-filters="emit('reset-filters')"
				@adjust-list="emit('adjust-list')"
			/>
		</el-card>

		<el-card
			shadow="never"
			class="mt-2"
			body-class="p-0!"
		>
			<data-sources-table
				v-model:filters="innerFilters"
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				:items="props.items"
				:total-rows="props.totalRows"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				@detail="onDetail"
				@edit="onEdit"
				@remove="onRemove"
				@reset-filters="onResetFilters"
			/>
			<div class="flex justify-center w-full py-4">
				<el-pagination
					v-model:current-page="paginatePage"
					v-model:page-size="paginateSize"
					:layout="isMDDevice ? 'total, sizes, prev, pager, next, jumper' : 'total, sizes, prev, pager, next'"
					:total="props.allItems.length"
					@size-change="onPaginateDataSourceSize"
					@current-change="onPaginateDataSource"
				/>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

import { ElCard, ElPagination } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { useBreakpoints } from '../../../../common';
import type { IDataSourcesFilter } from '../../composables/types';
import type { IDataSource } from '../../store/data-sources.store.types';

import DataSourcesFilter from './data-sources-filter.vue';
import DataSourcesTable from './data-sources-table.vue';
import { type IListDataSourcesProps } from './list-data-sources.types';

defineOptions({
	name: 'ListDataSources',
});

const props = defineProps<IListDataSourcesProps>();

const emit = defineEmits<{
	(e: 'detail', id: IDataSource['id']): void;
	(e: 'edit', id: IDataSource['id']): void;
	(e: 'remove', id: IDataSource['id']): void;
	(e: 'adjust-list'): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: IDataSourcesFilter): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', dataSource: number): void;
	(e: 'update:sort-by', dir: 'title' | 'type' | 'order'): void;
	(e: 'update:sort-dir', dir: 'ascending' | 'descending' | null): void;
}>();

const { isMDDevice } = useBreakpoints();

const innerFilters = useVModel(props, 'filters', emit);

const sortBy = ref<'title' | 'type' | 'order'>(props.sortBy);

const sortDir = ref<'ascending' | 'descending' | null>(props.sortDir);

const paginatePage = ref<number>(props.paginatePage);

const paginateSize = ref<number>(props.paginateSize);

const onDetail = (id: IDataSource['id']): void => {
	emit('detail', id);
};

const onEdit = (id: IDataSource['id']): void => {
	emit('edit', id);
};

const onRemove = (id: IDataSource['id']): void => {
	emit('remove', id);
};

const onResetFilters = (): void => {
	emit('reset-filters');
};

const onPaginateDataSourceSize = (size: number): void => {
	emit('update:paginate-page', size);
};

const onPaginateDataSource = (page: number): void => {
	emit('update:paginate-page', page);
};

watch(
	(): 'title' | 'type' | 'order' => sortBy.value,
	(val: 'title' | 'type' | 'order'): void => {
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
	(): 'ascending' | 'descending' | null => props.sortDir,
	(val: 'ascending' | 'descending' | null): void => {
		sortDir.value = val;
	}
);

watch(
	(): 'title' | 'type' | 'order' => props.sortBy,
	(val: 'title' | 'type' | 'order'): void => {
		sortBy.value = val;
	}
);
</script>
