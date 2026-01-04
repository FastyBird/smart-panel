<template>
	<el-table
		v-loading="props.loading"
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
			<div
				v-if="props.loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:monitor" />
							</template>
							<template #secondary>
								<icon icon="mdi:database-refresh" />
							</template>
						</icon-with-child>
					</template>
				</el-result>
			</div>

			<div
				v-else-if="noResults && !props.loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:monitor" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('displaysModule.texts.noDisplays') }}
					</template>
				</el-result>
			</div>

			<div
				v-else-if="props.filtersActive && !props.loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:monitor" />
							</template>
							<template #secondary>
								<icon icon="mdi:filter-multiple" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						<el-text class="block">
							{{ t('displaysModule.texts.noFilteredDisplays') }}
						</el-text>

						<el-button
							type="primary"
							plain
							class="mt-4"
							@click="emit('reset-filters')"
						>
							<template #icon>
								<icon icon="mdi:filter-off" />
							</template>

							{{ t('displaysModule.buttons.resetFilters.title') }}
						</el-button>
					</template>
				</el-result>
			</div>
		</template>

		<el-table-column
			v-if="isMDDevice"
			type="selection"
			:width="30"
		/>

		<el-table-column
			:width="60"
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
			class-name="py-0!"
		>
			<template #default="scope">
				<template v-if="scope.row.name">
					<strong class="block">{{ scope.row.name }}</strong>
					<el-text
						size="small"
						class="block leading-4"
						truncated
					>
						{{ scope.row.macAddress }}
					</el-text>
				</template>
				<template v-else>
					{{ scope.row.macAddress }}
				</template>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('displaysModule.table.columns.version')"
			prop="version"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="110"
		>
			<template #default="scope">
				{{ scope.row.version }}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('displaysModule.table.columns.resolution')"
			prop="screenWidth"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="120"
		>
			<template #default="scope">
				{{ scope.row.screenWidth }}x{{ scope.row.screenHeight }}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('displaysModule.table.columns.layout')"
			:width="80"
		>
			<template #default="scope">
				{{ scope.row.cols }}x{{ scope.row.rows }}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('displaysModule.table.columns.audio')"
			:width="80"
			align="center"
		>
			<template #default="scope">
				<div class="flex items-center justify-center gap-2">
					<el-tooltip
						v-if="scope.row.audioOutputSupported"
						:content="t('displaysModule.table.tooltips.speakerSupported')"
						placement="top"
					>
						<el-icon
							:size="18"
							class="text-green-500"
						>
							<icon icon="mdi:volume-high" />
						</el-icon>
					</el-tooltip>
					<el-icon
						v-else
						:size="18"
						class="text-gray-300"
					>
						<icon icon="mdi:volume-off" />
					</el-icon>
					<el-tooltip
						v-if="scope.row.audioInputSupported"
						:content="t('displaysModule.table.tooltips.microphoneSupported')"
						placement="top"
					>
						<el-icon
							:size="18"
							class="text-green-500"
						>
							<icon icon="mdi:microphone" />
						</el-icon>
					</el-tooltip>
					<el-icon
						v-else
						:size="18"
						class="text-gray-300"
					>
						<icon icon="mdi:microphone-off" />
					</el-icon>
				</div>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('displaysModule.table.columns.state.title')"
			prop="status"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="130"
		>
			<template #default="scope">
				<displays-table-column-state
					:display="scope.row"
					:filters="innerFilters"
					@filter-by="(value: IDisplay['status'], add: boolean) => onFilterBy('state', value, add)"
				/>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('displaysModule.table.columns.currentIpAddress')"
			prop="currentIpAddress"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="130"
		>
			<template #default="scope">
				<template v-if="scope.row.currentIpAddress">
					{{ formatIpAddress(scope.row.currentIpAddress) }}
				</template>
				<template v-else>
					—
				</template>
			</template>
		</el-table-column>

		<el-table-column
			:width="180"
			align="right"
		>
			<template #default="scope">
				<div @click.stop>
					<el-button
						size="small"
						plain
						data-test-id="detail-display"
						@click="emit('detail', scope.row.id)"
					>
						<template #icon>
							<icon icon="mdi:file-search-outline" />
						</template>

						{{ t('displaysModule.buttons.detail.title') }}
					</el-button>
					<el-button
						size="small"
						plain
						class="ml-1!"
						data-test-id="edit-display"
						@click="emit('edit', scope.row.id)"
					>
						<template #icon>
							<icon icon="mdi:pencil" />
						</template>
					</el-button>
					<el-button
						size="small"
						type="warning"
						plain
						class="ml-1!"
						data-test-id="remove-display"
						@click="emit('remove', scope.row.id)"
					>
						<template #icon>
							<icon icon="mdi:trash" />
						</template>
					</el-button>
				</div>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElIcon, ElResult, ElTable, ElTableColumn, ElText, ElTooltip, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { IconWithChild, useBreakpoints } from '../../../common';
import DisplaysTableColumnIcon from './displays-table-column-icon.vue';
import DisplaysTableColumnState from './displays-table-column-state.vue';
import type { IDisplay } from '../store/displays.store.types';
import type { IDisplaysFilter } from '../composables/types';

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

const { isMDDevice } = useBreakpoints();

const noResults = computed<boolean>((): boolean => props.totalRows === 0);

const tableHeight = computed<number>((): number => props.tableHeight ?? 400);

const innerFilters = useVModel(props, 'filters', emit);

const formatIpAddress = (ipAddress: string): string => {
	if (!ipAddress) {
		return '—';
	}
	const normalized = ipAddress.toLowerCase().trim();
	if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
		return t('displaysModule.table.columns.local');
	}
	return ipAddress;
};

const onSortData = ({
	prop,
	order,
}: {
	prop: 'name' | 'version' | 'screenWidth' | 'status';
	order: 'ascending' | 'descending' | null;
}): void => {
	emit('update:sort-by', prop);
	emit('update:sort-dir', order === 'descending' ? 'desc' : order === 'ascending' ? 'asc' : null);
};

const onFilterBy = (column: string, data: IDisplay['status'], add?: boolean): void => {
	if (column === 'state') {
		let filteredStates = innerFilters.value.states;

		if (add === true) {
			filteredStates.push(data);
		} else {
			filteredStates = innerFilters.value.states.filter((item) => item !== data);
		}

		innerFilters.value.states = Array.from(new Set(filteredStates));
	}
};

const onSelectionChange = (selected: IDisplay[]): void => {
	emit('selected-changes', selected);
};

const onRowClick = (row: IDisplay): void => {
	emit('detail', row.id);
};
</script>
