<template>
	<!-- Template 2: the filter card, then the catalogue: a grid of cards, or the table with its pagination. Phone shows
	     the cards only -->
	<div class="flex flex-col gap-4 flex-1 min-h-0">
		<el-card
			shadow="never"
			class="shrink-0"
			body-class="p-0!"
		>
			<list-filter-bar
				ref="filterBar"
				v-model:search="search"
				:search-placeholder="t('extensionsModule.fields.search.placeholder')"
				:quick-filters="quickFilters"
				:active-count="activeCount"
				:selected-count="effectiveViewMode === 'table' ? selectedItems.length : 0"
				@quick-filter="onQuickFilter"
				@reset="emit('reset-filters')"
				@clear-selection="onClearSelection"
			>
				<template #bulk>
					<el-button
						plain
						size="small"
						data-test-id="bulk-enable"
						@click="emit('bulk-action', 'enable', selectedItems)"
					>
						{{ t('application.bulkActions.enable') }}
					</el-button>
					<el-button
						plain
						size="small"
						data-test-id="bulk-disable"
						@click="emit('bulk-action', 'disable', selectedItems)"
					>
						{{ t('application.bulkActions.disable') }}
					</el-button>
				</template>
			</list-filter-bar>
		</el-card>

		<!-- The cards scroll in the page column; they add columns on wider screens rather than growing -->
		<div
			v-if="effectiveViewMode === 'cards'"
			class="flex-1 min-h-0 overflow-y-auto"
			data-test-id="extensions-cards-scroll"
		>
			<extensions-cards
				:items="props.allItems"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				@detail="(type: IExtension['type']) => emit('detail', type)"
				@toggle-enabled="(type: IExtension['type'], enabled: boolean) => emit('toggle-enabled', type, enabled)"
				@reset-filters="emit('reset-filters')"
			/>
		</div>

		<el-card
			v-else
			shadow="never"
			class="flex flex-col flex-1 min-h-0 overflow-hidden"
			body-class="p-0! flex flex-col flex-1 min-h-0 overflow-hidden"
		>
			<div
				ref="wrapper"
				class="flex-1 min-h-0 overflow-hidden"
			>
				<extensions-table
					ref="table"
					v-model:sort-by="sortBy"
					v-model:sort-dir="sortDir"
					:items="props.items"
					:total-rows="props.totalRows"
					:loading="props.loading"
					:filters-active="props.filtersActive"
					:table-height="tableHeight"
					@detail="(type: IExtension['type']) => emit('detail', type)"
					@toggle-enabled="(type: IExtension['type'], enabled: boolean) => emit('toggle-enabled', type, enabled)"
					@reset-filters="emit('reset-filters')"
					@selected-changes="(selected: IExtension[]) => (selectedItems = selected)"
				/>
			</div>

			<div class="flex flex-wrap justify-end w-full box-border px-4 py-2.5 border-t border-t-solid border-light overflow-hidden">
				<el-pagination
					v-model:current-page="paginatePage"
					v-model:page-size="paginateSize"
					layout="total, sizes, prev, pager, next"
					:total="props.allItems.length"
					@size-change="(size: number) => emit('update:paginate-size', size)"
					@current-change="(page: number) => emit('update:paginate-page', page)"
				/>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElPagination } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { ListFilterBar, type ListFilterBarQuickFilter, useSizeClass } from '../../../common';
import type { IExtensionsFilter } from '../composables/types';
import { ExtensionKind } from '../extensions.constants';
import type { IExtension } from '../store/extensions.store.types';

import ExtensionsCards from './extensions-cards.vue';
import ExtensionsTable from './extensions-table.vue';
import type { IListExtensionsProps } from './list-extensions.types';

defineOptions({
	name: 'ListExtensions',
});

const props = defineProps<IListExtensionsProps>();

const emit = defineEmits<{
	(e: 'detail', type: IExtension['type']): void;
	(e: 'toggle-enabled', type: IExtension['type'], enabled: boolean): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: IExtensionsFilter): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', by: 'name' | 'type' | 'kind' | 'enabled' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
	(e: 'bulk-action', action: string, items: IExtension[]): void;
}>();

const { t } = useI18n();
const { isPhone } = useSizeClass();

const innerFilters = useVModel(props, 'filters', emit);

// Phone has room for one column of cards, so it shows the cards whichever view was picked
const effectiveViewMode = computed<'table' | 'cards'>(() => (isPhone.value ? 'cards' : props.viewMode));

const filterBar = ref<InstanceType<typeof ListFilterBar> | null>(null);
const table = ref<InstanceType<typeof ExtensionsTable> | null>(null);
const wrapper = ref<HTMLElement | null>(null);

const selectedItems = ref<IExtension[]>([]);

const sortBy = ref<'name' | 'type' | 'kind' | 'enabled' | undefined>(props.sortBy);
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

// Kind, status and origin: three single choices, the bar's quick filters
const quickFilters = computed<ListFilterBarQuickFilter[]>((): ListFilterBarQuickFilter[] => [
	{
		id: 'kind',
		label: t('extensionsModule.filters.kind.title'),
		options: [
			{ value: ExtensionKind.module, label: t('extensionsModule.labels.module') },
			{ value: ExtensionKind.plugin, label: t('extensionsModule.labels.plugin') },
		],
		value: innerFilters.value.kind === 'all' ? null : innerFilters.value.kind,
	},
	{
		id: 'enabled',
		label: t('extensionsModule.filters.enabled.title'),
		options: [
			{ value: 'enabled', label: t('extensionsModule.labels.enabled') },
			{ value: 'disabled', label: t('extensionsModule.labels.disabled') },
		],
		value: innerFilters.value.enabled === 'all' ? null : innerFilters.value.enabled,
	},
	{
		id: 'isCore',
		label: t('extensionsModule.filters.type.title'),
		options: [
			{ value: 'core', label: t('extensionsModule.labels.core') },
			{ value: 'addon', label: t('extensionsModule.labels.addon') },
		],
		value: innerFilters.value.isCore === 'all' ? null : innerFilters.value.isCore,
	},
]);

// Active filters, the search excluded: it is visible in the bar on its own
const activeCount = computed<number>(
	(): number => [innerFilters.value.kind, innerFilters.value.enabled, innerFilters.value.isCore].filter((value) => value !== 'all').length
);

const onQuickFilter = (id: string, value: string | null): void => {
	switch (id) {
		case 'kind':
			innerFilters.value.kind = (value ?? 'all') as IExtensionsFilter['kind'];
			break;
		case 'enabled':
			innerFilters.value.enabled = (value ?? 'all') as IExtensionsFilter['enabled'];
			break;
		case 'isCore':
			innerFilters.value.isCore = (value ?? 'all') as IExtensionsFilter['isCore'];
			break;
	}
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

// The cards have no selection: a selection kept from the table would act on rows nobody can see
watch(effectiveViewMode, (mode: 'table' | 'cards'): void => {
	if (mode === 'cards') {
		selectedItems.value = [];
	}
});

let observer: ResizeObserver | null = null;

const updateHeight = (): void => {
	if (wrapper.value) {
		tableHeight.value = wrapper.value.clientHeight;
	}
};

// The table comes and goes with the view mode and the size class, and its wrapper with it
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
	(): 'name' | 'type' | 'kind' | 'enabled' | undefined => props.sortBy,
	(val): void => {
		sortBy.value = val;
	}
);
watch(
	(): 'asc' | 'desc' | null | undefined => props.sortDir,
	(val): void => {
		sortDir.value = val ?? null;
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
</script>
