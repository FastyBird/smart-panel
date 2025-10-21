<template>
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

	<div
		ref="wrapper"
		class="flex-grow overflow-hidden"
	>
		<el-card
			shadow="never"
			class="mt-2 max-h-full"
			body-class="p-0! max-h-full overflow-hidden flex flex-col"
		>
			<data-sources-table
				v-model:filters="innerFilters"
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				:items="props.items"
				:total-rows="props.totalRows"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				:table-height="tableHeight"
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
					@size-change="onPaginateDataSourceSize"
					@current-change="onPaginateDataSource"
				/>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

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
	(e: 'update:sort-by', dir: 'type' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { isMDDevice } = useBreakpoints();

let observer: ResizeObserver | null = null;

const wrapper = ref<HTMLElement | null>(null);
const paginator = ref<HTMLElement | null>(null);

const innerFilters = useVModel(props, 'filters', emit);

const sortBy = ref<'type' | undefined>(props.sortBy);

const sortDir = ref<'asc' | 'desc' | null>(props.sortDir);

const paginatePage = ref<number>(props.paginatePage);

const paginateSize = ref<number>(props.paginateSize);

const tableHeight = ref<number>(250);

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
	(): 'type' | undefined => sortBy.value,
	(val: 'type' | undefined): void => {
		emit('update:sort-by', val);
	}
);

watch(
	(): 'asc' | 'desc' | null => sortDir.value,
	(val: 'asc' | 'desc' | null): void => {
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
	(): 'asc' | 'desc' | null => props.sortDir,
	(val: 'asc' | 'desc' | null): void => {
		sortDir.value = val;
	}
);

watch(
	(): 'type' | undefined => props.sortBy,
	(val: 'type' | undefined): void => {
		sortBy.value = val;
	}
);
</script>
