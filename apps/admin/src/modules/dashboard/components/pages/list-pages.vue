<template>
	<!-- Template 1: one card with the filter bar, the table (a row list on phone) and the pagination -->
	<el-card
		shadow="never"
		class="flex flex-col flex-grow min-h-0 overflow-hidden"
		body-class="p-0! flex flex-col flex-grow min-h-0 overflow-hidden"
	>
		<list-filter-bar
			ref="filterBar"
			v-model:search="search"
			:search-placeholder="t('dashboardModule.fields.pages.search.placeholder')"
			:quick-filters="quickFilters"
			:active-count="activeCount"
			:selected-count="isPhone ? 0 : selectedItems.length"
			@quick-filter="onQuickFilter"
			@reset="emit('reset-filters')"
			@clear-selection="onClearSelection"
		>
			<template #filters>
				<list-pages-adjust v-model:filters="innerFilters" />
			</template>

			<template #bulk>
				<el-button
					v-for="action in bulkActions"
					:key="action.key"
					type="danger"
					plain
					size="small"
					:data-test-id="`bulk-${action.key}`"
					@click="emit('bulk-action', action.key, selectedItems)"
				>
					{{ action.label }}
				</el-button>
			</template>
		</list-filter-bar>

		<!-- The rows scroll inside the card, so the pagination below stays reachable -->
		<div
			v-if="isPhone"
			class="flex-grow min-h-0 overflow-y-auto"
			data-test-id="pages-row-list-scroll"
		>
			<pages-row-list
				:items="props.items"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				@configure="(to: string | RouteLocationRaw) => emit('configure', to)"
				@detail="(id: IPage['id']) => emit('detail', id)"
				@edit="(id: IPage['id']) => emit('edit', id)"
				@remove="(id: IPage['id']) => emit('remove', id)"
				@reset-filters="emit('reset-filters')"
			/>
		</div>

		<div
			v-else
			ref="wrapper"
			class="flex-grow min-h-0 overflow-hidden"
		>
			<pages-table
				ref="table"
				v-model:filters="innerFilters"
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				:items="props.items"
				:total-rows="props.totalRows"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				:table-height="tableHeight"
				@configure="(to: string | RouteLocationRaw) => emit('configure', to)"
				@detail="(id: IPage['id']) => emit('detail', id)"
				@edit="(id: IPage['id']) => emit('edit', id)"
				@remove="(id: IPage['id']) => emit('remove', id)"
				@reset-filters="emit('reset-filters')"
				@selected-changes="(selected: IPage[]) => (selectedItems = selected)"
			/>
		</div>

		<div class="flex flex-wrap justify-end w-full box-border px-4 py-2.5 border-t border-t-solid border-light overflow-hidden">
			<el-pagination
				v-model:current-page="paginatePage"
				v-model:page-size="paginateSize"
				:layout="isPhone ? 'prev, pager, next' : 'total, sizes, prev, pager, next'"
				:total="props.allItems.length"
				@size-change="(size: number) => emit('update:paginate-size', size)"
				@current-change="(page: number) => emit('update:paginate-page', page)"
			/>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RouteLocationRaw } from 'vue-router';

import { ElButton, ElCard, ElPagination } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { ListFilterBar, type ListFilterBarQuickFilter, useSizeClass } from '../../../../common';
import type { IPagesFilter } from '../../composables/types';
import { usePagesPlugins } from '../../composables/usePagesPlugins';
import type { IPage } from '../../store/pages.store.types';

import ListPagesAdjust from './list-pages-adjust.vue';
import { type IListPagesProps } from './list-pages.types';
import PagesRowList from './pages-row-list.vue';
import PagesTable from './pages-table.vue';

defineOptions({
	name: 'ListPages',
});

const props = defineProps<IListPagesProps>();

const emit = defineEmits<{
	(e: 'configure', to: string | RouteLocationRaw): void;
	(e: 'detail', id: IPage['id']): void;
	(e: 'edit', id: IPage['id']): void;
	(e: 'remove', id: IPage['id']): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: IPagesFilter): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', by: 'title' | 'type' | 'order' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
	(e: 'bulk-action', action: string, items: IPage[]): void;
}>();

const { t } = useI18n();
const { isPhone } = useSizeClass();

const { options: typesOptions } = usePagesPlugins();

const innerFilters = useVModel(props, 'filters', emit);

const filterBar = ref<InstanceType<typeof ListFilterBar> | null>(null);
const table = ref<InstanceType<typeof PagesTable> | null>(null);
const wrapper = ref<HTMLElement | null>(null);

const selectedItems = ref<IPage[]>([]);

const sortBy = ref<'title' | 'type' | 'order' | undefined>(props.sortBy);
const sortDir = ref<'asc' | 'desc' | null>(props.sortDir);
const paginatePage = ref<number>(props.paginatePage);
const paginateSize = ref<number>(props.paginateSize);

const tableHeight = ref<number>(250);

const search = computed<string>({
	get: (): string => innerFilters.value.search ?? '',
	set: (value: string): void => {
		innerFilters.value.search = value === '' ? undefined : value;
	},
});

// The bar keeps one quick filter, the page type; the displays a page shows on live in the filters drawer
const quickFilters = computed<ListFilterBarQuickFilter[]>((): ListFilterBarQuickFilter[] => [
	{
		id: 'type',
		label: t('dashboardModule.filters.pages.type.title'),
		options: typesOptions.value.map((option) => ({ value: String(option.value), label: option.label })),
		// Several types picked in the drawer read as All here; the count still shows them
		value: innerFilters.value.types.length === 1 ? innerFilters.value.types[0] : null,
	},
]);

// Active filters, the search excluded: it is visible in the bar on its own
const activeCount = computed<number>((): number => (innerFilters.value.types.length > 0 ? 1 : 0) + (innerFilters.value.displays.length > 0 ? 1 : 0));

const onQuickFilter = (id: string, value: string | null): void => {
	if (id === 'type') {
		innerFilters.value.types = value === null ? [] : [value];
	}
};

// Pages have one bulk action, Remove: destructive, in the danger colour (spec section 4)
const bulkActions = computed<{ key: string; label: string }[]>(() => [{ key: 'delete', label: t('application.bulkActions.delete') }]);

const onClearSelection = (): void => {
	table.value?.clearSelection();
	selectedItems.value = [];
};

// The phone app bar's Search action moves focus to the search field
const focusSearch = (): void => {
	filterBar.value?.focusSearch();
};

defineExpose({ focusSearch });

// The table, and its checked rows, go away on phone; a selection kept here would act on rows nobody can see
watch(isPhone, (phone: boolean): void => {
	if (phone) {
		selectedItems.value = [];
	}
});

let observer: ResizeObserver | null = null;

const updateHeight = (): void => {
	if (wrapper.value) {
		tableHeight.value = wrapper.value.clientHeight;
	}
};

// The table is not rendered on phone, so the wrapper comes and goes with the size class
watch(
	wrapper,
	(element: HTMLElement | null, previous: HTMLElement | null | undefined): void => {
		if (observer && previous) {
			observer.unobserve(previous);
		}

		if (!element) {
			return;
		}

		if (observer === null && typeof window !== 'undefined' && 'ResizeObserver' in window) {
			observer = new ResizeObserver(updateHeight);
		}

		observer?.observe(element);

		updateHeight();
	},
	{ flush: 'post' }
);

onBeforeUnmount((): void => {
	observer?.disconnect();
	observer = null;
});

watch(sortBy, (val): void => emit('update:sort-by', val));
watch(sortDir, (val): void => emit('update:sort-dir', val));
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
</script>
