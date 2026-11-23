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
			:search-placeholder="t('mcpModule.clients.searchPlaceholder')"
			:quick-filters="quickFilters"
			:active-count="activeCount"
			:selected-count="isPhone ? 0 : selectedItems.length"
			@quick-filter="onQuickFilter"
			@reset="emit('reset-filters')"
			@clear-selection="onClearSelection"
		>
			<template #filters>
				<div class="flex flex-col gap-2">
					<span class="text-label">{{ t('mcpModule.clientForm.capabilities') }}</span>
					<el-select
						v-model="innerFilters.capabilities"
						:placeholder="t('mcpModule.clients.filterAll')"
						multiple
						collapse-tags
						clearable
						data-test-id="filter-mcp-clients-capabilities"
					>
						<el-option
							v-for="capability in capabilityOptions"
							:key="capability"
							:label="t(`mcpModule.capabilities.${capability}.title`)"
							:value="capability"
						/>
					</el-select>
				</div>
			</template>

			<template #bulk>
				<el-button
					v-for="action in bulkActions"
					:key="action.key"
					:type="action.danger ? 'danger' : undefined"
					:plain="action.danger"
					size="small"
					:data-test-id="`bulk-${action.key}`"
					@click="onBulkAction(action.key)"
				>
					{{ action.label }}
				</el-button>
			</template>
		</list-filter-bar>

		<!-- The rows scroll inside the card, so the pagination below stays reachable -->
		<div
			v-if="isPhone"
			class="flex-grow min-h-0 overflow-y-auto"
			data-test-id="mcp-clients-row-list-scroll"
		>
			<mcp-clients-row-list
				:items="props.items"
				:loading="props.loading"
				:load-failed="props.loadFailed"
				:filters-active="props.filtersActive"
				@edit="emit('edit', $event)"
				@rotate="emit('rotate', $event)"
				@revoke="emit('revoke', $event)"
				@delete="emit('delete', $event)"
				@reset-filters="emit('reset-filters')"
				@retry="emit('retry')"
			/>
		</div>

		<div
			v-else
			ref="wrapper"
			class="flex-grow min-h-0 overflow-hidden"
		>
			<mcp-clients-table
				ref="table"
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				:items="props.items"
				:total-rows="props.totalRows"
				:loading="props.loading"
				:load-failed="props.loadFailed"
				:filters-active="props.filtersActive"
				:table-height="tableHeight"
				@edit="emit('edit', $event)"
				@rotate="emit('rotate', $event)"
				@revoke="emit('revoke', $event)"
				@delete="emit('delete', $event)"
				@reset-filters="emit('reset-filters')"
				@retry="emit('retry')"
				@selected-changes="onSelectionChange"
			/>
		</div>

		<div class="flex flex-wrap justify-end w-full box-border px-4 py-2.5 border-t border-t-solid border-light overflow-hidden">
			<el-pagination
				v-model:current-page="paginatePage"
				v-model:page-size="paginateSize"
				:layout="isPhone ? 'prev, pager, next' : 'total, sizes, prev, pager, next'"
				:total="props.totalRows"
				@size-change="onPaginatePageSize"
				@current-change="onPaginatePage"
			/>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElOption, ElPagination, ElSelect } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { ListFilterBar, type ListFilterBarQuickFilter, useSizeClass } from '../../../common';
import type { IMcpClientsFilter, IMcpClientsSortBy } from '../composables/types';
import { McpCapability } from '../mcp.constants';
import type { IMcpClient } from '../schemas/client.types';

import type { IListMcpClientsProps } from './list-mcp-clients.types';
import McpClientsRowList from './mcp-clients-row-list.vue';
import McpClientsTable from './mcp-clients-table.vue';

defineOptions({
	name: 'ListMcpClients',
});

const props = withDefaults(defineProps<IListMcpClientsProps>(), {
	loadFailed: false,
});

const emit = defineEmits<{
	(e: 'edit', client: IMcpClient): void;
	(e: 'rotate', client: IMcpClient): void;
	(e: 'revoke', client: IMcpClient): void;
	(e: 'delete', client: IMcpClient): void;
	(e: 'reset-filters'): void;
	(e: 'retry'): void;
	(e: 'update:filters', filters: IMcpClientsFilter): void;
	(e: 'bulk-action', action: string, items: IMcpClient[]): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', by: IMcpClientsSortBy | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
	(e: 'selected-changes', selected: IMcpClient[]): void;
}>();

const { t } = useI18n();
const { isPhone } = useSizeClass();

const capabilityOptions = Object.values(McpCapability);

