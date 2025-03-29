<template>
	<div class="h-full w-full flex flex-col">
		<el-card
			shadow="never"
			class="px-1 py-2 mt-2"
			body-class="p-0!"
		>
			<channels-filter
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
			<channels-table
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
import type { IChannelsFilter } from '../../composables';
import type { IChannel } from '../../store';

import ChannelsFilter from './channels-filter.vue';
import ChannelsTable from './channels-table.vue';
import { type IListChannelsProps } from './list-channels.types';

defineOptions({
	name: 'ListChannels',
});

const props = defineProps<IListChannelsProps>();

const emit = defineEmits<{
	(e: 'detail', id: IChannel['id']): void;
	(e: 'edit', id: IChannel['id']): void;
	(e: 'remove', id: IChannel['id']): void;
	(e: 'adjust-list'): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: IChannelsFilter): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', dir: 'name' | 'description' | 'category'): void;
	(e: 'update:sort-dir', dir: 'ascending' | 'descending' | null): void;
}>();

const { isMDDevice } = useBreakpoints();

const innerFilters = useVModel(props, 'filters', emit);

const sortBy = ref<'name' | 'description' | 'category'>(props.sortBy);

const sortDir = ref<'ascending' | 'descending' | null>(props.sortDir);

const paginatePage = ref<number>(props.paginatePage);

const paginateSize = ref<number>(props.paginateSize);

const onDetail = (id: IChannel['id']): void => {
	emit('detail', id);
};

const onEdit = (id: IChannel['id']): void => {
	emit('edit', id);
};

const onRemove = (id: IChannel['id']): void => {
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
	(): 'name' | 'description' | 'category' => sortBy.value,
	(val: 'name' | 'description' | 'category'): void => {
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
	(): 'name' | 'description' | 'category' => props.sortBy,
	(val: 'name' | 'description' | 'category'): void => {
		sortBy.value = val;
	}
);
</script>
