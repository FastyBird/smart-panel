<template>
	<el-card
		shadow="never"
		class="px-1 py-2 shrink-0"
		body-class="p-0!"
	>
		<devices-filter
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
			<devices-table
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

import { type IBulkAction, useBreakpoints } from '../../../../common';
import type { IDevicesFilter } from '../../composables/types';
import type { IDevice } from '../../store/devices.store.types';

import DevicesFilter from './devices-filter.vue';
import DevicesTable from './devices-table.vue';
import { type IListDevicesProps } from './list-devices.types';

defineOptions({
	name: 'ListDevices',
});

const props = defineProps<IListDevicesProps>();

const emit = defineEmits<{
	(e: 'detail', id: IDevice['id']): void;
	(e: 'edit', id: IDevice['id']): void;
	(e: 'remove', id: IDevice['id']): void;
	(e: 'adjust-list'): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: IDevicesFilter): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', dir: 'name' | 'description' | 'type' | 'state' | 'category' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
	(e: 'bulk-action', action: string, items: IDevice[]): void;
}>();

const { t } = useI18n();
const { isMDDevice } = useBreakpoints();

let observer: ResizeObserver | null = null;

const wrapper = ref<HTMLElement | null>(null);
const paginator = ref<HTMLElement | null>(null);

const innerFilters = useVModel(props, 'filters', emit);

const sortBy = ref<'name' | 'description' | 'type' | 'state' | 'category' | undefined>(props.sortBy);

const sortDir = ref<'asc' | 'desc' | null>(props.sortDir);

const paginatePage = ref<number>(props.paginatePage);

const paginateSize = ref<number>(props.paginateSize);

const tableHeight = ref<number>(250);

const selectedItems = ref<IDevice[]>([]);

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

onMounted((): void => {
	if (!wrapper.value) {
		return;
	}

	const updateHeight = () => {
		tableHeight.value = wrapper.value!.clientHeight - paginator.value!.clientHeight;
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