const innerFilters = useVModel(props, 'filters', emit);

const selectedItems = ref<IMcpClient[]>([]);

const filterBar = ref<InstanceType<typeof ListFilterBar> | null>(null);

const table = ref<InstanceType<typeof McpClientsTable> | null>(null);

const search = computed<string>({
	get: (): string => innerFilters.value.search ?? '',
	set: (value: string): void => {
		innerFilters.value.search = value === '' ? undefined : value;
	},
});

// The bar keeps the credential status and the enabled switch; capabilities live in the filters drawer. Active needs
// both a live credential and the switch on, so Enabled is the only way to find a disabled client
const quickFilters = computed<ListFilterBarQuickFilter[]>((): ListFilterBarQuickFilter[] => [
	{
		id: 'status',
		label: t('mcpModule.clients.columns.status'),
		options: [
			{ value: 'active', label: t('mcpModule.status.active') },
			{ value: 'revoked', label: t('mcpModule.status.revoked') },
			{ value: 'expired', label: t('mcpModule.status.expired') },
		],
		value: innerFilters.value.status === 'all' ? null : innerFilters.value.status,
	},
	{
		id: 'enabled',
		label: t('mcpModule.clientForm.enabled'),
		options: [
			{ value: 'enabled', label: t('mcpModule.clients.enabledFilter.enabled') },
			{ value: 'disabled', label: t('mcpModule.clients.enabledFilter.disabled') },
		],
		value: innerFilters.value.enabled === 'all' ? null : innerFilters.value.enabled,
	},
]);

// Active filters, the search excluded: it is visible in the bar on its own
const activeCount = computed<number>(
	(): number =>
		(innerFilters.value.status !== 'all' ? 1 : 0) +
		(innerFilters.value.enabled !== 'all' ? 1 : 0) +
		(innerFilters.value.capabilities.length > 0 ? 1 : 0)
);

const onQuickFilter = (id: string, value: string | null): void => {
	if (id === 'status') {
		innerFilters.value.status = (value ?? 'all') as IMcpClientsFilter['status'];
	} else if (id === 'enabled') {
		innerFilters.value.enabled = (value ?? 'all') as IMcpClientsFilter['enabled'];
	}
};

// Destructive actions last, in the danger colour (spec section 4)
const bulkActions = computed<{ key: string; label: string; danger: boolean }[]>(() => [
	{ key: 'enable', label: t('application.bulkActions.enable'), danger: false },
	{ key: 'disable', label: t('application.bulkActions.disable'), danger: false },
	{ key: 'revoke', label: t('mcpModule.actions.revoke'), danger: true },
	{ key: 'delete', label: t('application.bulkActions.delete'), danger: true },
]);

const onBulkAction = (action: string): void => {
	emit('bulk-action', action, selectedItems.value);
};

const onSelectionChange = (selected: IMcpClient[]): void => {
	selectedItems.value = selected;

	emit('selected-changes', selected);
};

const onClearSelection = (): void => {
	table.value?.clearSelection();
	selectedItems.value = [];
};

// The table, and its checked rows, go away on phone. A selection kept here would offer bulk actions on rows nobody
// can see once the table comes back empty, so it ends with the table
watch(isPhone, (phone: boolean): void => {
	if (phone && selectedItems.value.length > 0) {
		onSelectionChange([]);
	}
});

// The phone app bar's Search action moves focus to the search field
const focusSearch = (): void => {
	filterBar.value?.focusSearch();
};

defineExpose({ focusSearch });

let observer: ResizeObserver | null = null;

const wrapper = ref<HTMLElement | null>(null);

const sortBy = ref<IMcpClientsSortBy | undefined>(props.sortBy);
const sortDir = ref<'asc' | 'desc' | null>(props.sortDir);
const paginatePage = ref<number>(props.paginatePage);
const paginateSize = ref<number>(props.paginateSize);

const tableHeight = ref<number>(250);

const onPaginatePageSize = (size: number): void => {
	emit('update:paginate-size', size);
};

const onPaginatePage = (page: number): void => {
	emit('update:paginate-page', page);
};

// The table fills its part of the card: the pagination is a sibling below it, so the part is the table's height. The
// part is rendered only beside a table (not on phone), so the observer follows it as it comes and goes
const updateHeight = (): void => {
	if (wrapper.value) {
		tableHeight.value = wrapper.value.clientHeight;
	}
};

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

watch(
	(): IMcpClientsSortBy | undefined => sortBy.value,
	(val: IMcpClientsSortBy | undefined): void => {
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
</script>
