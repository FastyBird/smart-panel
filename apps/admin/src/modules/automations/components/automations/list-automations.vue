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
			:search-placeholder="t('automations.fields.search.placeholder')"
			:quick-filters="quickFilters"
			:active-count="activeCount"
			@quick-filter="onQuickFilter"
			@reset="emit('reset-filters')"
		>
			<template #filters>
				<list-automations-adjust v-model:filters="innerFilters" />
			</template>
		</list-filter-bar>

		<!-- The rows scroll inside the card, so the pagination below stays reachable -->
		<div
			v-if="isPhone"
			class="flex-grow min-h-0 overflow-y-auto"
			data-test-id="automations-row-list-scroll"
		>
			<automations-row-list
				:items="props.items"
				:loading="props.loading"
				:load-failed="props.loadFailed"
				:filters-active="props.filtersActive"
				:updating="props.updating"
				@edit="(id: IAutomation['id']): void => emit('edit', id)"
				@toggle-enabled="(id: IAutomation['id'], enabled: boolean): void => emit('toggle-enabled', id, enabled)"
				@reset-filters="emit('reset-filters')"
				@retry="emit('retry')"
			/>
		</div>

		<div
			v-else
			ref="wrapper"
			class="flex-grow min-h-0 overflow-hidden"
		>
			<automations-table
				v-model:filters="innerFilters"
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				:items="props.items"
				:total-rows="props.totalRows"
				:loading="props.loading"
				:load-failed="props.loadFailed"
				:filters-active="props.filtersActive"
				:table-height="tableHeight"
				:updating="props.updating"
				:exporting="props.exporting"
				@edit="(id: IAutomation['id']): void => emit('edit', id)"
				@flow="(id: IAutomation['id']): void => emit('flow', id)"
				@export="(id: IAutomation['id']): void => emit('export', id)"
				@remove="(id: IAutomation['id']): void => emit('remove', id)"
				@toggle-enabled="(id: IAutomation['id'], enabled: boolean): void => emit('toggle-enabled', id, enabled)"
				@reset-filters="emit('reset-filters')"
				@retry="emit('retry')"
			/>
		</div>

		<div
			ref="paginator"
			class="flex flex-wrap justify-end w-full box-border px-4 py-2.5 border-t border-t-solid border-light overflow-hidden"
		>
			<el-pagination
				v-model:current-page="paginatePage"
				v-model:page-size="paginateSize"
				:layout="isPhone ? 'prev, pager, next' : 'total, sizes, prev, pager, next'"
				:total="props.allItems.length"
				@size-change="onPaginatePageSize"
				@current-change="onPaginatePage"
			/>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, ElPagination } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { ListFilterBar, type ListFilterBarQuickFilter, useSizeClass } from '../../../../common';
import type { AutomationsSortBy, IAutomationsFilter } from '../../composables/types';
import type { IAutomation } from '../../store/automations.store.types';

import AutomationsRowList from './automations-row-list.vue';
import AutomationsTable from './automations-table.vue';
import ListAutomationsAdjust from './list-automations-adjust.vue';
import { type IListAutomationsProps } from './list-automations.types';

defineOptions({
	name: 'ListAutomations',
});

const props = defineProps<IListAutomationsProps>();

const emit = defineEmits<{
	(e: 'edit', id: IAutomation['id']): void;
	(e: 'flow', id: IAutomation['id']): void;
	(e: 'export', id: IAutomation['id']): void;
	(e: 'remove', id: IAutomation['id']): void;
	(e: 'toggle-enabled', id: IAutomation['id'], enabled: boolean): void;
	(e: 'reset-filters'): void;
	(e: 'retry'): void;
	(e: 'update:filters', filters: IAutomationsFilter): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', by: AutomationsSortBy | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { t } = useI18n();
const { isPhone } = useSizeClass();

let observer: ResizeObserver | null = null;

const wrapper = ref<HTMLElement | null>(null);
const paginator = ref<HTMLElement | null>(null);

const innerFilters = useVModel(props, 'filters', emit);

const sortBy = ref<AutomationsSortBy | undefined>(props.sortBy);

const sortDir = ref<'asc' | 'desc' | null>(props.sortDir);

const paginatePage = ref<number>(props.paginatePage);

const paginateSize = ref<number>(props.paginateSize);

const tableHeight = ref<number>(250);

const filterBar = ref<InstanceType<typeof ListFilterBar> | null>(null);

const search = computed<string>({
	get: (): string => innerFilters.value.search ?? '',
	set: (value: string): void => {
		innerFilters.value.search = value === '' ? undefined : value;
	},
});

// The bar keeps one quick filter, Enabled; status and space live in the filters drawer
const quickFilters = computed<ListFilterBarQuickFilter[]>((): ListFilterBarQuickFilter[] => [
	{
		id: 'enabled',
		label: t('automations.filters.enabled.title'),
		options: [
			{ value: 'enabled', label: t('automations.filters.enabled.values.enabled') },
			{ value: 'disabled', label: t('automations.filters.enabled.values.disabled') },
		],
		value: innerFilters.value.enabled === 'all' ? null : innerFilters.value.enabled,
	},
]);

// Active filters, the search excluded: it is visible in the bar on its own
const activeCount = computed<number>(
	(): number =>
		(innerFilters.value.enabled !== 'all' ? 1 : 0) +
		(innerFilters.value.statuses.length > 0 ? 1 : 0) +
		(typeof innerFilters.value.spaceId !== 'undefined' ? 1 : 0)
);

const onQuickFilter = (id: string, value: string | null): void => {
	if (id === 'enabled') {
		innerFilters.value.enabled = (value ?? 'all') as IAutomationsFilter['enabled'];
	}
};

// The phone app bar's Search action moves focus to the search field
const focusSearch = (): void => {
	filterBar.value?.focusSearch();
};

defineExpose({ focusSearch });

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
	(): AutomationsSortBy | undefined => sortBy.value,
	(val: AutomationsSortBy | undefined): void => {
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
	(): AutomationsSortBy | undefined => props.sortBy,
	(val: AutomationsSortBy | undefined): void => {
		sortBy.value = val;
	}
);
</script>
