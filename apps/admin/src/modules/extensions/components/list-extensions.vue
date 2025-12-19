<template>
	<div class="h-full w-full flex flex-col">
		<el-card
			shadow="never"
			class="px-1 py-2 mt-2 shrink-0"
			body-class="p-0!"
		>
			<extensions-filter
				v-model:filters="innerFilters"
				v-model:view-mode="innerViewMode"
				:filters-active="props.filtersActive"
				@reset-filters="emit('reset-filters')"
				@adjust-list="emit('adjust-list')"
			/>
		</el-card>

		<div
			ref="wrapper"
			class="flex-grow overflow-hidden mt-2"
		>
			<el-card
				v-if="innerViewMode === 'table'"
				shadow="never"
				class="max-h-full"
				body-class="p-0! max-h-full overflow-hidden flex flex-col"
			>
				<extensions-table
					v-model:sort-by="sortBy"
					v-model:sort-dir="sortDir"
					:items="props.items"
					:total-rows="props.totalRows"
					:loading="props.loading"
					:filters-active="props.filtersActive"
					:table-height="tableHeight"
					@detail="onDetail"
					@toggle-enabled="onToggleEnabled"
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

			<extensions-cards
				v-else
				:items="props.allItems"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				@detail="onDetail"
				@toggle-enabled="onToggleEnabled"
				@reset-filters="onResetFilters"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { ElCard, ElPagination } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { useBreakpoints } from '../../../common';
import type { IExtensionsFilter } from '../composables/types';
import type { IExtension } from '../store/extensions.store.types';

import ExtensionsCards from './extensions-cards.vue';
import ExtensionsFilter from './extensions-filter.vue';
import ExtensionsTable from './extensions-table.vue';
import type { IListExtensionsProps } from './list-extensions.types';

defineOptions({
	name: 'ListExtensions',
});

const props = defineProps<IListExtensionsProps>();

const emit = defineEmits<{
	(e: 'detail', type: IExtension['type']): void;
	(e: 'toggle-enabled', type: IExtension['type'], enabled: boolean): void;
	(e: 'adjust-list'): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: IExtensionsFilter): void;
	(e: 'update:view-mode', mode: 'table' | 'cards'): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', by: 'name' | 'type' | 'kind' | 'enabled' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { isMDDevice } = useBreakpoints();

let observer: ResizeObserver | null = null;

const wrapper = ref<HTMLElement | null>(null);
const paginator = ref<HTMLElement | null>(null);

const innerFilters = useVModel(props, 'filters', emit);
const innerViewMode = useVModel(props, 'viewMode', emit);

const sortBy = ref<'name' | 'type' | 'kind' | 'enabled' | undefined>(props.sortBy);
const sortDir = ref<'asc' | 'desc' | null>(props.sortDir ?? null);

const paginatePage = ref<number>(props.paginatePage);
const paginateSize = ref<number>(props.paginateSize);

const tableHeight = ref<number>(250);

const onDetail = (type: IExtension['type']): void => {
	emit('detail', type);
};

const onToggleEnabled = (type: IExtension['type'], enabled: boolean): void => {
	emit('toggle-enabled', type, enabled);
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

const updateHeight = (): void => {
	if (!wrapper.value) {
		return;
	}

	const paginatorHeight = innerViewMode.value === 'table' ? (paginator.value?.clientHeight ?? 60) : 0;
	tableHeight.value = wrapper.value.clientHeight - paginatorHeight;
};

onMounted((): void => {
	if (!wrapper.value) {
		return;
	}

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
	(): 'name' | 'type' | 'kind' | 'enabled' | undefined => sortBy.value,
	(val: 'name' | 'type' | 'kind' | 'enabled' | undefined): void => {
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
	(): 'asc' | 'desc' | null | undefined => props.sortDir,
	(val: 'asc' | 'desc' | null | undefined): void => {
		sortDir.value = val ?? null;
	}
);

watch(
	(): 'name' | 'type' | 'kind' | 'enabled' | undefined => props.sortBy,
	(val: 'name' | 'type' | 'kind' | 'enabled' | undefined): void => {
		sortBy.value = val;
	}
);

watch(
	(): 'table' | 'cards' => innerViewMode.value,
	(): void => {
		// Recalculate height after view mode changes and DOM updates
		setTimeout(updateHeight, 50);
	}
);
</script>
