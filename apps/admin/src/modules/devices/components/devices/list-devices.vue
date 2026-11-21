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
			:search-placeholder="t('devicesModule.fields.devices.search.placeholder')"
			:quick-filters="quickFilters"
			:active-count="activeCount"
			:selected-count="isPhone ? 0 : selectedItems.length"
			@quick-filter="onQuickFilter"
			@reset="emit('reset-filters')"
			@clear-selection="onClearSelection"
		>
			<template #filters>
				<div class="flex items-center justify-between gap-3">
					<span class="text-label">{{ t('devicesModule.fields.devices.showHidden.title') }}</span>
					<!-- Disabled while a fetch is in flight: flipping it re-fetches the list from the backend rather than
					     filtering client-side, so a switch flipped mid-fetch would let a second request overlap the first -->
					<el-switch
						v-model="innerShowHidden"
						:disabled="props.loading"
						:loading="props.loading"
						:aria-label="t('devicesModule.fields.devices.showHidden.title')"
						data-test-id="show-hidden-devices"
					/>
				</div>

				<list-devices-adjust v-model:filters="innerFilters" />
			</template>

			<template #bulk>
				<el-button
					v-for="action in bulkActions"
					:key="action.key"
					:type="action.key === 'delete' ? 'danger' : undefined"
					:plain="action.key === 'delete'"
					size="small"
					:data-test-id="`bulk-${action.key}`"
					@click="onBulkAction(action.key)"
				>
					{{ action.label }}
				</el-button>
			</template>
		</list-filter-bar>

		<devices-row-list
			v-if="isPhone"
			:items="props.items"
			:loading="props.loading"
			:filters-active="props.filtersActive"
			@detail="onDetail"
			@reset-filters="onResetFilters"
		/>

		<div
			v-else
			ref="wrapper"
			class="flex-grow min-h-0 overflow-hidden"
		>
			<devices-table
				ref="table"
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
				@selected-changes="onSelectionChange"
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

import { ElButton, ElCard, ElPagination, ElSwitch } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { type IBulkAction, ListFilterBar, type ListFilterBarQuickFilter, useBreakpoints, useSizeClass } from '../../../../common';
import type { IDevicesFilter } from '../../composables/types';
import type { IDevice } from '../../store/devices.store.types';

import DevicesRowList from './devices-row-list.vue';
import DevicesTable from './devices-table.vue';
import ListDevicesAdjust from './list-devices-adjust.vue';
import { type IListDevicesProps } from './list-devices.types';

defineOptions({
	name: 'ListDevices',
});

const props = defineProps<IListDevicesProps>();

const emit = defineEmits<{
	(e: 'detail', id: IDevice['id']): void;
	(e: 'edit', id: IDevice['id']): void;
	(e: 'remove', id: IDevice['id']): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: IDevicesFilter): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', dir: 'name' | 'description' | 'type' | 'state' | 'category' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
	(e: 'update:show-hidden', showHidden: boolean): void;
	(e: 'bulk-action', action: string, items: IDevice[]): void;
}>();

const { t } = useI18n();
const { isMDDevice } = useBreakpoints();
const { isPhone } = useSizeClass();

let observer: ResizeObserver | null = null;

const wrapper = ref<HTMLElement | null>(null);
const paginator = ref<HTMLElement | null>(null);

const innerFilters = useVModel(props, 'filters', emit);

const innerShowHidden = useVModel(props, 'showHidden', emit);

const sortBy = ref<'name' | 'description' | 'type' | 'state' | 'category' | undefined>(props.sortBy);

const sortDir = ref<'asc' | 'desc' | null>(props.sortDir);

const paginatePage = ref<number>(props.paginatePage);

const paginateSize = ref<number>(props.paginateSize);

const tableHeight = ref<number>(250);

const selectedItems = ref<IDevice[]>([]);

const filterBar = ref<InstanceType<typeof ListFilterBar> | null>(null);

const table = ref<InstanceType<typeof DevicesTable> | null>(null);

const search = computed<string>({
	get: (): string => innerFilters.value.search ?? '',
	set: (value: string): void => {
		innerFilters.value.search = value === '' ? undefined : value;
	},
});

// The design keeps one quick filter in the bar, the connection state; the rest live in the filters drawer
const quickFilters = computed<ListFilterBarQuickFilter[]>((): ListFilterBarQuickFilter[] => [
	{
		id: 'state',
		label: t('devicesModule.fields.devices.state.title'),
		options: [
			{ value: 'online', label: t('devicesModule.states.online') },
			{ value: 'offline', label: t('devicesModule.states.offline') },
		],
		value: innerFilters.value.state === 'all' ? null : innerFilters.value.state,
	},
]);

// Active filters, the search excluded: it is visible in the bar on its own
const activeCount = computed<number>((): number => {
	const filters = innerFilters.value;

	return (
		(filters.state !== 'all' ? 1 : 0) +
		(filters.types.length > 0 ? 1 : 0) +
		(filters.states.length > 0 ? 1 : 0) +
		(filters.categories.length > 0 ? 1 : 0) +
		(filters.enabled !== 'all' ? 1 : 0) +
		(filters.validation !== 'all' ? 1 : 0)
	);
});

const onQuickFilter = (id: string, value: string | null): void => {
	if (id === 'state') {
		innerFilters.value.state = (value ?? 'all') as 'all' | 'online' | 'offline';
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

const bulkActions = computed<IBulkAction[]>((): IBulkAction[] => [
	{
		key: 'enable',
		label: t('application.bulkActions.enable'),
		icon: 'mdi:check-circle-outline',
		type: 'success',
	},
	{
		key: 'disable',
		label: t('application.bulkActions.disable'),
		icon: 'mdi:close-circle-outline',
		type: 'warning',
	},
	{
		key: 'delete',
		label: t('application.bulkActions.delete'),
		icon: 'mdi:trash',
		type: 'danger',
	},
]);

const onDetail = (id: IDevice['id']): void => {
	emit('detail', id);
};

const onEdit = (id: IDevice['id']): void => {
	emit('edit', id);
};

const onRemove = (id: IDevice['id']): void => {
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

const onSelectionChange = (selected: IDevice[]): void => {
	selectedItems.value = selected;
};

const onBulkAction = (action: string): void => {
	emit('bulk-action', action, selectedItems.value);
};

const updateHeight = (): void => {
	if (wrapper.value && paginator.value) {
		tableHeight.value = wrapper.value.clientHeight;
	}
};

// The table is not rendered on phone, so the wrapper comes and goes with the size class
watch(wrapper, (element, previous): void => {
	if (previous) {
		observer?.unobserve(previous);
	}

	if (element) {
		if (observer === null && typeof window !== 'undefined' && 'ResizeObserver' in window) {
			observer = new ResizeObserver(updateHeight);
		}

		observer?.observe(element);

		updateHeight();
	}
});

onMounted((): void => {
	updateHeight();
});

onBeforeUnmount((): void => {
	observer?.disconnect();
	observer = null;
});

watch(
	(): 'name' | 'description' | 'type' | 'state' | 'category' | undefined => sortBy.value,
	(val: 'name' | 'description' | 'type' | 'state' | 'category' | undefined): void => {
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
	(): 'name' | 'description' | 'type' | 'state' | 'category' | undefined => props.sortBy,
	(val: 'name' | 'description' | 'type' | 'state' | 'category' | undefined): void => {
		sortBy.value = val;
	}
);

watch(
	(): boolean => isMDDevice.value,
	(val: boolean): void => {
		if (!val) {
			selectedItems.value = [];
		}
	}
);
</script>
