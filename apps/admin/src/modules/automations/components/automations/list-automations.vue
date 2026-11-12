<template>
	<el-card
		shadow="never"
		class="px-1 py-2 shrink-0"
		body-class="p-0!"
	>
		<automations-filter
			v-model:filters="innerFilters"
			:filters-active="props.filtersActive"
			@reset-filters="emit('reset-filters')"
			@adjust-list="emit('adjust-list')"
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
				@edit="(id: IAutomation['id']): void => emit('edit', id)"
				@flow="(id: IAutomation['id']): void => emit('flow', id)"
				@remove="(id: IAutomation['id']): void => emit('remove', id)"
				@toggle-enabled="(id: IAutomation['id'], enabled: boolean): void => emit('toggle-enabled', id, enabled)"
				@reset-filters="emit('reset-filters')"
				@retry="emit('retry')"
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
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { ElCard, ElPagination } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { useBreakpoints } from '../../../../common';
import type { AutomationsSortBy, IAutomationsFilter } from '../../composables/types';
import type { IAutomation } from '../../store/automations.store.types';

import AutomationsFilter from './automations-filter.vue';
import AutomationsTable from './automations-table.vue';
import { type IListAutomationsProps } from './list-automations.types';

defineOptions({
	name: 'ListAutomations',
});

const props = defineProps<IListAutomationsProps>();

const emit = defineEmits<{
	(e: 'edit', id: IAutomation['id']): void;
	(e: 'flow', id: IAutomation['id']): void;
	(e: 'remove', id: IAutomation['id']): void;
	(e: 'toggle-enabled', id: IAutomation['id'], enabled: boolean): void;
	(e: 'adjust-list'): void;
	(e: 'reset-filters'): void;
	(e: 'retry'): void;
	(e: 'update:filters', filters: IAutomationsFilter): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', by: AutomationsSortBy | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { isMDDevice } = useBreakpoints();

let observer: ResizeObserver | null = null;

const wrapper = ref<HTMLElement | null>(null);
const paginator = ref<HTMLElement | null>(null);

const innerFilters = useVModel(props, 'filters', emit);

const sortBy = ref<AutomationsSortBy | undefined>(props.sortBy);

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
