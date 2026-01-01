<template>
	<el-card
		shadow="never"
		class="px-1 py-2 shrink-0"
		body-class="p-0!"
	>
		<scenes-filter
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
			class="max-h-full flex flex-col overflow-hidden box-border"
			body-class="p-0! max-h-full overflow-hidden flex flex-col"
		>
			<scenes-table
				v-model:filters="innerFilters"
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				:items="props.items"
				:total-rows="props.totalRows"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				:table-height="tableHeight"
				:triggering="props.triggering"
				@edit="onEdit"
				@remove="onRemove"
				@trigger="onTrigger"
				@reset-filters="onResetFilters"
				@selected-changes="onSelectedChanges"
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
import type { IScenesFilter } from '../../composables/types';
import type { IScene } from '../../store/scenes.store.types';

import ScenesFilter from './scenes-filter.vue';
import ScenesTable from './scenes-table.vue';
import { type IListScenesProps } from './list-scenes.types';

defineOptions({
	name: 'ListScenes',
});

const props = defineProps<IListScenesProps>();

const emit = defineEmits<{
	(e: 'edit', id: IScene['id']): void;
	(e: 'remove', id: IScene['id']): void;
	(e: 'trigger', id: IScene['id']): void;
	(e: 'adjust-list'): void;
	(e: 'reset-filters'): void;
	(e: 'selected-changes', selected: IScene[]): void;
	(e: 'update:filters', filters: IScenesFilter): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', dir: 'name' | 'category' | 'order' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { isMDDevice } = useBreakpoints();

let observer: ResizeObserver | null = null;

const wrapper = ref<HTMLElement | null>(null);
const paginator = ref<HTMLElement | null>(null);

const innerFilters = useVModel(props, 'filters', emit);

const sortBy = ref<'name' | 'category' | 'order' | undefined>(props.sortBy);

const sortDir = ref<'asc' | 'desc' | null>(props.sortDir);

const paginatePage = ref<number>(props.paginatePage);

const paginateSize = ref<number>(props.paginateSize);

const tableHeight = ref<number>(250);

const onEdit = (id: IScene['id']): void => {
	emit('edit', id);
};

const onRemove = (id: IScene['id']): void => {
	emit('remove', id);
};

const onTrigger = (id: IScene['id']): void => {
	emit('trigger', id);
};

const onResetFilters = (): void => {
	emit('reset-filters');
};

const onSelectedChanges = (selected: IScene[]): void => {
	emit('selected-changes', selected);
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
		if (!wrapper.value || !paginator.value) {
			return;
		}
		tableHeight.value = wrapper.value.clientHeight - paginator.value.clientHeight;
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
	(): 'name' | 'category' | 'order' | undefined => sortBy.value,
	(val: 'name' | 'category' | 'order' | undefined): void => {
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
	(): 'name' | 'category' | 'order' | undefined => props.sortBy,
	(val: 'name' | 'category' | 'order' | undefined): void => {
		sortBy.value = val;
	}
);
</script>
