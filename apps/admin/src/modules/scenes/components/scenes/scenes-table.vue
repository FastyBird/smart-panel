<template>
	<el-table
		ref="tableEl"
		v-loading="props.loading && props.items.length > 0"
		:element-loading-text="t('scenes.texts.loadingScenes')"
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
		@sort-change="onSortData"
		@selection-change="onSelectionChange"
		@row-click="onRowClick"
	>
		<template #empty>
			<scenes-empty
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
				<scenes-table-column-icon :scene="scope.row" />
			</template>
		</el-table-column>

		<el-table-column
			:label="t('scenes.fields.name')"
			prop="name"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="180"
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
			:label="t('scenes.fields.space')"
			prop="primarySpaceId"
			:width="180"
		>
			<template #default="scope">
				<span class="text-body">{{ getSpaceName(scope.row.primarySpaceId) }}</span>
			</template>
		</el-table-column>

		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('scenes.fields.category')"
			prop="category"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="140"
		>
			<template #default="scope">
				<span class="text-body">{{ t(`scenes.categories.${scope.row.category}`) }}</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('scenes.fields.enabled')"
			prop="enabled"
			:width="120"
		>
			<template #default="scope">
				<status-tag
					:status="scope.row.enabled ? 'ok' : 'warn'"
					:label="scope.row.enabled ? t('scenes.filters.enabled.values.enabled') : t('scenes.filters.enabled.values.disabled')"
				/>
			</template>
		</el-table-column>

		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('scenes.fields.lastTriggered')"
			prop="lastTriggeredAt"
			:width="180"
		>
			<template #default="scope">
				<span
					v-if="scope.row.lastTriggeredAt"
					class="text-body"
				>
					{{ formatDate(scope.row.lastTriggeredAt) }}
				</span>
				<span
					v-else
					class="text-help"
				>
					{{ t('scenes.fields.neverTriggered') }}
				</span>
			</template>
		</el-table-column>

		<el-table-column
			:width="176"
			align="right"
			fixed="right"
		>
			<template #default="scope">
				<scenes-row-actions
					:scene="scope.row"
					:triggering="props.triggering.includes(scope.row.id)"
					@trigger="(id: IScene['id']) => emit('trigger', id)"
					@edit="(id: IScene['id']) => emit('edit', id)"
					@remove="(id: IScene['id']) => emit('remove', id)"
				/>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElTable, ElTableColumn, vLoading } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { StatusTag, useSizeClass } from '../../../../common';
import type { IScenesFilter } from '../../composables/types';
import type { IScene } from '../../store/scenes.store.types';

import ScenesEmpty from './scenes-empty.vue';
import ScenesRowActions from './scenes-row-actions.vue';
import ScenesTableColumnIcon from './scenes-table-column-icon.vue';
import type { IScenesTableProps } from './scenes-table.types';

defineOptions({
	name: 'ScenesTable',
});

const props = defineProps<IScenesTableProps>();

const emit = defineEmits<{
	(e: 'edit', id: IScene['id']): void;
	(e: 'remove', id: IScene['id']): void;
	(e: 'trigger', id: IScene['id']): void;
	(e: 'reset-filters'): void;
	(e: 'selected-changes', selected: IScene[]): void;
	(e: 'update:filters', filters: IScenesFilter): void;
	(e: 'update:sort-by', by: 'name' | 'category' | 'order' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { t, locale } = useI18n();

const { isTabletPortrait } = useSizeClass();

const tableEl = ref<InstanceType<typeof ElTable> | null>(null);

// Inject spaces from parent (passed through provide)
const spaces = inject<{ value: Array<{ id: string; name: string }> }>('spaces', { value: [] });

useVModel(props, 'filters', emit);

const tableHeight = computed<number>(() => props.tableHeight);

const getSpaceName = (primarySpaceId: string | null | undefined): string => {
	if (!primarySpaceId) {
		return t('scenes.fields.wholeHome');
	}
	const space = spaces.value.find((s) => s.id === primarySpaceId);
	return space?.name || t('scenes.fields.wholeHome');
};

const formatDate = (date: Date): string => {
	return new Intl.DateTimeFormat(locale.value, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(date);
};

const onSortData = ({ prop, order }: { prop: 'name' | 'category' | 'order'; order: 'ascending' | 'descending' | null }): void => {
	emit('update:sort-by', order === null ? undefined : prop);
	emit('update:sort-dir', order === 'descending' ? 'desc' : order === 'ascending' ? 'asc' : null);
};

const onSelectionChange = (selected: IScene[]): void => {
	emit('selected-changes', selected);
};

const onRowClick = (row: IScene): void => {
	if (row.editable) {
		emit('edit', row.id);
	}
};

// The filter bar's Clear selection
const clearSelection = (): void => {
	tableEl.value?.clearSelection();
};

defineExpose({ clearSelection, getSpaceName });
</script>
