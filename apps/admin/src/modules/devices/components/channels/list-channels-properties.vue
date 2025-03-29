<template>
	<div class="h-full w-full flex flex-col">
		<el-card
			shadow="never"
			class="px-1 py-2 mt-2"
			body-class="p-0!"
		>
			<channels-properties-filter
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
			<channels-properties-table
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
					@size-change="onPaginatePageSize"
					@current-change="onPaginatePage"
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
import type { IChannelsPropertiesFilter } from '../../composables';
import type { IChannelProperty } from '../../store';

import ChannelsPropertiesFilter from './channels-properties-filter.vue';
import ChannelsPropertiesTable from './channels-properties-table.vue';
import { type IListChannelsPropertiesProps } from './list-channels-properties.types';

defineOptions({
	name: 'ListChannelsProperties',
});

const props = defineProps<IListChannelsPropertiesProps>();

const emit = defineEmits<{
	(e: 'detail', id: IChannelProperty['id']): void;
	(e: 'edit', id: IChannelProperty['id']): void;
	(e: 'remove', id: IChannelProperty['id']): void;
	(e: 'adjust-list'): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: IChannelsPropertiesFilter): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', dir: 'name' | 'category'): void;
	(e: 'update:sort-dir', dir: 'ascending' | 'descending' | null): void;
}>();

const { isMDDevice } = useBreakpoints();

const innerFilters = useVModel(props, 'filters', emit);

const sortBy = ref<'name' | 'category'>(props.sortBy);

const sortDir = ref<'ascending' | 'descending' | null>(props.sortDir);

const paginatePage = ref<number>(props.paginatePage);

const paginateSize = ref<number>(props.paginateSize);

const onDetail = (id: IChannelProperty['id']): void => {
	emit('detail', id);
};

const onEdit = (id: IChannelProperty['id']): void => {
	emit('edit', id);
};

const onRemove = (id: IChannelProperty['id']): void => {
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

watch(
	(): 'name' | 'category' => sortBy.value,
	(val: 'name' | 'category'): void => {
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
	(): 'name' | 'category' => props.sortBy,
	(val: 'name' | 'category'): void => {
		sortBy.value = val;
	}
);
</script>
