<template>
	<div class="h-full w-full flex flex-col">
		<el-card
			shadow="never"
			class="px-1 py-2 mt-2"
			body-class="p-0!"
		>
			<system-logs-filter
				v-model:filters="innerFilters"
				v-model:live="innerLive"
				:filters-active="props.filtersActive"
				@reset-filters="onResetFilters"
				@adjust-list="onAdjustList"
				@refresh="onRefresh"
			/>
		</el-card>

		<div class="flex-1 overflow-hidden flex flex-col">
			<el-card
				shadow="never"
				class="mt-2 flex flex-col"
				body-class="p-0! flex-1 overflow-hidden"
			>
				<el-scrollbar>
					<system-logs-table
						:items="props.items"
						:loading="props.loading"
						:filters-active="props.filtersActive"
						:has-more="props.hasMore"
						@detail="onDetail"
						@reset-filters="onResetFilters"
						@load-more="onLoadMore"
					/>
				</el-scrollbar>
			</el-card>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ElCard, ElScrollbar } from 'element-plus';

import { useVModel } from '@vueuse/core';

import type { ISystemLogsFilter } from '../../composables/types';
import type { ILogEntry } from '../../store/logs-entries.store.types';

import { type IListSystemLogsProps } from './list-system-logs.types';
import SystemLogsFilter from './system-logs-filter.vue';
import SystemLogsTable from './system-logs-table.vue';

defineOptions({
	name: 'ListSystemLogs',
});

const props = defineProps<IListSystemLogsProps>();

const emit = defineEmits<{
	(e: 'detail', id: ILogEntry['id']): void;
	(e: 'adjust-list'): void;
	(e: 'reset-filters'): void;
	(e: 'refresh'): void;
	(e: 'load-more'): void;
	(e: 'clear'): void;
	(e: 'update:filters', filters: ISystemLogsFilter): void;
	(e: 'update:live', live: boolean): void;
}>();

const innerFilters = useVModel(props, 'filters', emit);

const innerLive = useVModel(props, 'live', emit);

const onDetail = (id: ILogEntry['id']): void => {
	emit('detail', id);
};

const onResetFilters = (): void => {
	emit('reset-filters');
};

const onLoadMore = (): void => {
	emit('load-more');
};

const onRefresh = (): void => {
	emit('refresh');
};

const onAdjustList = (): void => {
	emit('adjust-list');
};
</script>
