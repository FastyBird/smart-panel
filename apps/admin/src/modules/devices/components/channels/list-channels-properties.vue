<template>
	<el-card
		shadow="never"
		class="px-1 py-2 shrink-0"
		body-class="p-0!"
	>
		<channels-properties-filter
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
			<channels-properties-table
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
					@size-change="onPaginatePageSize"
					@current-change="onPaginatePage"
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
import type { IChannelsPropertiesFilter } from '../../composables/types';
import type { IChannelProperty } from '../../store/channels.properties.store.types';

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
	(e: 'update:sort-by', dir: 'name' | 'category' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { isMDDevice } = useBreakpoints();

let observer: ResizeObserver | null = null;

const wrapper = ref<HTMLElement | null>(null);
const paginator = ref<HTMLElement | null>(null);

const innerFilters = useVModel(props, 'filters', emit);

const sortBy = ref<'name' | 'category' | undefined>(props.sortBy);

const sortDir = ref<'asc' | 'desc' | null>(props.sortDir);

const paginatePage = ref<number>(props.paginatePage);

const paginateSize = ref<number>(props.paginateSize);

const tableHeight = ref<number>(250);

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
	(): 'name' | 'category' | undefined => sortBy.value,
	(val: 'name' | 'category' | undefined): void => {
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
	(): 'name' | 'category' | undefined => props.sortBy,
	(val: 'name' | 'category' | undefined): void => {
		sortBy.value = val;
	}
);
</script>
