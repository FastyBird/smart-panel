<template>
	<el-table
		ref="tableEl"
		v-loading="props.loading && props.items.length > 0"
		:element-loading-text="t('spacesModule.texts.loadingSpaces')"
		:data="props.items"
		:default-sort="
			typeof props.sortBy !== 'undefined' && props.sortDir !== null
				? { prop: props.sortBy, order: props.sortDir === 'desc' ? 'descending' : 'ascending' }
				: undefined
		"
		table-layout="fixed"
		row-key="id"
		class="flex-grow"
		:style="{ maxHeight: tableHeight + 'px' }"
		:max-height="tableHeight"
		@row-click="onRowClick"
		@sort-change="onSortData"
		@selection-change="onSelectionChange"
	>
		<template #empty>
			<spaces-empty
				:loading="props.loading"
				:filters-active="props.filtersActive"
				@reset-filters="emit('reset-filters')"
			/>
		</template>

		<el-table-column
			type="selection"
			fixed="left"
			:width="40"
		/>

		<el-table-column
			:width="56"
			align="center"
		>
			<template #default="scope">
				<span
					class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-fill-light text-regular"
					aria-hidden="true"
				>
					<icon
						:icon="spaceIcon(scope.row)"
						width="20"
						height="20"
					/>
				</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('spacesModule.table.columns.name')"
			prop="name"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="200"
		>
			<template #default="scope">
				<span class="block text-card-title truncate">{{ scope.row.name }}</span>
				<span
					v-if="scope.row.description"
					class="block text-help truncate"
				>
					{{ scope.row.description }}
				</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('spacesModule.table.columns.type')"
			prop="type"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="200"
		>
			<template #default="scope">
				<spaces-table-column-plugin :space="scope.row" />
			</template>
		</el-table-column>

		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('spacesModule.table.columns.order')"
			prop="displayOrder"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="100"
			align="center"
		>
			<template #default="scope">
				<span class="text-body">{{ scope.row.displayOrder }}</span>
			</template>
		</el-table-column>

		<el-table-column
			:width="232"
			align="right"
			fixed="right"
		>
			<template #default="scope">
				<spaces-table-column-actions
					:space="scope.row"
					@edit="(id: ISpace['id']) => emit('edit', id)"
					@remove="(id: ISpace['id']) => emit('remove', id)"
					@configure="(to: RouteLocationRaw) => emit('configure', to)"
				/>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RouteLocationRaw } from 'vue-router';

import { ElTable, ElTableColumn, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { useSizeClass } from '../../../common';
import type { ISpacesFilter } from '../composables/types';
import { SpaceType } from '../spaces.constants';
import type { ISpace } from '../store/spaces.store.types';

import SpacesEmpty from './spaces-empty.vue';
import SpacesTableColumnActions from './spaces-table-column-actions.vue';
import SpacesTableColumnPlugin from './spaces-table-column-plugin.vue';
import type { ISpacesTableProps } from './spaces-table.types';

defineOptions({
	name: 'SpacesTable',
});

const props = defineProps<ISpacesTableProps>();

const emit = defineEmits<{
	(e: 'edit', id: ISpace['id']): void;
	(e: 'remove', id: ISpace['id']): void;
	(e: 'configure', to: RouteLocationRaw): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: ISpacesFilter): void;
	(e: 'update:sort-by', by: 'name' | 'type' | 'displayOrder' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
	(e: 'selected-changes', items: ISpace[]): void;
}>();

const { t } = useI18n();

const { isTabletPortrait } = useSizeClass();

useVModel(props, 'filters', emit);

const tableEl = ref<InstanceType<typeof ElTable> | null>(null);

const tableHeight = computed<number>((): number => props.tableHeight ?? 400);

const spaceIcon = (space: ISpace): string => space.icon || (space.type === SpaceType.ROOM ? 'mdi:door' : 'mdi:home-floor-1');

const onSortData = ({ prop, order }: { prop: 'name' | 'type' | 'displayOrder'; order: 'ascending' | 'descending' | null }): void => {
	emit('update:sort-by', prop);
	emit('update:sort-dir', order === 'descending' ? 'desc' : order === 'ascending' ? 'asc' : null);
};

const onSelectionChange = (selected: ISpace[]): void => {
	emit('selected-changes', selected);
};

const onRowClick = (space: ISpace): void => {
	emit('edit', space.id);
};

// The filter bar's Clear selection
const clearSelection = (): void => {
	tableEl.value?.clearSelection();
};

defineExpose({ clearSelection, spaceIcon });
</script>
