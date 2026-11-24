<template>
	<el-table
		ref="tableEl"
		v-loading="props.loading && props.items.length > 0"
		:element-loading-text="t('displaysModule.texts.loadingDisplays')"
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
			<displays-empty
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
				<displays-table-column-icon :display="scope.row" />
			</template>
		</el-table-column>

		<el-table-column
			:label="t('displaysModule.table.columns.name')"
			prop="name"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="200"
		>
			<template #default="scope">
				<span class="block text-card-title truncate">{{ scope.row.name || scope.row.macAddress }}</span>
				<span
					v-if="scope.row.name"
					class="block text-help font-mono truncate"
				>
					{{ scope.row.macAddress }}
				</span>
			</template>
		</el-table-column>

		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('displaysModule.table.columns.version')"
			prop="version"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="110"
		>
			<template #default="scope">
				<span class="text-body">{{ scope.row.version }}</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('displaysModule.table.columns.resolution')"
			prop="screenWidth"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="130"
		>
			<template #default="scope">
				<span class="text-body">{{ scope.row.screenWidth }}×{{ scope.row.screenHeight }}</span>
			</template>
		</el-table-column>

		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('displaysModule.table.columns.layout')"
			:width="90"
		>
			<template #default="scope">
				<span class="text-body">{{ scope.row.cols }}×{{ scope.row.rows }}</span>
			</template>
		</el-table-column>

		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('displaysModule.table.columns.audio')"
			:width="90"
		>
			<template #default="scope">
				<span class="inline-flex items-center gap-2">
					<el-tooltip
						:content="
							scope.row.audioOutputSupported
								? t('displaysModule.table.tooltips.speakerSupported')
								: t('displaysModule.table.tooltips.speakerUnsupported')
						"
						placement="top"
					>
						<icon
							:icon="scope.row.audioOutputSupported ? 'mdi:volume-high' : 'mdi:volume-off'"
							:class="scope.row.audioOutputSupported ? 'text-success' : 'text-muted'"
							:aria-label="
								scope.row.audioOutputSupported
									? t('displaysModule.table.tooltips.speakerSupported')
									: t('displaysModule.table.tooltips.speakerUnsupported')
							"
							width="18"
							height="18"
							role="img"
						/>
					</el-tooltip>
					<el-tooltip
						:content="
							scope.row.audioInputSupported
								? t('displaysModule.table.tooltips.microphoneSupported')
								: t('displaysModule.table.tooltips.microphoneUnsupported')
						"
						placement="top"
					>
						<icon
							:icon="scope.row.audioInputSupported ? 'mdi:microphone' : 'mdi:microphone-off'"
							:class="scope.row.audioInputSupported ? 'text-success' : 'text-muted'"
							:aria-label="
								scope.row.audioInputSupported
									? t('displaysModule.table.tooltips.microphoneSupported')
									: t('displaysModule.table.tooltips.microphoneUnsupported')
							"
							width="18"
							height="18"
							role="img"
						/>
					</el-tooltip>
				</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('displaysModule.table.columns.state.title')"
			prop="status"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="140"
		>
			<template #default="scope">
				<status-tag
					:status="DISPLAY_STATUS_TAG[displayStatus(scope.row)]"
					:label="t(`displaysModule.states.${displayStatus(scope.row)}`)"
				/>
			</template>
		</el-table-column>

		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('displaysModule.table.columns.currentIpAddress')"
			prop="currentIpAddress"
			:width="140"
		>
			<template #default="scope">
				<span
					v-if="scope.row.currentIpAddress && isLocalAddress(scope.row.currentIpAddress)"
					class="text-body"
				>
					{{ t('displaysModule.table.columns.local') }}
				</span>
				<span
					v-else-if="scope.row.currentIpAddress"
					class="text-body font-mono"
				>
					{{ scope.row.currentIpAddress }}
				</span>
				<span
					v-else
					class="text-help"
				>
					—
				</span>
			</template>
		</el-table-column>

		<el-table-column
			:width="96"
			align="right"
			fixed="right"
		>
			<template #default="scope">
				<displays-row-actions
					:display="scope.row"
					@detail="(id: IDisplay['id']) => emit('detail', id)"
					@edit="(id: IDisplay['id']) => emit('edit', id)"
					@remove="(id: IDisplay['id']) => emit('remove', id)"
				/>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElTable, ElTableColumn, ElTooltip, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { StatusTag, useSizeClass } from '../../../common';
import type { IDisplaysFilter } from '../composables/types';
import type { IDisplay } from '../store/displays.store.types';

import DisplaysEmpty from './displays-empty.vue';
import DisplaysRowActions from './displays-row-actions.vue';
import { DISPLAY_STATUS_TAG, displayStatus, isLocalAddress } from './displays-status';
import DisplaysTableColumnIcon from './displays-table-column-icon.vue';
import type { IDisplaysTableProps } from './displays-table.types';

defineOptions({
	name: 'DisplaysTable',
});

const props = defineProps<IDisplaysTableProps>();

const emit = defineEmits<{
	(e: 'detail', id: IDisplay['id']): void;
	(e: 'edit', id: IDisplay['id']): void;
	(e: 'remove', id: IDisplay['id']): void;
	(e: 'reset-filters'): void;
	(e: 'selected-changes', selected: IDisplay[]): void;
	(e: 'update:filters', filters: IDisplaysFilter): void;
	(e: 'update:sort-by', by: 'name' | 'version' | 'screenWidth' | 'status' | undefined): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { t } = useI18n();

// Tablet portrait keeps the name, resolution and state; the version, layout, audio and address stay on the detail page
const { isTabletPortrait } = useSizeClass();

const tableEl = ref<InstanceType<typeof ElTable> | null>(null);

const tableHeight = computed<number>((): number => props.tableHeight ?? 400);

useVModel(props, 'filters', emit);

const onSortData = ({ prop, order }: { prop: 'name' | 'version' | 'screenWidth' | 'status'; order: 'ascending' | 'descending' | null }): void => {
	emit('update:sort-by', order === null ? undefined : prop);
	emit('update:sort-dir', order === 'descending' ? 'desc' : order === 'ascending' ? 'asc' : null);
};

const onSelectionChange = (selected: IDisplay[]): void => {
	emit('selected-changes', selected);
};

const onRowClick = (row: IDisplay): void => {
	emit('detail', row.id);
};

// The filter bar's Clear selection
const clearSelection = (): void => {
	tableEl.value?.clearSelection();
};

defineExpose({ clearSelection });
</script>
