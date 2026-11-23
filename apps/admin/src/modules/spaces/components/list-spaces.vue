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
			:search-placeholder="t('spacesModule.fields.search.placeholder')"
			:quick-filters="quickFilters"
			:active-count="innerFilters.types.length > 0 ? 1 : 0"
			:selected-count="isPhone ? 0 : selectedItems.length"
			@quick-filter="onQuickFilter"
			@reset="emit('reset-filters')"
			@clear-selection="onClearSelection"
		>
			<template #filters>
				<div class="flex flex-col gap-2">
					<span class="text-label">{{ t('spacesModule.filters.types.title') }}</span>
					<el-checkbox-group
						v-model="innerFilters.types"
						class="flex flex-col"
					>
						<el-checkbox
							v-for="type of typesOptions"
							:key="type.value"
							:label="type.label"
							:value="type.value"
						/>
					</el-checkbox-group>
				</div>
			</template>

			<template #bulk>
				<el-button
					type="danger"
					plain
					size="small"
					data-test-id="bulk-delete"
					@click="emit('bulk-action', 'delete', selectedItems)"
				>
					{{ t('application.bulkActions.delete') }}
				</el-button>
			</template>
		</list-filter-bar>

		<!-- The rows scroll inside the card, so the pagination below stays reachable -->
		<div
			v-if="isPhone"
			class="flex-grow min-h-0 overflow-y-auto"
			data-test-id="spaces-row-list-scroll"
		>
			<spaces-row-list
				:items="props.items"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				@edit="(id: ISpace['id']) => emit('edit', id)"
				@remove="(id: ISpace['id']) => emit('remove', id)"
				@configure="(to: RouteLocationRaw) => emit('configure', to)"
				@reset-filters="emit('reset-filters')"
			/>
		</div>

		<div
			v-else
			ref="wrapper"
			class="flex-grow min-h-0 overflow-hidden"
		>
			<spaces-table
				ref="table"
				v-model:filters="innerFilters"
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				:items="props.items"
				:total-rows="props.totalRows"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				:table-height="tableHeight"
				@edit="(id: ISpace['id']) => emit('edit', id)"
				@remove="(id: ISpace['id']) => emit('remove', id)"
				@configure="(to: RouteLocationRaw) => emit('configure', to)"
				@reset-filters="emit('reset-filters')"
				@selected-changes="onSelectionChange"
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

import { ElButton, ElCard, ElCheckbox, ElCheckboxGroup, ElPagination } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { ListFilterBar, type ListFilterBarQuickFilter, useSizeClass } from '../../../common';
import { useSpacesPlugins } from '../composables';
import type { ISpacesFilter } from '../composables/types';
import type { ISpace } from '../store/spaces.store.types';

import { type IListSpacesProps } from './list-spaces.types';
import SpacesRowList from './spaces-row-list.vue';
import SpacesTable from './spaces-table.vue';

defineOptions({
	name: 'ListSpaces',
});

const props = defineProps<IListSpacesProps>();

const emit = defineEmits<{
	(e: 'edit', id: ISpace['id']): void;
	(e: 'remove', id: ISpace['id']): void;
	(e: 'configure', to: RouteLocationRaw): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: ISpacesFilter): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', by: 'name' | 'type' | 'displayOrder' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
	(e: 'bulk-action', action: string, items: ISpace[]): void;
}>();

const { t } = useI18n();
const { isPhone } = useSizeClass();

const { options: typesOptions } = useSpacesPlugins();

const innerFilters = useVModel(props, 'filters', emit);

const filterBar = ref<InstanceType<typeof ListFilterBar> | null>(null);
const table = ref<InstanceType<typeof SpacesTable> | null>(null);
const wrapper = ref<HTMLElement | null>(null);

const selectedItems = ref<ISpace[]>([]);

const sortBy = ref<'name' | 'type' | 'displayOrder' | undefined>(props.sortBy);
const sortDir = ref<'asc' | 'desc' | null>(props.sortDir ?? null);
const paginatePage = ref<number>(props.paginatePage);
const paginateSize = ref<number>(props.paginateSize);

const tableHeight = ref<number>(250);

const search = computed<string>({
	get: (): string => innerFilters.value.search ?? '',
	set: (value: string): void => {
		innerFilters.value.search = value === '' ? undefined : value;
	},
});

// The bar keeps one quick filter, the space type; picking several lives in the filters drawer
const quickFilters = computed<ListFilterBarQuickFilter[]>((): ListFilterBarQuickFilter[] => [
	{
		id: 'type',
		label: t('spacesModule.table.columns.type'),
		options: typesOptions.value.filter((option) => !option.disabled).map((option) => ({ value: option.value, label: option.label })),
		value: innerFilters.value.types.length === 1 ? innerFilters.value.types[0] : null,
	},
]);

const onQuickFilter = (id: string, value: string | null): void => {
	if (id === 'type') {
		innerFilters.value.types = value === null ? [] : [value];
	}
};

const onSelectionChange = (selected: ISpace[]): void => {
	selectedItems.value = selected;
};

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
