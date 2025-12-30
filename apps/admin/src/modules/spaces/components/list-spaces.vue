<template>
	<el-card
		shadow="never"
		class="px-1 py-2 shrink-0"
		body-class="p-0!"
	>
		<spaces-filter
			v-model:filters="innerFilters"
			:filters-active="props.filtersActive"
			:selected-count="selectedItems.length"
			:bulk-actions="bulkActions"
			@reset-filters="emit('reset-filters')"
			@adjust-list="emit('adjust-list')"
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
			<spaces-table
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
				@add="onAdd"
				@reset-filters="onResetFilters"
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
					:total="props.allItems.length"
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
import type { ISpacesFilter } from '../composables/types';
import type { ISpace } from '../store/spaces.store.types';

import SpacesFilter from './spaces-filter.vue';
import SpacesTable from './spaces-table.vue';
import { type IListSpacesProps } from './list-spaces.types';

defineOptions({
	name: 'ListSpaces',
});

const props = defineProps<IListSpacesProps>();

const emit = defineEmits<{
	(e: 'detail', id: ISpace['id']): void;
	(e: 'edit', id: ISpace['id']): void;
	(e: 'remove', id: ISpace['id']): void;
	(e: 'add'): void;
	(e: 'adjust-list'): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: ISpacesFilter): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', dir: 'name' | 'type' | 'displayOrder' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
	(e: 'bulk-action', action: string, items: ISpace[]): void;
}>();

const { t } = useI18n();
const { isMDDevice } = useBreakpoints();

let observer: ResizeObserver | null = null;

const wrapper = ref<HTMLElement | null>(null);
const paginator = ref<HTMLElement | null>(null);

const innerFilters = useVModel(props, 'filters', emit);

const sortBy = ref<'name' | 'type' | 'displayOrder' | undefined>(props.sortBy);

const sortDir = ref<'asc' | 'desc' | null>(props.sortDir ?? null);

const paginatePage = ref<number>(props.paginatePage);

const paginateSize = ref<number>(props.paginateSize);

const tableHeight = ref<number>(250);

const selectedItems = ref<ISpace[]>([]);

const bulkActions = computed<IBulkAction[]>((): IBulkAction[] => [
	{
		key: 'delete',
		label: t('application.bulkActions.delete'),
		icon: 'mdi:trash',
		type: 'danger',
	},
]);

const onDetail = (id: ISpace['id']): void => {
	emit('detail', id);
};

const onEdit = (id: ISpace['id']): void => {
	emit('edit', id);
};

const onRemove = (id: ISpace['id']): void => {
	emit('remove', id);
};

const onAdd = (): void => {
	emit('add');
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

const onSelectionChange = (selected: ISpace[]): void => {
	selectedItems.value = selected;
};

const onBulkAction = (action: string): void => {
	emit('bulk-action', action, selectedItems.value);
};

onMounted((): void => {
	if (!wrapper.value) {
		return;
	}

	const updateHeight = () => {
		if (wrapper.value && paginator.value) {
			tableHeight.value = wrapper.value.clientHeight - paginator.value.clientHeight;
		}
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
	(): 'name' | 'type' | 'displayOrder' | undefined => sortBy.value,
	(val: 'name' | 'type' | 'displayOrder' | undefined): void => {
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
	(): 'asc' | 'desc' | null => props.sortDir ?? null,
	(val: 'asc' | 'desc' | null): void => {
		sortDir.value = val;
	}
);

watch(
	(): 'name' | 'type' | 'displayOrder' | undefined => props.sortBy,
	(val: 'name' | 'type' | 'displayOrder' | undefined): void => {
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
