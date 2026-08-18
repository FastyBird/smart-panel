<template>
	<el-card
		shadow="never"
		class="px-1 py-2 shrink-0"
		body-class="p-0!"
	>
		<mcp-clients-filter
			v-model:filters="innerFilters"
			:filters-active="props.filtersActive"
			:selected-count="selectedItems.length"
			:bulk-actions="bulkActions"
			@reset-filters="emit('reset-filters')"
			@bulk-action="onBulkAction"
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
			<mcp-clients-table
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				:items="props.items"
				:total-rows="props.totalRows"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				:table-height="tableHeight"
				@edit="emit('edit', $event)"
				@rotate="emit('rotate', $event)"
				@revoke="emit('revoke', $event)"
				@delete="emit('delete', $event)"
				@reset-filters="emit('reset-filters')"
				@selected-changes="onSelectionChange"
			/>

			<div
				ref="paginator"
				class="flex justify-center w-full py-4"
			>
				<el-pagination
					v-model:current-page="paginatePage"
					v-model:page-size="paginateSize"
					:layout="isMDDevice ? 'total, sizes, prev, pager, next, jumper' : 'total, sizes, prev, pager, next'"
					:total="props.totalRows"
					@size-change="onPaginatePageSize"
					@current-change="onPaginatePage"
				/>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, ElPagination } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { type IBulkAction, useBreakpoints } from '../../../common';
import type { IMcpClientsFilter, IMcpClientsSortBy } from '../composables/types';
import type { IMcpClient } from '../schemas/client.types';

import type { IListMcpClientsProps } from './list-mcp-clients.types';
import McpClientsFilter from './mcp-clients-filter.vue';
import McpClientsTable from './mcp-clients-table.vue';

defineOptions({
	name: 'ListMcpClients',
});

const props = defineProps<IListMcpClientsProps>();

const emit = defineEmits<{
	(e: 'edit', client: IMcpClient): void;
	(e: 'rotate', client: IMcpClient): void;
	(e: 'revoke', client: IMcpClient): void;
	(e: 'delete', client: IMcpClient): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: IMcpClientsFilter): void;
	(e: 'bulk-action', action: string, items: IMcpClient[]): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', by: IMcpClientsSortBy | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
	(e: 'selected-changes', selected: IMcpClient[]): void;
}>();

const { t } = useI18n();
const { isMDDevice } = useBreakpoints();

const innerFilters = useVModel(props, 'filters', emit);

const selectedItems = ref<IMcpClient[]>([]);

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
		key: 'revoke',
		label: t('mcpModule.actions.revoke'),
		icon: 'mdi:key-remove',
		type: 'warning',
	},
	{
		key: 'delete',
		label: t('application.bulkActions.delete'),
		icon: 'mdi:trash',
		type: 'danger',
	},
]);

const onBulkAction = (action: string): void => {
	emit('bulk-action', action, selectedItems.value);
};

let observer: ResizeObserver | null = null;

const wrapper = ref<HTMLElement | null>(null);
const paginator = ref<HTMLElement | null>(null);

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

const onSelectionChange = (selected: IMcpClient[]): void => {
	selectedItems.value = selected;

	emit('selected-changes', selected);
};

onMounted((): void => {
	if (!wrapper.value) {
		return;
	}

	const updateHeight = (): void => {
		tableHeight.value = wrapper.value!.clientHeight - (paginator.value?.clientHeight ?? 0);
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
